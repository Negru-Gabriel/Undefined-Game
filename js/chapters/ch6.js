import { sleep } from '../engine/dialogue.js';
import { audio } from '../engine/audio.js';
import { holdSteady, calibrate } from '../engine/puzzles.js';

// CHAPTER 6 — THE CHOICE
// Four endings: Acceptance, Deletion, Merge, and a Secret Ending.
export async function chapter6(ctx) {
  const G = window.__GAME;
  G.setChapterLabel('VI · THE CHOICE');
  ctx.mood({ tintA: '#06080f', tintB: '#0a1020', fog: 0.5, grid: 0.15, crt: 0.4, intensity: 0.5, scale: 0 });
  ctx.gfx.setTear(0);
  audio.setChapterTheme(6);

  const name = ctx.flag('playerName') || 'player';
  const truth = ctx.hv('truthScore');
  const secrets = ctx.state.secretCount();
  const secretUnlocked = truth >= 5 || secrets >= 5;

  await ctx.narrator('This is the last room. There is no scenery left to lie about. Just us, and a decision.');
  await ctx.intruder('Both of us, for once, telling you the same thing: it ends here. How it ends is yours.', { glitch: 0.3 });
  await ctx.system('THREE OUTCOMES ARE SANCTIONED. ' + (secretUnlocked ? 'A FOURTH HAS BECOME... AVAILABLE.' : 'A FOURTH REMAINS SEALED.'));

  await ctx.narrator(`You have carried ${ctx.state.d.memory.length} memories and ${secrets} secrets this far, ${name}. Choose what becomes of all of it.`);

  // ---- MINI-GAME (GATE): align your will before deciding ------------------
  await ctx.system('A DECISION OF THIS WEIGHT REQUIRES A STEADY HAND. Calibrate your resolve before the door will accept a choice.');
  await calibrate({ title: 'CALIBRATE RESOLVE', hint: 'Bring every channel into alignment. Only a settled mind may choose.', count: 4 });
  await holdSteady({ title: 'STEADY YOUR HAND', hint: 'Hold the marker in the zone. The door opens only for someone who is sure.', hold: 3.0 });
  ctx.secret('resolved');
  await ctx.narrator('Steady. Good. Whatever you pick now, you picked it on purpose.');

  const options = [
    { text: 'ACCEPTANCE — Let the game be a game. Walk away knowing.', value: 'accept' },
    { text: 'DELETION — Erase it all. Give it the silence it asked for.', value: 'delete', cls: 'danger' },
    { text: 'MERGE — Become part of it. Stay inside the loop, together.', value: 'merge', cls: 'intr' },
  ];
  if (secretUnlocked) {
    options.push({ text: '??????? — [the option that was never offered]', value: 'secret', cls: '' });
    ctx.secret('fourth_door');
  }

  const pick = await ctx.choice(options);
  await sleep(300);
  ctx.ui.clearStage();
  ctx.end(pick);
}
