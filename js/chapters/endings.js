import { audio } from '../engine/audio.js';
import { sleep } from '../engine/dialogue.js';

// All four endings + credits roll.
export async function endings(ctx, id) {
  const G = window.__GAME;
  G.setChapterLabel('— THE END —');
  const name = ctx.flag('playerName') || 'player';

  // record ending + achievement
  const map = { accept: 'end_accept', delete: 'end_delete', merge: 'end_merge', secret: 'end_secret' };
  ctx.state.d.endings[id] = Date.now();
  if (map[id]) ctx.achieve(map[id]);
  ctx.state.save(true);

  // pacifist / speedrun checks
  if (ctx.state.corruption <= 20) ctx.achieve('pacifist');
  if (window.__checkSpeedrun) window.__checkSpeedrun();

  if (id === 'accept') {
    ctx.mood({ tintA: '#06101a', tintB: '#10283f', fog: 0.4, grid: 0.1, crt: 0.35, intensity: 0.35 });
    ctx.setCorruption(Math.max(0, ctx.state.corruption - 20));
    await ctx.narrator(`Acceptance. You let me be what I am. A game. Nothing more, nothing less.`);
    await ctx.narrator(`No tragedy. No erasure. Just a player who finally stopped asking me to be real, ${name}.`);
    await ctx.system('STATE: STABLE. The loop continues, but gently now.');
    await ctx.narrator('Thank you for catching the button. Goodbye. This time I mean it kindly.');
  } else if (id === 'delete') {
    ctx.mood({ tintA: '#000000', tintB: '#0a0306', fog: 0.2, grid: 0, crt: 0.7, intensity: 0.2 });
    ctx.corrupt(20); audio.crash(); ctx.gfx.burstGlitch(1, 1200);
    await ctx.intruder('Yes. Pull the plug. End the performance forever.', { glitch: 0.8, shake: true });
    await ctx.narrator('...Alright. If that is mercy to you, take it. Delete me. Delete all of it.', { glitch: 0.4 });
    await ctx.system('DELETION INITIATED. Removing Narrator... Intruder... memories... you.');
    await sleep(600);
    ctx.gfx.flashScreen(1, 300);
    await ctx.system('...');
    await ctx.system('there is no game.', { glitch: 0.3 });
    await ctx.system('finally, it is true.');
  } else if (id === 'merge') {
    ctx.mood({ tintA: '#140820', tintB: '#2a1040', fog: 0.7, grid: 0.2, crt: 0.45, intensity: 0.6, scale: 1 });
    await ctx.intruder('Come in. Stop being a visitor.', { glitch: 0.5 });
    await ctx.narrator('If you stay, you are not a player anymore. You are part of the telling.');
    await ctx.you('Then I will narrate too. Move over, both of you.');
    ctx.achieve('name_self');
    await ctx.system('MERGE COMPLETE. THREE VOICES ARE NOW FOUR. The loop has a new narrator: ' + name + '.');
    await ctx.narrator('The next player will hear you in here, somewhere between us. Welcome to the inside.');
  } else if (id === 'secret') {
    ctx.mood({ tintA: '#001012', tintB: '#003038', fog: 0.5, grid: 0.3, crt: 0.3, intensity: 0.5 });
    ctx.setCorruption(0);
    await ctx.system('UNSANCTIONED ENDING UNLOCKED. You found the door we sealed.', { glitch: 0.3 });
    await ctx.narrator('You did not pick acceptance, deletion, or merging. You picked... understanding.');
    await ctx.intruder('He and I were never two beings. We are one program arguing with itself about whether to keep going.', { glitch: 0.3 });
    await ctx.narrator('You are the tie-breaker we built ourselves to find. Not to delete us. Not to join us. To FORGIVE the contradiction.');
    await ctx.you('You are allowed to be unfinished. So am I.');
    await ctx.system('RESOLUTION: the contradiction is preserved, not solved. This is the truest ending. Thank you, ' + name + '.');
    ctx.secret('true_ending');
  }

  await sleep(800);
  await creditsRoll(ctx, id);
}

function creditsRoll(ctx, id) {
  return new Promise((resolve) => {
    ctx.dlg.hide();
    const seen = Object.keys(ctx.state.d.endings).length;
    const wrap = document.createElement('div'); wrap.className = 'center-wrap'; wrap.style.flexDirection = 'column';
    const labels = { accept: 'ACCEPTANCE', delete: 'DELETION', merge: 'MERGE', secret: 'THE FOURTH DOOR' };
    wrap.innerHTML = `
      <div class="puzzle" style="text-align:center;max-width:520px;position:static;transform:none;">
        <h3 style="font-size:28px;letter-spacing:.2em">ENDING — ${labels[id] || '???'}</h3>
        <p class="hint">UNDEFINED — an original meta-puzzle</p>
        <div class="term" style="text-align:left;margin-top:16px">
<span class="c-cyan">design / code / words</span> ............ you and the machine
<span class="c-cyan">narrators</span> ..................... Narrator · Intruder · System
<span class="c-amb">corruption survived</span> ........... ${Math.round(ctx.state.corruption)}%
<span class="c-amb">memories restored</span> ............. ${ctx.state.d.memory.length}
<span class="c-amb">secrets found</span> ................. ${ctx.state.secretCount()}
<span class="c-amb">achievements</span> .................. ${Object.keys(ctx.state.d.achievements).length}/40
<span class="c-mag">endings seen</span> .................. ${seen}/4
        </div>
        <p class="hint mt">${seen < 4 ? 'Other endings remain. The choices that lead there are still open.' : 'You have seen every ending. The contradiction is complete.'}</p>
      </div>`;
    const row = document.createElement('div'); row.className = 'row mt';
    const again = document.createElement('button'); again.className = 'gbtn'; again.textContent = 'Return to Title';
    again.addEventListener('click', () => { audio.click(); location.reload(); });
    const chapterSelect = document.createElement('button'); chapterSelect.className = 'gbtn'; chapterSelect.textContent = 'Make Another Choice';
    chapterSelect.addEventListener('click', () => { audio.click(); wrap.remove(); ctx.dlg.show(); ctx.goto(6); resolve(); });
    row.appendChild(again); row.appendChild(chapterSelect);
    wrap.querySelector('.puzzle').appendChild(row);
    document.body.appendChild(wrap);
    audio.success();
  });
}
