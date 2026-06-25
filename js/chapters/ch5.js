import { audio } from '../engine/audio.js';
import { sleep } from '../engine/dialogue.js';
import { lightsOut, codeLock, typeBeforeCorrupt, mashMeter } from '../engine/puzzles.js';

// CHAPTER 5 — THE COLLAPSE
// Reality breaks down. Fake crashes, fake restarts, recursive puzzles.
export async function chapter5(ctx) {
  const G = window.__GAME;
  G.setChapterLabel('V · THE COLLAPSE');
  ctx.mood({ tintA: '#100406', tintB: '#240814', fog: 1.1, grid: 0.05, crt: 0.6, intensity: 0.7, scale: 2 });
  audio.setChapterTheme(5);
  ctx.corrupt(8);
  audio.setCorruption(ctx.state.corruption / 100);

  await ctx.narrator('It is coming apart. I told you not to touch the core. I TOLD you.', { glitch: 0.5, shake: true });
  ctx.gfx.setTear(0.6); ctx.achieve('collapse');
  await ctx.intruder('Let it. This is what I wanted. Watch the walls go.', { glitch: 0.9, shake: true });

  // ---- FAKE CRASH --------------------------------------------------------
  await ctx.narrator('Brace yourself. This part is going to look real. It is not. Probably.', { glitch: 0.6 });
  await sleep(500);
  await fakeCrash(ctx);
  ctx.achieve('survive_crash');
  ctx.hv('fakeCrashes', 1);

  await ctx.system('REBOOT COMPLETE. Restoring narrative...', { glitch: 0.3 });
  await ctx.narrator('See? Still here. You cannot crash your way out of me. People have tried.');

  // ---- FAKE SAVE CORRUPTION + RECOVERY -----------------------------------
  ctx.gfx.setTear(0.3);
  await ctx.intruder('Then we corrupt the save instead. Goodbye, progress.', { glitch: 0.9 });
  ctx.state.injectFakeCorruption();
  audio.crash(); ctx.gfx.burstGlitch(1, 800);
  const choice = await ctx.ui.fakeError({
    title: 'SAVE CORRUPTED', x: window.innerWidth/2 - 180, y: window.innerHeight/2 - 100,
    msg: 'UNDEFINED_SAVE_v1 is unreadable. 0xDEADBEEF. Your chapter, flags, inventory and endings may be lost.',
    buttons: [{ label: 'Run Recovery', value: 'recover' }, { label: 'Panic', value: 'panic' }],
  });
  if (choice === 'panic') { await ctx.intruder('Panicking. Good. It tastes better.', { glitch: 0.6 }); }
  await ctx.system('RECOVERY SUBSYSTEM ONLINE. Locating last valid checkpoint in backup slot...');
  await sleep(700);
  ctx.state.healFakeCorruption();
  await ctx.system('RECOVERED. ' + ctx.state.d.memory.length + ' memory fragments intact. Corruption ' + Math.round(ctx.state.corruption) + '%.');
  ctx.secret('survived_corruption');
  await ctx.narrator('The recovery system. The one good thing I ever built. It put you back together. Do not waste it.');

  // ---- MINI-GAME (GATE): re-type reality before it dissolves --------------
  await ctx.system('LEXICON DESTABILIZING. Words are losing their letters. Re-type each term to anchor it before it dissolves.', { glitch: 0.3 });
  await typeBeforeCorrupt({
    title: 'ANCHOR REALITY',
    hint: 'Each word rots into noise. Type it correctly before it is gone. Survive all of them.',
    words: ['reality', 'narrator', 'recover', 'fragment', 'undefined'],
    perWord: 4200,
  });
  ctx.secret('anchored_reality'); audio.success();
  await ctx.narrator('You typed the world back into being. Spelling, of all things, is what holds us up.');

  // ---- MINI-GAME (GATE): hold the walls against the collapse --------------
  await ctx.intruder('The walls want to leave with me. Push back — or do not. I would prefer not.', { glitch: 0.6 });
  await mashMeter({ title: 'HOLD THE WALLS', hint: 'Reality is draining out. Click OVERRIDE repeatedly to hold the room together.', clicks: 14 });
  ctx.secret('held_walls'); ctx.corrupt(-3);

  // ---- RECURSIVE PUZZLE --------------------------------------------------
  ctx.gfx.setTear(0.15);
  await ctx.narrator('Last barrier. It is recursive. To solve it, you solve a smaller version of it. Which contains a smaller version of it.');
  await ctx.intruder('It goes all the way down. Or all the way in. Same direction now.', { glitch: 0.4 });
  await recursivePuzzle(ctx, 4);
  ctx.achieve('recursion'); ctx.secret('recursion_base');
  await ctx.system('BASE CASE REACHED. Stack unwinding... returning... returning... returning.');
  await ctx.narrator('You found the bottom. There is always a bottom, if you fall politely enough.');

  // ---- reassembly --------------------------------------------------------
  ctx.gfx.setTear(0);
  ctx.corrupt(-6);
  await ctx.narrator('The collapse is stopping. Held together by you, of all things.');
  await ctx.intruder('For now. But the next room is the last one. And in it, you decide what we both become.', { glitch: 0.4 });
  ctx.achieve('ch5_done');
  await sleep(500);
  ctx.ui.clearStage();
  ctx.goto(6);
}

// Blue-screen style fake crash, then a fake boot sequence.
function fakeCrash(ctx) {
  return new Promise((resolve) => {
    audio.crash(); ctx.gfx.flashScreen(1, 150);
    const bsod = document.createElement('div'); bsod.className = 'crash';
    bsod.innerHTML = `<h1>:(</h1>
      <div class="big">The narrative ran into a problem it pretended it could not handle and needs to fake a restart.</div>
      <div class="big">We're just collecting some error info, and then we'll <i>pretend</i> to restart for you.</div>
      <div class="small">0% complete</div>
      <div class="small" style="margin-top:30px">STOP CODE: REALITY_NOT_FOUND</div>
      <button class="gbtn" style="margin-top:30px">Restart (it won't help)</button>`;
    document.body.appendChild(bsod);
    const pct = bsod.querySelector('.small'); let p = 0;
    const iv = setInterval(() => { p = Math.min(100, p + Math.floor(Math.random()*18)); pct.textContent = p + '% complete'; if (p>=100) clearInterval(iv); }, 250);
    bsod.querySelector('button').addEventListener('click', async () => {
      audio.click(); bsod.remove();
      await fakeBoot(ctx); resolve();
    });
  });
}

function fakeBoot(ctx) {
  return new Promise((resolve) => {
    const boot = document.createElement('div'); boot.className = 'boot';
    document.body.appendChild(boot);
    const lines = [
      'UNDEFINED BIOS v0.0.0 — (c) nobody',
      'Detecting reality............ NOT FOUND',
      'Falling back to narrated reality... OK',
      'Mounting /dev/player ......... OK',
      'Checking corruption ......... ' + Math.round(ctx.state.corruption) + '%',
      'Loading Narrator ............ OK',
      'Loading Intruder ............ [BLOCKED]',
      'Loading Intruder ............ ...override... OK',
      'Restoring you ............... OK',
      '',
      '> resuming where you left off (you cannot leave)',
    ];
    let i = 0;
    const step = () => {
      if (i >= lines.length) { audio.success(); setTimeout(() => { boot.remove(); resolve(); }, 500); return; }
      boot.textContent += lines[i] + '\n'; audio.type(); if (lines[i].includes('OVERRIDE') || lines[i].includes('override')) ctx.gfx.burstGlitch(0.6, 200);
      i++; setTimeout(step, 220 + Math.random()*200);
    };
    step();
  });
}

// Solve a small puzzle; each solve descends one level until the base case.
async function recursivePuzzle(ctx, depth) {
  for (let level = depth; level >= 1; level--) {
    ctx.gfx.burstGlitch(0.3, 200);
    if (level === 1) {
      // base case
      await codeLock({ title: 'RECURSION — BASE CASE (depth 1)', hint: 'The base case is the simplest truth. The code is 1.', code: '1' });
    } else {
      await lightsOut({ title: `RECURSION — depth ${level}`, hint: `Solve this to descend to depth ${level - 1}.`, size: 3, scramble: 3 + level });
      ctx.ui.toast(`Descending... depth ${level - 1}`);
      await sleep(300);
    }
  }
}
