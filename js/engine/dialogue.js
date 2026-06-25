import { audio } from './audio.js';
import { state } from './state.js';

// ---------------------------------------------------------------------------
// DIALOGUE: three narrators (Narrator / Intruder / System) with a typewriter,
// interruptions, click/space to advance, and choice prompts.
// ---------------------------------------------------------------------------

export const SPEAKERS = {
  narrator: { name: 'NARRATOR', cls: 'sp-narrator', blip: 520 },
  intruder: { name: '???',      cls: 'sp-intruder', blip: 220 },
  system:   { name: 'SYSTEM',   cls: 'sp-system',   blip: 760 },
  you:      { name: 'YOU',      cls: 'sp-you',      blip: 640 },
};

export class Dialogue {
  constructor(gfx) {
    this.gfx = gfx;
    this.root = document.getElementById('dialogue');
    this.nameEl = document.getElementById('dlg-name');
    this.textEl = document.getElementById('dlg-text');
    this.contEl = document.getElementById('dlg-continue');
    this.choiceEl = document.getElementById('choices');
    this._skip = false;
    this._typing = false;
    this._resolveAdvance = null;
    this.textSpeed = 1;
    this._tail = Promise.resolve(); // serializes overlapping say() calls

    const advance = () => {
      if (this._typing) { this._skip = true; return; }
      if (this._resolveAdvance) { const r = this._resolveAdvance; this._resolveAdvance = null; r(); }
    };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
        e.preventDefault(); advance();
      }
    });
    this.root.addEventListener('click', advance);
  }

  show() { this.root.classList.add('visible'); }
  hide() { this.root.classList.remove('visible'); }

  // Reveal `text` one glyph at a time. Returns when fully shown.
  async _type(text) {
    this._typing = true; this._skip = false;
    this.textEl.textContent = '';
    this.contEl.classList.remove('show');
    const chars = [...text];
    for (let i = 0; i < chars.length; i++) {
      if (this._skip) { this.textEl.textContent = text; break; }
      this.textEl.textContent += chars[i];
      const c = chars[i];
      if (c !== ' ') audio.type();
      let delay = 18 / this.textSpeed;
      if ('.,!?'.includes(c)) delay = 220 / this.textSpeed;
      else if (c === ' ') delay = 8 / this.textSpeed;
      await sleep(delay);
    }
    this._typing = false;
    this.contEl.classList.add('show');
  }

  // Public entry: queue lines so overlapping callers never garble each other.
  say(speaker, text, opts = {}) {
    const run = this._tail.then(() => this._sayNow(speaker, text, opts));
    this._tail = run.catch(() => {});
    return run;
  }

  // Main line. opts: { auto:ms, glitch:0..1, shake:bool, corrupt:bool }
  async _sayNow(speaker, text, opts = {}) {
    const sp = SPEAKERS[speaker] || SPEAKERS.narrator;
    this.show();
    this.root.className = 'dlg ' + sp.cls + ' visible';
    if (opts.shake) this.root.classList.add('shake');
    this.nameEl.textContent = opts.name || sp.name;

    if (speaker === 'intruder') { this.gfx && this.gfx.burstGlitch(0.6, 260); audio.glitch(0.5); }
    if (opts.glitch) { this.gfx && this.gfx.burstGlitch(opts.glitch, 400); audio.glitch(opts.glitch); }

    let render = text;
    if (opts.corrupt) render = corruptText(text, state.corruption / 100);
    await this._type(render);
    this.root.classList.remove('shake');

    if (opts.auto) { await sleep(opts.auto); return; }
    // wait for advance click / key
    await new Promise((res) => { this._resolveAdvance = res; });
  }

  // Present choices, resolve with the chosen value.
  async choices(list) {
    this.contEl.classList.remove('show');
    this.choiceEl.innerHTML = '';
    this.choiceEl.classList.add('visible');
    return new Promise((resolve) => {
      list.forEach((c, i) => {
        const b = document.createElement('button');
        b.className = 'choice-btn' + (c.cls ? ' ' + c.cls : '');
        b.textContent = c.text;
        b.style.animationDelay = (i * 70) + 'ms';
        b.addEventListener('mouseenter', () => audio.hover());
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          audio.click();
          this.choiceEl.classList.remove('visible');
          this.choiceEl.innerHTML = '';
          resolve(c.value);
        });
        this.choiceEl.appendChild(b);
      });
    });
  }

  clear() { this.textEl.textContent = ''; this.nameEl.textContent = ''; this.contEl.classList.remove('show'); }
}

export function corruptText(text, level) {
  if (level <= 0) return text;
  const glitchChars = '!<>#%&@$╱╲▓▒░╳█';
  return [...text].map((ch) => {
    if (ch === ' ') return ch;
    if (Math.random() < level * 0.18) return glitchChars[Math.floor(Math.random() * glitchChars.length)];
    return ch;
  }).join('');
}

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
