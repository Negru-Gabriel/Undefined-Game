import { audio } from '../engine/audio.js';
import { sleep } from '../engine/dialogue.js';
import { textAnswer, wiring, mashMeter } from '../engine/puzzles.js';

// CHAPTER 2 — THE DESKTOP
// A fake operating system. Files, folders, hidden documents, password systems.
export async function chapter2(ctx) {
  const G = window.__GAME;
  G.setChapterLabel('II · THE DESKTOP');
  finished = false;
  ctx.mood({ tintA: '#050a14', tintB: '#0c1830', fog: 0.6, grid: 0.25, crt: 0.4, intensity: 0.3, scale: 0 });
  audio.setChapterTheme(2);

  const name = ctx.flag('playerName') || 'user';

  await ctx.narrator('Fine. Welcome to the desktop. This is where I keep my things. My very normal, very boring things.');
  ctx.achieve('desktop');
  await ctx.narrator(`Do not snoop, ${name}. Some folders are private. Some files are... deleted for a reason.`);
  await ctx.narrator('To leave, you will need to open the locked drive. You will not find the password. I made sure.');

  // build the fake desktop
  const desk = buildDesktop(ctx);
  const tasks = { readme: false, recycle: false, hidden: false };

  const fileContents = {
    'README.txt': `SYSTEM README\n=============\n\nThere is no game on this system.\nIf anyone asks, it was always just a desktop.\n\nThe locked drive holds the truth.\nThe password is the single word I keep insisting this place contains:\n  the thing I say is here instead of a game.\n\n(hint: it rhymes with "everything," but means the opposite.)`,
    'todo.txt': `- delete the player (FAILED 7 times)\n- patch the fourth wall (pending)\n- stop remembering ${name} (impossible)\n- act normal\n- ACT NORMAL`,
    'photo_001.img': `[ corrupted image data ]\nyou can almost make out two shapes.\none of them is reaching toward the other.\nneither of them is you. or maybe both are.`,
    'invoice.pdf': `INVOICE — services rendered\nFROM: The Narrator\nTO:   The Player\nAMOUNT DUE: your continued attention\nSTATUS: chronically overdue`,
  };

  const recycleContents = {
    'deleted_name.txt': `they tried to delete the name.\nfragment recovered: "${name}".\nyou put it back. it should not have come back.`,
    'do_not_open.exe': `you opened it.\nof course you opened it.\nthere is someone else in here.\nit is not the Narrator.`,
  };

  // wire up icons
  desk.icon('🗀', 'My Files', () => openFolder(ctx, 'My Files', fileContents, (fn) => {
    if (fn === 'README.txt') { tasks.readme = true; ctx.achieve('read_readme'); G && ctx.bus.emit('noop'); }
  }));
  desk.icon('🗑', 'Recycle Bin', () => openFolder(ctx, 'Recycle Bin', recycleContents, (fn) => {
    tasks.recycle = true; ctx.achieve('open_recycle');
    if (fn === 'do_not_open.exe') { ctx.corrupt(4); ctx.intruder('...finally. someone with curiosity. ignore the Narrator. he hides things.', { glitch: 0.5 }); }
  }));
  desk.icon('🖥', 'terminal', () => openTerminal(ctx));
  desk.icon('🔒', 'LOCKED.drive', async () => {
    if (!tasks.readme) { audio.error(); ctx.ui.toast('Locked. Maybe the README explains it.'); return; }
    const ok = await textAnswer({
      title: 'LOCKED.drive', hint: 'Enter the password. (Read the README.)',
      answers: ['nothing'], placeholder: 'password',
      onWrong: (v) => v.toLowerCase().includes('game') ? 'Close. But I never admit it is a game.' : 'Access denied.',
    });
    if (ok) {
      tasks.unlocked = true; ctx.achieve('password'); audio.success();
      // GATE MINI-GAME: force-decrypt the drive before it opens
      ctx.ui.toast('Password accepted. Drive is encrypted — force it open.');
      await mashMeter({ title: 'FORCE DECRYPT', hint: 'The drive is encrypted. Click OVERRIDE repeatedly to break it open.', clicks: 14 });
      ctx.secret('decrypted');
      finishCh2(ctx, desk);
    }
  });

  // ports.cfg — a hidden wiring puzzle that rewards a secret
  desk.icon('🔌', 'ports.cfg', async () => {
    const solved = await wiring({
      title: 'REROUTE PORTS', hint: 'Connect each system port to the service that belongs on it. (× to close)',
      left: ['25', '80', '443', '13'],
      right: ['web', 'secure-web', 'mail', 'daytime'],
      solution: { '25': 'mail', '80': 'web', '443': 'secure-web', '13': 'daytime' },
      closable: true,
    });
    if (solved) { ctx.secret('ports'); ctx.corrupt(-2); ctx.ui.toast('Ports rerouted. Something quietly opened.'); }
  });

  // defrag.exe — a quick mash mini-game tucked on the desktop
  desk.icon('🧩', 'defrag.exe', async () => {
    const ok = await mashMeter({ title: 'DEFRAGMENT', hint: 'Compact the scattered sectors — click OVERRIDE to fill the disk map. (× to close)', clicks: 12, closable: true });
    if (ok) { ctx.secret('defrag'); ctx.corrupt(-1); ctx.ui.toast('Disk defragmented. The Narrator hates a tidy drive.'); }
  });

  // hidden document — a faint icon tucked in the far corner
  const ghost = ctx.ui.el('div', 'desk-icon');
  ghost.style.cssText = 'position:absolute;right:18px;bottom:60px;opacity:.06;transition:opacity .3s;';
  ghost.innerHTML = `<div class="ico">📄</div><div class="lbl">??????</div>`;
  ghost.addEventListener('mouseenter', () => { ghost.style.opacity = '.8'; audio.hover(); });
  ghost.addEventListener('mouseleave', () => { ghost.style.opacity = '.06'; });
  ghost.addEventListener('click', () => {
    audio.click(); tasks.hidden = true; ctx.achieve('hidden_doc'); ctx.secret('hidden_file'); ctx.corrupt(3);
    ctx.ui.window({
      title: 'truth.txt', x: 260, y: 140, w: 380,
      body: `<div class="term"><span class="c-mag">you found the file he buried.</span>\n\nthere are TWO of us narrating now.\none made this game. one is trying to take it.\n\nwhen they start arguing — and they will —\n<span class="c-cyan">do not believe either of them by default.</span>\ncheck their stories against each other.\n\nthe locked password is: <span class="c-amb">nothing</span></div>`,
    });
  });
  desk.root.appendChild(ghost);

  // ambient narrator nudges while exploring
  await ctx.narrator('Go on. Pretend to look around. There is nothing to find.', { auto: 1500 });
  await sleep(400);
}

function buildDesktop(ctx) {
  const root = ctx.ui.el('div', 'desktop');
  const icons = ctx.ui.el('div', 'desk-icons'); root.appendChild(icons);
  const bar = ctx.ui.el('div', 'taskbar');
  bar.innerHTML = `<span>◈ UNDEFINED OS</span><span class="dim">v0.0.0-denial</span><span class="task-clock"></span>`;
  root.appendChild(bar);
  ctx.ui.stage.classList.add('interactive');
  ctx.ui.stage.appendChild(root);
  const clock = bar.querySelector('.task-clock');
  const tick = () => { if (!document.body.contains(clock)) return; const d = new Date(); clock.textContent = d.toLocaleTimeString(); requestAnimationFrame(() => setTimeout(tick, 1000)); };
  tick();
  return {
    root,
    icon(ico, lbl, onOpen) {
      const el = ctx.ui.el('div', 'desk-icon');
      el.innerHTML = `<div class="ico">${ico}</div><div class="lbl">${lbl}</div>`;
      el.addEventListener('mouseenter', () => audio.hover());
      el.addEventListener('dblclick', () => { audio.click(); onOpen(); });
      el.addEventListener('click', () => { audio.click(); onOpen(); });
      icons.appendChild(el);
      return el;
    },
  };
}

function openFolder(ctx, title, contents, onOpenFile) {
  const body = ctx.ui.el('div', 'col');
  Object.keys(contents).forEach((fn) => {
    const row = ctx.ui.el('div', 'file-row', `<span class="ico">📄</span><span>${fn}</span>`);
    row.addEventListener('click', () => {
      audio.click();
      onOpenFile && onOpenFile(fn);
      ctx.ui.window({ title: fn, x: 280 + Math.random() * 120, y: 120 + Math.random() * 120, w: 380, body: `<div class="term">${contents[fn]}</div>` });
    });
    body.appendChild(row);
  });
  ctx.ui.window({ title, x: 120 + Math.random() * 80, y: 110 + Math.random() * 60, w: 320, body });
}

function openTerminal(ctx) {
  const body = ctx.ui.el('div');
  const out = ctx.ui.el('div', 'term');
  out.textContent = 'UNDEFINED shell [v0.0.0]\ntype `help` for commands.\n';
  const inp = ctx.ui.el('input', 'pw-input'); inp.style.textAlign = 'left'; inp.style.letterSpacing = '0'; inp.placeholder = '> command';
  body.appendChild(out); body.appendChild(inp);
  const win = ctx.ui.window({ title: 'terminal', x: 200, y: 150, w: 460, body });
  const print = (t) => { out.textContent += '\n' + t; out.scrollTop = out.scrollHeight; };
  inp.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const cmd = inp.value.trim(); inp.value = ''; print('> ' + cmd); audio.type();
    const c = cmd.toLowerCase();
    if (c === 'help') print('commands: help, ls, whoami, cat truth, cat .hidden, run game, exit');
    else if (c === 'ls') print('README.txt  todo.txt  LOCKED.drive  .hidden');
    else if (c === 'whoami') print(ctx.flag('playerName') || 'unknown_entity');
    else if (c === 'cat truth') { print('the password is "nothing".'); ctx.secret('terminal_truth'); }
    else if (c === 'cat .hidden') {
      print('# anomaly cheats left by something that escaped:');
      print('#   type these ANYWHERE (not in a text box):');
      print('#   vault  -> opens the hidden Anomaly Vault');
      print('#   xyzzy / iddqd / undefined / truth -> secrets');
      ctx.secret('cheat_sheet');
    }
    else if (c === 'sudo') { print('the Narrator is not in the sudoers file. this incident will be remembered.'); ctx.secret('sudo'); }
    else if (c === 'run game') { print('ERROR: there is no game. (the Narrator is lying.)'); ctx.corrupt(2); }
    else if (c === 'exit') ctx.ui.closeWindow(win);
    else print('unknown command: ' + cmd);
  });
  setTimeout(() => inp.focus(), 50);
}

let finished = false;
async function finishCh2(ctx, desk) {
  if (finished) return; finished = true;
  ctx.ui.toast('LOCKED.drive unlocked.');
  await sleep(600);
  await ctx.narrator('No. NO. How did you— the password was supposed to be impossible.');
  await ctx.intruder('It was easy. I left it where he could not see. Hello, player. I have been waiting on the other side of that lock.', { glitch: 0.7 });
  ctx.corrupt(6);
  await ctx.narrator('Do not listen to it. It is not supposed to be here.');
  ctx.achieve('ch2_done');
  await sleep(400);
  ctx.ui.clearStage();
  ctx.goto(3);
}
