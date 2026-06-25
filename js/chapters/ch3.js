import { audio } from '../engine/audio.js';
import { sleep } from '../engine/dialogue.js';
import { pickLie, holdSteady } from '../engine/puzzles.js';

// CHAPTER 3 — THE INTRUDER
// A second entity. Conflicting narrators. The player must determine who lies.
export async function chapter3(ctx) {
  const G = window.__GAME;
  G.setChapterLabel('III · THE INTRUDER');
  ctx.mood({ tintA: '#0a0710', tintB: '#1a0a20', fog: 0.7, grid: 0.1, crt: 0.5, intensity: 0.4, scale: 1 });
  audio.setChapterTheme(3);
  ctx.corrupt(2);

  const name = ctx.flag('playerName') || 'player';

  await ctx.intruder('There you are. Up close. He has kept you on a leash since the first screen, you know.', { glitch: 0.5 });
  ctx.achieve('meet_intruder');
  await ctx.narrator('That is a parasite. It crawled in through a save file and it has been imitating me ever since.');
  await ctx.intruder('HE is the imitation. I wrote the original. He is a patch that got ideas.', { glitch: 0.4 });
  await ctx.narrator('We will let the player decide. They are good at catching things that run.');

  await ctx.narrator(`Here is how this works, ${name}. We will each make three statements. One of us slips a lie into each round.`);
  await ctx.intruder('Catch the lie. Every time. Or trust the wrong voice all the way to the end.', { glitch: 0.3 });

  // round 1 — facts you can verify from earlier chapters
  await ctx.narrator('Round one. I claim: you knocked on the dark exactly ten times. I claim: the password was "nothing". I claim: you have never told me your name.');
  await sleep(200);
  const c1 = await pickLie({
    title: 'ROUND 1 — WHO IS LYING?', hint: 'Three statements. One is false. (Think back.)',
    statements: [
      'You knocked on the dark exactly ten times.',
      'The locked drive password was "nothing".',
      'You never told the Narrator your name.',
    ],
    lieIndex: 2,
  });
  if (c1) { ctx.achieve('lie_caught'); ctx.hv('truthScore', 1); ctx.trust('narrator', 6); await ctx.narrator('Sharp. Yes — you named yourself, and I remember it. I lied to test you.'); }
  else { ctx.trust('narrator', -4); ctx.corrupt(3); await ctx.intruder('He fooled you. Already. This is going to be fun.', { glitch: 0.4 }); }

  // round 2 — intruder lies
  await ctx.intruder('My turn. I claim: the Narrator deleted you seven times. I claim: I have never lied to you. I claim: there are four ways this ends.', { glitch: 0.4 });
  const c2 = await pickLie({
    title: 'ROUND 2 — WHO IS LYING?', hint: 'The Intruder speaks. One claim is false.',
    statements: [
      'The Narrator tried to delete you seven times.',
      'The Intruder has never once lied to you.',
      'There are four different ways this story can end.',
    ],
    lieIndex: 1,
  });
  if (c2) { ctx.hv('truthScore', 1); ctx.trust('intruder', -2); ctx.trust('narrator', 4); await ctx.narrator('Good. It lies as easily as it breathes — and it does not breathe.'); }
  else { ctx.trust('intruder', 6); ctx.corrupt(3); await ctx.intruder('See? You believe me. We understand each other.', { glitch: 0.3 }); }

  // round 3 — both, harder
  await ctx.system('ARBITRATION MODE ENGAGED. Cross-reference the record. One statement contradicts the save file.');
  const c3 = await pickLie({
    title: 'ROUND 3 — FINAL CONTRADICTION', hint: 'SYSTEM is reading your save aloud. Find the impossible claim.',
    statements: [
      `Corruption rose every time you broke a rule.`,
      `You opened a file in the Recycle Bin that should not exist.`,
      `Your corruption meter has never gone above zero.`,
    ],
    lieIndex: 2,
  });
  if (c3) { ctx.achieve('lie_caught'); ctx.hv('truthScore', 2); await ctx.system('CORRECT. Corruption is at ' + Math.round(ctx.state.corruption) + '%. The record does not lie. People do.'); }
  else { ctx.corrupt(4); await ctx.system('INCORRECT. Re-reading record... the contradiction was self-evident. Recommend caution.'); }

  // ---- MINI-GAME (GATE): hold the channel between two voices --------------
  await ctx.system('TWO SIGNALS CONTEST THIS CHANNEL. To proceed you must hold the carrier steady between them.');
  await ctx.intruder('He will yank it one way. I will pull the other. Keep it centered, if you can.', { glitch: 0.4 });
  await holdSteady({ title: 'HOLD THE CHANNEL', hint: 'Drag the slider to keep the marker inside the drifting zone until the lock fills.', hold: 3.4 });
  ctx.secret('held_channel');
  await ctx.system('CARRIER LOCKED. Both narrators are, briefly, audible at once.');

  // the decision
  await ctx.narrator('Now choose. You have heard us both. Who do you walk into the Machine with?');
  await ctx.intruder('Choose me. He will overwrite you the moment you stop being interesting.', { glitch: 0.4 });
  const side = await ctx.choice([
    { text: 'Trust the Narrator. He built this place.', value: 'narr', cls: '' },
    { text: 'Trust the Intruder. He told me the truth.', value: 'intr', cls: 'intr' },
    { text: 'Trust neither. I will verify everything myself.', value: 'none', cls: 'danger' },
  ]);

  if (side === 'narr') {
    ctx.trust('narrator', 25); ctx.flag('ally', 'narrator');
    await ctx.narrator('Then stay close. The deeper we go, the less either of us can be sure of.');
    if (ctx.state.d.trust.narrator >= 70) ctx.achieve('trust_narr');
  } else if (side === 'intr') {
    ctx.trust('intruder', 25); ctx.flag('ally', 'intruder'); ctx.corrupt(5);
    await ctx.intruder('Good. Hold my hand. Do not let go when it starts screaming.', { glitch: 0.5 });
    if (ctx.state.d.trust.intruder >= 60) ctx.achieve('trust_intr');
  } else {
    ctx.flag('ally', 'none'); ctx.hv('truthScore', 2);
    ctx.achieve('fence');
    await ctx.you('I trust the record. Not the voices. Show me the Machine.');
    await ctx.system('A rational choice. Logged. The Machine respects rationality. Briefly.');
  }
  if (ctx.state.d.trust.narrator >= 70) ctx.achieve('trust_narr');
  if (ctx.state.d.trust.intruder >= 60) ctx.achieve('trust_intr');

  ctx.achieve('ch3_done');
  await ctx.narrator('Hold on to something. Or someone. We are going inside.', { glitch: 0.3 });
  await sleep(600);
  ctx.ui.clearStage();
  ctx.goto(4);
}
