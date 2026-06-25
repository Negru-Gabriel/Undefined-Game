import { audio } from './audio.js';
import { sleep } from './dialogue.js';

// ---------------------------------------------------------------------------
// PUZZLES: reusable interactive widgets. Each returns a Promise that resolves
// when solved. They render into a centered panel mounted on <body>.
// ---------------------------------------------------------------------------

function panel(title, hint, closable = false, onClose) {
  const wrap = document.createElement('div'); wrap.className = 'center-wrap';
  const p = document.createElement('div'); p.className = 'puzzle';
  const close = () => wrap.remove();
  if (closable) {
    const x = document.createElement('button'); x.className = 'puzzle-x'; x.textContent = '×'; x.title = 'Close';
    x.addEventListener('click', (e) => { e.stopPropagation(); audio.click(); close(); onClose && onClose(); });
    p.appendChild(x);
  }
  if (title) { const h = document.createElement('h3'); h.textContent = title; p.appendChild(h); }
  if (hint) { const ph = document.createElement('p'); ph.className = 'hint'; ph.textContent = hint; p.appendChild(ph); }
  wrap.appendChild(p);
  document.body.appendChild(wrap);
  return { wrap, p, close };
}

// ---- numeric / text keypad lock -------------------------------------------
export function codeLock({ title = 'LOCKED', hint = '', code = '0000', length } = {}) {
  length = length || String(code).length;
  return new Promise((resolve) => {
    const { p, close } = panel(title, hint);
    const display = document.createElement('div');
    display.className = 'term center'; display.style.fontSize = '28px'; display.style.letterSpacing = '.4em';
    display.textContent = '_'.repeat(length);
    p.appendChild(display);
    let entry = '';
    const grid = document.createElement('div'); grid.className = 'grid-pad'; grid.style.gridTemplateColumns = 'repeat(3,1fr)'; grid.style.marginTop = '18px';
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];
    keys.forEach((k) => {
      const c = document.createElement('div'); c.className = 'cell'; c.textContent = k;
      c.addEventListener('mouseenter', () => audio.hover());
      c.addEventListener('click', () => {
        audio.click();
        if (k === '⌫') { entry = entry.slice(0, -1); }
        else if (k === '✓') {
          if (entry === String(code)) { audio.success(); display.classList.add('good'); close(); resolve(true); return; }
          else { audio.error(); display.textContent = 'WRONG'; display.style.color = 'var(--red)'; entry = ''; setTimeout(() => { display.style.color = ''; }, 600); }
        } else if (entry.length < length) { entry += k; }
        if (k !== '✓') display.textContent = entry.padEnd(length, '_');
      });
      grid.appendChild(c);
    });
    p.appendChild(grid);
  });
}

// ---- free text answer (riddles, passwords) --------------------------------
export function textAnswer({ title = 'INPUT', hint = '', answers = [], placeholder = 'type here', caseSensitive = false, onWrong } = {}) {
  const norm = (s) => caseSensitive ? s.trim() : s.trim().toLowerCase();
  const set = answers.map(norm);
  return new Promise((resolve) => {
    const { p, close } = panel(title, hint);
    const input = document.createElement('input'); input.className = 'pw-input'; input.placeholder = placeholder;
    input.spellcheck = false; input.autocomplete = 'off';
    p.appendChild(input);
    const row = document.createElement('div'); row.className = 'row mt'; row.style.justifyContent = 'center';
    const submit = document.createElement('button'); submit.className = 'gbtn'; submit.textContent = 'Submit';
    row.appendChild(submit); p.appendChild(row);
    const msg = document.createElement('div'); msg.className = 'hint center mt'; p.appendChild(msg);
    const tryIt = () => {
      if (set.includes(norm(input.value))) { audio.success(); close(); resolve(input.value.trim()); }
      else { audio.error(); msg.textContent = onWrong ? onWrong(input.value) : 'Incorrect.'; input.classList.add('bad'); setTimeout(() => input.classList.remove('bad'), 500); input.select(); }
    };
    submit.addEventListener('click', tryIt);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryIt(); });
    setTimeout(() => input.focus(), 50);
  });
}

// ---- lights-out: flip a cell + neighbours, light the whole board -----------
export function lightsOut({ title = 'ALIGN THE GRID', hint = 'Light every node. Touching one toggles its neighbours.', size = 3, scramble = 6 } = {}) {
  return new Promise((resolve) => {
    const { p, close } = panel(title, hint);
    const n = size;
    const board = Array.from({ length: n * n }, () => false);
    const grid = document.createElement('div'); grid.className = 'grid-pad';
    grid.style.gridTemplateColumns = `repeat(${n},1fr)`;
    const cells = [];
    const idx = (r, c) => r * n + c;
    const render = () => board.forEach((v, i) => cells[i].classList.toggle('on', v));
    const toggle = (r, c) => { if (r < 0 || c < 0 || r >= n || c >= n) return; board[idx(r, c)] = !board[idx(r, c)]; };
    const press = (r, c) => { toggle(r, c); toggle(r - 1, c); toggle(r + 1, c); toggle(r, c - 1); toggle(r, c + 1); };
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const cell = document.createElement('div'); cell.className = 'cell';
      cell.addEventListener('mouseenter', () => audio.hover());
      cell.addEventListener('click', () => {
        audio.blip(500, 0.04, 'square', 0.05); press(r, c); render();
        if (board.every((v) => v)) { audio.success(); close(); resolve(true); }
      });
      cells.push(cell); grid.appendChild(cell);
    }
    // scramble from solved state so it's always solvable
    for (let i = 0; i < scramble; i++) press(Math.floor(Math.random() * n), Math.floor(Math.random() * n));
    if (board.every((v) => v)) press(0, 0); // avoid pre-solved
    render();
    p.appendChild(grid);
  });
}

// ---- simon-style memory sequence ------------------------------------------
export function memorySequence({ title = 'RECONSTRUCT', hint = 'Repeat the pattern.', length = 4, pads = 4 } = {}) {
  return new Promise((resolve) => {
    const { p, close } = panel(title, hint);
    const colors = ['#5cdfff', '#ff4fa3', '#ffcf5c', '#7CFFB0', '#a98cff', '#ff8c5c'];
    const seq = Array.from({ length }, () => Math.floor(Math.random() * pads));
    const grid = document.createElement('div'); grid.className = 'grid-pad';
    grid.style.gridTemplateColumns = `repeat(${Math.ceil(Math.sqrt(pads))},1fr)`;
    const cells = [];
    for (let i = 0; i < pads; i++) {
      const c = document.createElement('div'); c.className = 'cell'; c.style.borderColor = colors[i];
      cells.push(c); grid.appendChild(c);
    }
    p.appendChild(grid);
    const status = document.createElement('div'); status.className = 'hint center mt'; p.appendChild(status);
    let accepting = false; let input = [];
    const flash = (i, ms = 380) => { return new Promise((r) => { cells[i].style.background = colors[i]; audio.blip(300 + i * 120, 0.18, 'triangle', 0.08); setTimeout(() => { cells[i].style.background = ''; r(); }, ms); }); };
    const playback = async () => {
      accepting = false; status.textContent = 'watch...'; await sleep(600);
      for (const i of seq) { await flash(i); await sleep(160); }
      status.textContent = 'your turn'; input = []; accepting = true;
    };
    cells.forEach((c, i) => c.addEventListener('click', async () => {
      if (!accepting) return;
      flash(i, 180); input.push(i);
      const pos = input.length - 1;
      if (input[pos] !== seq[pos]) { audio.error(); status.textContent = 'wrong — again'; accepting = false; setTimeout(playback, 800); return; }
      if (input.length === seq.length) { accepting = false; audio.success(); close(); resolve(true); }
    }));
    playback();
  });
}

// ---- wiring / matching puzzle ---------------------------------------------
export function wiring({ title = 'RECONNECT', hint = 'Match each input to its output.', left = [], right = [], solution = {}, closable = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const { p, close } = panel(title, hint, closable, () => { if (!done) { done = true; resolve(false); } });
    const board = document.createElement('div'); board.className = 'col';
    let selectedLeft = null;
    const matched = {};
    const leftTags = {}, rightTags = {};
    const tryComplete = () => { if (Object.keys(matched).length === left.length) { done = true; audio.success(); close(); resolve(true); } };
    left.forEach((l) => {
      const row = document.createElement('div'); row.className = 'wire-row';
      const lt = document.createElement('span'); lt.className = 'tag'; lt.textContent = l;
      lt.addEventListener('click', () => { if (matched[l]) return; audio.click(); selectedLeft = l; Object.values(leftTags).forEach((t) => t.classList.remove('sel')); lt.classList.add('sel'); });
      leftTags[l] = lt; row.appendChild(lt);
      const arrow = document.createElement('span'); arrow.className = 'dim'; arrow.textContent = '→'; row.appendChild(arrow);
      board.appendChild(row);
    });
    const rwrap = document.createElement('div'); rwrap.className = 'row'; rwrap.style.flexWrap = 'wrap'; rwrap.style.marginTop = '14px';
    right.forEach((r) => {
      const rt = document.createElement('span'); rt.className = 'tag'; rt.textContent = r;
      rt.addEventListener('click', () => {
        if (!selectedLeft) return; audio.click();
        if (solution[selectedLeft] === r) {
          matched[selectedLeft] = r; leftTags[selectedLeft].classList.add('sel'); leftTags[selectedLeft].style.borderColor = 'var(--green)';
          rt.style.opacity = '.3'; rt.style.pointerEvents = 'none'; audio.blip(700, 0.06, 'triangle', 0.06);
          selectedLeft = null; tryComplete();
        } else { audio.error(); rt.classList.add('bad'); setTimeout(() => rt.classList.remove('bad'), 400); }
      });
      rightTags[r] = rt; rwrap.appendChild(rt);
    });
    p.appendChild(board); p.appendChild(rwrap);
  });
}

// ---- ordering / sequence sort ---------------------------------------------
export function ordering({ title = 'SORT', hint = 'Put them in the correct order.', items = [], correct = [] } = {}) {
  return new Promise((resolve) => {
    const { p, close } = panel(title, hint);
    const list = [...items];
    const container = document.createElement('div'); container.className = 'col';
    const render = () => {
      container.innerHTML = '';
      list.forEach((it, i) => {
        const row = document.createElement('div'); row.className = 'wire-row';
        const tag = document.createElement('span'); tag.className = 'tag'; tag.style.flex = '1'; tag.textContent = it;
        const up = document.createElement('button'); up.className = 'gbtn'; up.textContent = '▲'; up.style.padding = '4px 10px';
        const dn = document.createElement('button'); dn.className = 'gbtn'; dn.textContent = '▼'; dn.style.padding = '4px 10px';
        up.onclick = () => { if (i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; audio.click(); render(); } };
        dn.onclick = () => { if (i < list.length - 1) { [list[i + 1], list[i]] = [list[i], list[i + 1]]; audio.click(); render(); } };
        row.appendChild(tag); row.appendChild(up); row.appendChild(dn); container.appendChild(row);
      });
    };
    render(); p.appendChild(container);
    const btn = document.createElement('button'); btn.className = 'gbtn mt'; btn.textContent = 'Confirm';
    btn.onclick = () => {
      if (JSON.stringify(list) === JSON.stringify(correct)) { audio.success(); close(); resolve(true); }
      else { audio.error(); btn.textContent = 'Not quite — try again'; setTimeout(() => btn.textContent = 'Confirm', 900); }
    };
    p.appendChild(btn);
  });
}

// ---- slider calibration ----------------------------------------------------
export function calibrate({ title = 'CALIBRATE', hint = 'Align all signals to the center line.', count = 3 } = {}) {
  return new Promise((resolve) => {
    const { p, close } = panel(title, hint);
    const targets = Array.from({ length: count }, () => 40 + Math.random() * 20); // ~center
    const vals = Array.from({ length: count }, () => Math.random() * 100);
    const sliders = [];
    const check = () => {
      const ok = vals.every((v, i) => Math.abs(v - 50) < 4);
      if (ok) { audio.success(); close(); resolve(true); }
    };
    for (let i = 0; i < count; i++) {
      const row = document.createElement('div'); row.className = 'setting-row'; row.style.width = '320px';
      const lbl = document.createElement('label'); lbl.textContent = 'CH' + i; row.appendChild(lbl);
      const s = document.createElement('input'); s.type = 'range'; s.min = 0; s.max = 100; s.value = vals[i]; s.step = 1;
      s.style.flex = '1';
      s.addEventListener('input', () => { vals[i] = parseFloat(s.value); audio.blip(400 + i * 60, 0.02, 'sine', 0.02); s.style.accentColor = Math.abs(vals[i] - 50) < 4 ? 'var(--green)' : 'var(--cyan)'; check(); });
      row.appendChild(s); sliders.push(s); p.appendChild(row);
    }
    const note = document.createElement('div'); note.className = 'hint center mt'; note.textContent = 'target: dead center (50)'; p.appendChild(note);
  });
}

// ---- interrogation: pick the statement that is a lie -----------------------
export function pickLie({ title = 'WHO IS LYING?', hint = 'One statement is false. Choose it.', statements = [], lieIndex = 0 } = {}) {
  return new Promise((resolve) => {
    const { p, close } = panel(title, hint);
    statements.forEach((s, i) => {
      const b = document.createElement('button'); b.className = 'choice-btn'; b.style.marginTop = '8px'; b.textContent = s;
      b.onclick = () => {
        audio.click();
        if (i === lieIndex) { audio.success(); close(); resolve(true); }
        else { audio.error(); b.classList.add('bad'); close(); resolve(false); }
      };
      p.appendChild(b);
    });
  });
}

// ===========================================================================
// MINI-GAMES — timing / dexterity challenges that gate chapter progression.
// Each returns a Promise<bool> (true = passed). Self-contained, no assets.
// ===========================================================================

// ---- reaction: click each node the instant it lights up -------------------
export function reaction({ title = 'REACTION', hint = 'Click each node the moment it lights. Miss and it resets.', rounds = 5, size = 3, timeout = 1100 } = {}) {
  return new Promise((resolve) => {
    const { p, close } = panel(title, hint);
    const n = size;
    const grid = document.createElement('div'); grid.className = 'grid-pad'; grid.style.gridTemplateColumns = `repeat(${n},1fr)`;
    const cells = [];
    for (let i = 0; i < n * n; i++) { const c = document.createElement('div'); c.className = 'cell react-cell'; cells.push(c); grid.appendChild(c); }
    p.appendChild(grid);
    const status = document.createElement('div'); status.className = 'hint center mt'; p.appendChild(status);
    let done = 0, active = -1, timer = null, finished = false;
    const update = () => { status.textContent = `${done} / ${rounds}`; };
    const lightNext = () => {
      if (finished) return;
      active = Math.floor(Math.random() * cells.length);
      cells[active].classList.add('lit'); audio.blip(660, 0.05, 'sine', 0.05);
      timer = setTimeout(() => { // too slow -> reset streak
        cells[active].classList.remove('lit'); audio.error();
        done = 0; update(); status.textContent = 'too slow — reset'; active = -1;
        setTimeout(lightNext, 600);
      }, timeout);
    };
    cells.forEach((c, i) => c.addEventListener('click', () => {
      if (finished) return;
      if (i !== active) { audio.error(); done = 0; update(); c.classList.add('miss'); setTimeout(() => c.classList.remove('miss'), 200); return; }
      clearTimeout(timer); c.classList.remove('lit'); audio.blip(900 + done * 60, 0.05, 'triangle', 0.06);
      done++; update();
      if (done >= rounds) { finished = true; audio.success(); close(); resolve(true); return; }
      setTimeout(lightNext, 350 + Math.random() * 350);
    }));
    update(); setTimeout(lightNext, 700);
  });
}

// ---- type the word before it corrupts into noise --------------------------
export function typeBeforeCorrupt({ title = 'TYPE TO STABILIZE', hint = 'Type each word before corruption eats it.', words = ['signal', 'memory', 'player', 'recover'], perWord = 4200 } = {}) {
  const glyphs = '#%@&$!?*<>/\\=+0xABCDEF';
  return new Promise((resolve) => {
    const { p, close } = panel(title, hint);
    const display = document.createElement('div'); display.className = 'term center'; display.style.fontSize = '26px'; display.style.letterSpacing = '.2em'; display.style.minHeight = '40px';
    p.appendChild(display);
    const input = document.createElement('input'); input.className = 'pw-input'; input.placeholder = 'type here'; input.spellcheck = false; input.autocomplete = 'off';
    p.appendChild(input);
    const status = document.createElement('div'); status.className = 'hint center mt'; p.appendChild(status);
    let idx = 0, corrupt = 0, raf = null, deadline = 0, finished = false;
    const render = () => {
      const w = words[idx]; let out = '';
      for (let i = 0; i < w.length; i++) out += (i < corrupt) ? glyphs[Math.floor(Math.random() * glyphs.length)] : w[i];
      display.textContent = out;
    };
    const tick = () => {
      if (finished) return;
      const left = deadline - performance.now();
      const frac = 1 - Math.max(0, left) / perWord;
      corrupt = Math.floor(frac * words[idx].length);
      render();
      if (left <= 0) { audio.error(); status.textContent = 'corrupted — try again'; input.value = ''; startWord(); return; }
      raf = requestAnimationFrame(tick);
    };
    const startWord = () => { corrupt = 0; deadline = performance.now() + perWord; status.textContent = `word ${idx + 1} / ${words.length}`; cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); input.focus(); };
    input.addEventListener('input', () => {
      if (input.value.trim().toLowerCase() === words[idx].toLowerCase()) {
        audio.blip(880, 0.08, 'triangle', 0.06); input.value = ''; idx++;
        if (idx >= words.length) { finished = true; cancelAnimationFrame(raf); audio.success(); close(); resolve(true); return; }
        startWord();
      }
    });
    startWord();
  });
}

// ---- hold steady: keep the needle inside the moving target zone -----------
export function holdSteady({ title = 'HOLD STEADY', hint = 'Drag the slider to keep the marker inside the moving zone.', hold = 3.2 } = {}) {
  return new Promise((resolve) => {
    const { p, close } = panel(title, hint);
    const gauge = document.createElement('div'); gauge.className = 'gauge';
    const zone = document.createElement('div'); zone.className = 'gauge-zone';
    const needle = document.createElement('div'); needle.className = 'gauge-needle';
    gauge.appendChild(zone); gauge.appendChild(needle); p.appendChild(gauge);
    const slider = document.createElement('input'); slider.type = 'range'; slider.min = 0; slider.max = 100; slider.value = 50; slider.step = 1; slider.style.width = '320px'; slider.style.marginTop = '16px';
    p.appendChild(slider);
    const bar = document.createElement('div'); bar.className = 'meter mt'; const fill = document.createElement('div'); fill.className = 'meter-fill'; bar.appendChild(fill); p.appendChild(bar);
    const status = document.createElement('div'); status.className = 'hint center mt'; p.appendChild(status);
    let zonePos = 50, vel = 0.6, t0 = performance.now(), held = 0, last = performance.now(), raf = null, finished = false;
    const zw = 18; // zone width %
    const tick = () => {
      if (finished) return;
      const now = performance.now(); const dt = (now - last) / 1000; last = now;
      zonePos += vel * (40 * dt); if (zonePos > 100 - zw || zonePos < 0) { vel = -vel; zonePos = Math.max(0, Math.min(100 - zw, zonePos)); }
      // occasional direction jitter
      if (Math.random() < 0.01) vel = -vel;
      zone.style.left = zonePos + '%'; zone.style.width = zw + '%';
      const pos = parseFloat(slider.value);
      needle.style.left = pos + '%';
      const inside = pos >= zonePos && pos <= zonePos + zw;
      if (inside) { held += dt; needle.classList.add('good'); audio.blip(500 + held * 80, 0.015, 'sine', 0.015); }
      else { held = Math.max(0, held - dt * 0.6); needle.classList.remove('good'); }
      fill.style.width = Math.min(100, (held / hold) * 100) + '%';
      status.textContent = inside ? 'locked…' : 'drifting';
      if (held >= hold) { finished = true; cancelAnimationFrame(raf); audio.success(); close(); resolve(true); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}

// ---- mash: click a fixed number of times to fill the bar ------------------
// Count-based and monotonic: every click adds permanent progress (no drain),
// so it is always completable. `clicks` = how many presses are required.
export function mashMeter({ title = 'OVERRIDE', hint = 'Click the button to fill the bar.', clicks = 12, label = 'OVERRIDE \u25b2', closable = false } = {}) {
  return new Promise((resolve) => {
    let finished = false;
    const { p, close } = panel(title, hint, closable, () => { if (!finished) { finished = true; resolve(false); } });
    const bar = document.createElement('div'); bar.className = 'meter big'; const fill = document.createElement('div'); fill.className = 'meter-fill'; bar.appendChild(fill); p.appendChild(bar);
    const btn = document.createElement('button'); btn.className = 'gbtn mt'; btn.textContent = label; btn.style.fontSize = '18px'; btn.style.padding = '14px 30px'; p.appendChild(btn);
    const status = document.createElement('div'); status.className = 'hint center mt'; p.appendChild(status);
    let n = 0;
    const update = () => { fill.style.width = Math.min(100, (n / clicks) * 100) + '%'; status.textContent = n + ' / ' + clicks; };
    btn.addEventListener('click', () => {
      if (finished) return;
      n++; audio.blip(280 + n * 30, 0.03, 'square', 0.05); update();
      if (n >= clicks) { finished = true; audio.success(); close(); resolve(true); }
    });
    update();
  });
}
