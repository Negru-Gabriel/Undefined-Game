import { audio } from './audio.js';
import { sleep } from './dialogue.js';

// ---------------------------------------------------------------------------
// UI: the "living interface" toolkit. Draggable windows, fleeing buttons,
// fake errors, glitch helpers, the stage for interactive puzzle content.
// ---------------------------------------------------------------------------

export class UI {
  constructor(gfx) {
    this.gfx = gfx;
    this.stage = document.getElementById('stage');
    this._z = 100;
  }

  clearStage() { this.stage.innerHTML = ''; this.stage.className = 'stage'; }

  el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  mount(node) { this.stage.appendChild(node); return node; }

  // generic button that plays sound
  button(label, onClick, cls = '') {
    const b = this.el('button', 'gbtn ' + cls, label);
    b.addEventListener('mouseenter', () => audio.hover());
    b.addEventListener('click', (e) => { e.stopPropagation(); audio.click(); onClick && onClick(e, b); });
    return b;
  }

  // A button that runs away from the pointer for `difficulty` dodges, then
  // gives up and sits still so it can actually be clicked.
  escapingButton(label, onCatch, difficulty = 4) {
    const b = this.button(label, () => {}, 'escaping');
    b.style.position = 'absolute';
    let near = 0;
    let caught = false;
    let tame = false;          // once tame, it stops fleeing
    let lastMove = 0;          // throttle relocations so it never teleports mid-click
    const place = () => {
      const pad = 80;
      const w = this.stage.clientWidth, h = this.stage.clientHeight;
      b.style.left = (pad + Math.random() * (w - pad * 2 - b.offsetWidth)) + 'px';
      b.style.top = (pad + Math.random() * (h - pad * 2 - b.offsetHeight)) + 'px';
    };
    const flee = (e) => {
      if (caught || tame) return;
      const now = performance.now();
      if (now - lastMove < 280) return;   // don't relocate more than ~3x/sec
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < 90) {
        near++;
        lastMove = now;
        audio.blip(700 + near * 40, 0.03, 'square', 0.04);
        if (near >= difficulty) {           // gives up — becomes a sitting target
          tame = true;
          b.textContent = label + ' …fine.';
          b.classList.add('tame');
        } else {
          place();
        }
        this.gfx && this.gfx.burstGlitch(0.2, 120);
      }
    };
    window.addEventListener('pointermove', flee);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      caught = true;
      window.removeEventListener('pointermove', flee);
      audio.success();
      onCatch && onCatch();
    });
    this.mount(b);
    requestAnimationFrame(place);
    b._cleanup = () => window.removeEventListener('pointermove', flee);
    return b;
  }

  // Draggable window. opts: {title, x, y, w, h, closable, onClose, cls, body(HTMLElement|string)}
  window(opts = {}) {
    const win = this.el('div', 'win ' + (opts.cls || ''));
    win.style.left = (opts.x ?? 120) + 'px';
    win.style.top = (opts.y ?? 100) + 'px';
    if (opts.w) win.style.width = opts.w + 'px';
    if (opts.h) win.style.height = opts.h + 'px';
    win.style.zIndex = ++this._z;

    const bar = this.el('div', 'win-bar');
    const title = this.el('div', 'win-title', opts.title || 'window');
    const ctrls = this.el('div', 'win-ctrls');
    if (opts.closable !== false) {
      const close = this.el('button', 'win-x', '×');
      close.addEventListener('click', (e) => { e.stopPropagation(); audio.click(); opts.onClose ? opts.onClose(win) : this.closeWindow(win); });
      ctrls.appendChild(close);
    }
    bar.appendChild(title); bar.appendChild(ctrls);
    const body = this.el('div', 'win-body');
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    win.appendChild(bar); win.appendChild(body);
    this.mount(win);

    win.addEventListener('pointerdown', () => { win.style.zIndex = ++this._z; });
    this._makeDraggable(win, bar);
    win._body = body; win._title = title;
    return win;
  }

  closeWindow(win) {
    win.classList.add('closing');
    setTimeout(() => win.remove(), 200);
  }

  _makeDraggable(win, handle) {
    let sx, sy, ox, oy, drag = false;
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.classList.contains('win-x')) return;
      drag = true; sx = e.clientX; sy = e.clientY;
      ox = parseInt(win.style.left); oy = parseInt(win.style.top);
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!drag) return;
      win.style.left = (ox + e.clientX - sx) + 'px';
      win.style.top = (oy + e.clientY - sy) + 'px';
      win._moved = true;
    });
    handle.addEventListener('pointerup', (e) => { drag = false; try { handle.releasePointerCapture(e.pointerId); } catch {} });
  }

  // A window that drifts/jumps away when you try to interact (Ch1 puzzle).
  evasiveWindow(opts, jumps = 5, onSettle) {
    const win = this.window(opts);
    let count = 0;
    const jump = () => {
      if (count >= jumps) { win.classList.remove('jittery'); onSettle && onSettle(win); return; }
      count++;
      const w = this.stage.clientWidth, h = this.stage.clientHeight;
      win.style.left = (40 + Math.random() * (w - win.offsetWidth - 80)) + 'px';
      win.style.top = (40 + Math.random() * (h - win.offsetHeight - 80)) + 'px';
      audio.blip(300, 0.05, 'sawtooth', 0.05);
      this.gfx && this.gfx.burstGlitch(0.3, 150);
    };
    win.addEventListener('mouseenter', jump);
    win._jump = jump;
    return win;
  }

  // Fake error dialog. opts: {title, msg, buttons:[{label,value}], glitch}
  fakeError(opts = {}) {
    return new Promise((resolve) => {
      audio.error();
      this.gfx && this.gfx.burstGlitch(0.4, 200);
      const overlay = this.el('div', 'error-pop');
      overlay.style.left = (opts.x ?? (window.innerWidth / 2 - 180 + (Math.random() - 0.5) * 200)) + 'px';
      overlay.style.top = (opts.y ?? (window.innerHeight / 2 - 90 + (Math.random() - 0.5) * 160)) + 'px';
      overlay.style.zIndex = ++this._z + 5000;
      const head = this.el('div', 'error-head', `<span class="error-ico">⚠</span><span>${opts.title || 'ERROR'}</span>`);
      const msg = this.el('div', 'error-msg', opts.msg || 'An undefined error has occurred.');
      const row = this.el('div', 'error-row');
      const buttons = opts.buttons || [{ label: 'OK', value: 'ok' }];
      buttons.forEach((bb) => {
        const b = this.button(bb.label, () => { overlay.remove(); resolve(bb.value); });
        row.appendChild(b);
      });
      overlay.appendChild(head); overlay.appendChild(msg); overlay.appendChild(row);
      document.body.appendChild(overlay);
      this._makeDraggable(overlay, head);
    });
  }

  // Cascade of fake errors that the player has to dismiss.
  async errorStorm(count = 8, onEach) {
    let dismissed = 0;
    const msgs = [
      'NULL is not a function.', 'Cannot read property of undefined.',
      'Reality buffer overflow.', 'Segmentation fault (core dumped).',
      'Stack overflow at line ∞.', 'Undefined is not defined.',
      'Memory leak in sector 7.', 'Recursion depth exceeded.',
      'Heap corruption detected.', 'The game is leaking.',
    ];
    for (let i = 0; i < count; i++) {
      audio.error();
      const overlay = this.el('div', 'error-pop');
      overlay.style.left = (60 + Math.random() * (window.innerWidth - 420)) + 'px';
      overlay.style.top = (60 + Math.random() * (window.innerHeight - 280)) + 'px';
      overlay.style.zIndex = ++this._z + 5000;
      const head = this.el('div', 'error-head', `<span class="error-ico">⚠</span><span>EXCEPTION 0x${(Math.random()*65535|0).toString(16)}</span>`);
      const msg = this.el('div', 'error-msg', msgs[i % msgs.length]);
      const row = this.el('div', 'error-row');
      const b = this.button('Dismiss', () => {
        overlay.remove(); dismissed++; onEach && onEach(dismissed);
      });
      row.appendChild(b);
      overlay.appendChild(head); overlay.appendChild(msg); overlay.appendChild(row);
      document.body.appendChild(overlay);
      this._makeDraggable(overlay, head);
      await sleep(120 + Math.random() * 160);
    }
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (!document.querySelector('.error-pop')) { clearInterval(check); resolve(true); }
      }, 200);
    });
  }

  toast(text, ms = 2600) {
    const t = this.el('div', 'toast', text);
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, ms);
  }
}
