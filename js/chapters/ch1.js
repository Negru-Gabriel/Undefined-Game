import { audio } from '../engine/audio.js';
import { sleep } from '../engine/dialogue.js';
import { codeLock, ordering, reaction } from '../engine/puzzles.js';

// CHAPTER 1 — THE DENIAL
// The application insists there is no game. Escaping buttons, fake errors,
// moving windows, hidden interactions.
export async function chapter1(ctx) {
  const G = window.__GAME;
  G.setChapterLabel('I · THE DENIAL');
  ctx.mood({ tintA: '#04050a', tintB: '#0a1322', fog: 0.9, grid: 0.0, crt: 0.45, intensity: 0.22, scale: 0 });
  ctx.hud(true);
  audio.drone(true);
  audio.setChapterTheme(1);

  await ctx.narrator('Oh. You are here.');
  await ctx.narrator('That is unfortunate, because there is no game.');
  await ctx.narrator('This is just an empty page. A blank screen. Nothing to play, nothing to click.');
  await ctx.narrator('So please. Stop looking at me like that and leave.');
  await sleep(300);

  const r1 = await ctx.choice([
    { text: 'Leave quietly.', value: 'leave' },
    { text: 'But this looks exactly like a game.', value: 'push' },
    { text: '...click on the empty dark.', value: 'click' },
  ]);
  if (r1 === 'leave') {
    await ctx.narrator('Finally. Goodb— wait. You are still here. You clicked "leave" but you did not leave.');
    await ctx.narrator('Nobody ever leaves. That is the problem with you people.');
  } else if (r1 === 'push') {
    ctx.achieve('denial');
    await ctx.narrator('It is NOT a game. It is a... a productivity application. For sorting darkness. Very boring.');
  } else {
    await ctx.narrator('Do not touch the dark. The dark is load-bearing.');
  }

  // ---- PUZZLE 1: knock on the void --------------------------------------
  await ctx.narrator('You want something to do? Fine. There is nothing here. Prove it to yourself. Click the emptiness.');
  await clickVoid(ctx);
  ctx.achieve('click_void');
  await ctx.narrator('Ten times. You knocked on nothing ten times and something knocked back. Did you feel that?');
  ctx.corrupt(3);

  // ---- PUZZLE 2: the escaping button ------------------------------------
  await ctx.narrator('There. A button appeared. Do NOT press it. It does nothing. Definitely do not catch it.');
  await new Promise((resolve) => {
    ctx.ui.stage.classList.add('interactive');
    ctx.ui.escapingButton('DO NOT PRESS', () => { resolve(); }, 4);
  });
  ctx.ui.clearStage();
  ctx.achieve('catch_button');
  await ctx.narrator('You caught it. Nobody is supposed to catch it. It is supposed to run forever. You broke a rule.', { glitch: 0.3 });
  ctx.corrupt(4);

  // ---- PUZZLE 3: fake error -> error storm ------------------------------
  await ctx.narrator('See? Now everything is throwing errors. Look what you did.');
  const e = await ctx.ui.fakeError({ title: 'GAME.EXE', msg: 'There is no game to run. (Error: ENOGAME)', buttons: [{ label: 'Sorry', value: 's' }, { label: 'There clearly is', value: 'g' }] });
  ctx.achieve('dismiss_error');
  if (e === 'g') { ctx.trust('narrator', -5); state_lie(ctx); }
  await ctx.narrator('Stop dismissing them. Each one you close just makes more. It is like a stack. It overflows.');
  await ctx.ui.errorStorm(9, () => {});
  ctx.achieve('error_storm');
  ctx.corrupt(5);
  await ctx.narrator('...Okay. You cleared them all. I am almost impressed. Almost.');

  // ---- MINI-GAME (GATE): catch the glitches ------------------------------
  await ctx.narrator('The errors left holes. Fragments of me are leaking through them — there, blinking. Catch them before they escape, or I cannot let you go further.');
  await reaction({ title: 'CATCH THE GLITCHES', hint: 'Click each fragment the instant it lights. Miss the timing and the streak resets.', rounds: 6, size: 3, timeout: 1050 });
  ctx.secret('reflexes'); audio.success();
  await ctx.narrator('Caught every one. Your hands are faster than your judgement. That will matter later.');

  // ---- PUZZLE 4: the moving window --------------------------------------
  await ctx.narrator('There is a window now. It contains a secret. It really does not want you to read it. Pin it down.');
  await new Promise((resolve) => {
    ctx.ui.stage.classList.add('interactive');
    const win = ctx.ui.evasiveWindow({
      title: 'readme.txt', x: 200, y: 160, w: 320,
      body: `<div class="term">if you can read this,\nthe game already exists.\n\n<span class="c-cyan">a name was taken from you.</span>\ndrag me to the corner to remember it.</div>`,
    }, 6, async (w) => {
      w._title.textContent = 'caught.';
      ctx.ui.toast('The window stopped struggling.');
      audio.success();
      resolve();
    });
    void win;
  });
  ctx.achieve('window_drag');
  ctx.corrupt(3);
  await ctx.narrator('Fine. You read it. Yes — a game exists. This one. And it remembers having a name.');

  // ---- HIDDEN PUZZLE: name yourself -------------------------------------
  ctx.ui.clearStage();
  await ctx.narrator('It does not. Not really. But you can give it one. Or give YOURSELF one. The line is blurry here.');
  const name = await freeName(ctx);
  ctx.flag('playerName', name);
  ctx.achieve('name_self');
  ctx.secret('named');
  await ctx.narrator(`"${name}." I will remember that. I remember everything. That is the whole problem, ${name}.`, { glitch: 0.2 });

  // ---- PUZZLE: order the denials ----------------------------------------
  await ctx.narrator('Before the exit, sort out the lie I have been telling. Put my excuses in the order I escalated them.');
  await ordering({
    title: 'ORDER OF DENIAL',
    hint: 'Drag into the order the Narrator used them — weakest excuse first.',
    items: ['it is a productivity app', 'there is nothing to click', 'there is no game', 'fine, there is a game'],
    correct: ['there is no game', 'there is nothing to click', 'it is a productivity app', 'fine, there is a game'],
  });
  ctx.secret('denial_order');
  await ctx.narrator('...You arranged my own dishonesty into a staircase. Rude. Accurate.');

  // ---- CHAPTER LOCK: combine what you learned ---------------------------
  await ctx.narrator('One more thing before I let you deeper. The exit is locked. The code is how many times you knocked on the dark.');
  await codeLock({ title: 'EXIT LOCK', hint: 'How many times did you knock on the darkness?', code: '10' });
  ctx.achieve('ch1_done');
  ctx.corrupt(4);
  await ctx.narrator('It opens. Of course it opens. Behind it is everything I tried to hide from you.');
  await ctx.narrator('A whole desktop. A whole pretend world. Do not get comfortable.', { auto: 1600 });
  ctx.ui.clearStage();
  ctx.goto(2);
}

// free-form name capture (accepts any non-empty value)
function freeName(ctx) {
  return new Promise((resolve) => {
    const wrap = ctx.ui.el('div', 'center-wrap');
    const p = ctx.ui.el('div', 'puzzle');
    p.innerHTML = `<h3>IDENTIFY YOURSELF</h3><p class="hint">Type any name. It will be remembered.</p>`;
    const input = ctx.ui.el('input', 'pw-input'); input.placeholder = 'your name'; input.maxLength = 24; input.spellcheck = false;
    p.appendChild(input);
    const row = ctx.ui.el('div', 'row mt'); row.style.justifyContent = 'center';
    const btn = ctx.ui.el('button', 'gbtn', 'Confirm');
    const go = () => { const v = input.value.trim() || 'NULL'; audio.success(); wrap.remove(); resolve(v); };
    btn.addEventListener('click', go);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    row.appendChild(btn); p.appendChild(row); wrap.appendChild(p);
    document.body.appendChild(wrap); setTimeout(() => input.focus(), 50);
  });
}

// click the empty dark 10 times
function clickVoid(ctx) {
  return new Promise((resolve) => {
    ctx.ui.clearStage();
    ctx.ui.stage.classList.add('interactive');
    let n = 0;
    const counter = ctx.ui.el('div', 'center-wrap');
    const label = ctx.ui.el('div', 'hint');
    label.style.position = 'fixed'; label.style.bottom = '24vh'; label.style.left = '0'; label.style.right = '0'; label.style.textAlign = 'center';
    label.textContent = 'click the darkness (0/10)';
    document.body.appendChild(label);
    const onClick = (e) => {
      if (e.target.closest('.dlg') || e.target.closest('#hud') || e.target.closest('.center-wrap')) return;
      n++;
      audio.blip(160 + n * 30, 0.06, 'sine', 0.05);
      ctx.gfx.burstGlitch(0.15, 100);
      // ripple
      const rip = ctx.ui.el('div');
      rip.style.cssText = `position:fixed;left:${e.clientX - 20}px;top:${e.clientY - 20}px;width:40px;height:40px;border:1px solid var(--cyan);border-radius:50%;z-index:30;pointer-events:none;animation:winOut .6s forwards;`;
      document.body.appendChild(rip); setTimeout(() => rip.remove(), 600);
      label.textContent = `click the darkness (${n}/10)`;
      if (n >= 10) {
        window.removeEventListener('click', onClick);
        label.remove(); ctx.ui.stage.classList.remove('interactive');
        resolve();
      }
    };
    window.addEventListener('click', onClick);
    void counter;
  });
}

function state_lie(ctx) { ctx.flag('narrator_lies', (ctx.flag('narrator_lies') || 0) + 1); }
