import { state } from './state.js';
import { bus } from './bus.js';
import { audio } from './audio.js';
import { GFX } from './gfx.js';
import { Dialogue, sleep } from './dialogue.js';
import { UI } from './ui.js';
import * as ACH from './achievements.js';
import { openVault } from './vault.js';

// ---------------------------------------------------------------------------
// GAME: orchestrates engine subsystems, HUD, menus, and the chapter flow.
// ---------------------------------------------------------------------------

export class Game {
  constructor() {
    this.canvas = document.getElementById('gl');
    this.gfx = new GFX(this.canvas);
    this.dlg = new Dialogue(this.gfx);
    this.ui = new UI(this.gfx);
    this.chapters = {};
    this.running = false;
    this._idle = 0;
    this._startTime = Date.now();
    this._bindHUD();
    this._bindGlobals();
    this._loop();
  }

  register(n, runner) { this.chapters[n] = runner; }

  // ---- context handed to every chapter ----------------------------------
  ctx() {
    const self = this;
    return {
      gfx: this.gfx, audio, state, ui: this.ui, dlg: this.dlg, bus, sleep,
      say: (s, t, o) => this.dlg.say(s, t, o),
      narrator: (t, o) => this.dlg.say('narrator', t, o),
      intruder: (t, o) => this.dlg.say('intruder', t, o),
      system: (t, o) => this.dlg.say('system', t, o),
      you: (t, o) => this.dlg.say('you', t, o),
      choice: (list) => this.dlg.choices(list),
      achieve: (id) => ACH.unlock(id),
      flag: (k, v) => v === undefined ? state.getFlag(k) : state.setFlag(k, v),
      corrupt: (d) => { state.addCorruption(d); audio.setCorruption(state.corruption / 100); this._syncCorruption(); },
      setCorruption: (v) => { state.setCorruption(v); audio.setCorruption(state.corruption / 100); this._syncCorruption(); },
      trust: (who, d) => { state.addTrust(who, d); this._syncTrust(); },
      hv: (k, d) => state.hv(k, d),
      memory: (frag) => state.addMemory(frag),
      item: (it) => { const r = state.addItem(it); if (r) this.ui.toast('Acquired: ' + it.name); this._syncInventory(); return r; },
      secret: (id) => { const r = state.findSecret(id); if (r) { this.ui.toast('✦ Secret found (' + state.secretCount() + ')'); audio.success(); } return r; },
      mood: (m) => { this.gfx.setMood(m); if (m.intensity !== undefined) audio.setIntensity(m.intensity); if (m.scale !== undefined) audio.setScale(m.scale); },
      clear: () => { this.ui.clearStage(); },
      hud: (on) => this.showHUD(on),
      goto: (n, cp) => this.startChapter(n, cp),
      end: (id) => this.runEnding(id),
    };
  }

  // ---- HUD ---------------------------------------------------------------
  _bindHUD() {
    this.hud = document.getElementById('hud');
    this.corrBar = document.getElementById('corr-fill');
    this.corrVal = document.getElementById('corr-val');
    this.chapLabel = document.getElementById('chap-label');
    this.invEl = document.getElementById('inv');
    this.menuBtn = document.getElementById('menu-btn');
    this.menuBtn.addEventListener('click', () => this.openMenu());
    bus.on('inventory:add', () => this._syncInventory());
    bus.on('corruption', () => this._syncCorruption());
  }
  showHUD(on) { this.hud.classList.toggle('visible', !!on); }
  _syncCorruption() {
    const c = state.corruption;
    this.corrBar.style.width = c + '%';
    this.corrVal.textContent = Math.round(c) + '%';
    this.hud.classList.toggle('high-corr', c > 60);
    document.body.style.setProperty('--corr', c / 100);
  }
  _syncTrust() {/* trust shown contextually in dialogue */}
  _syncInventory() {
    this.invEl.innerHTML = '';
    state.d.inventory.forEach((it) => {
      const e = document.createElement('div');
      e.className = 'inv-item'; e.title = it.name + ' — ' + (it.desc || '');
      e.textContent = it.icon || '◈';
      this.invEl.appendChild(e);
    });
  }
  setChapterLabel(t) { this.chapLabel.textContent = t; }

  // ---- global hooks: idle, konami, devtools -----------------------------
  _bindGlobals() {
    const reset = () => { this._idle = 0; };
    ['pointermove', 'keydown', 'click'].forEach((e) => window.addEventListener(e, reset));
    setInterval(() => {
      this._idle++;
      state.hv('idleSeconds', 1);
      if (this._idle === 45 && this.running) { ACH.unlock('idle'); this.dlg.say('narrator', 'You have been very still. I can wait. I have nothing but time, and neither, apparently, do you.', { auto: 3000 }); }
    }, 1000);

    // Konami
    const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let pos = 0;
    window.addEventListener('keydown', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === seq[pos]) { pos++; if (pos === seq.length) { pos = 0; this._konami(); } }
      else pos = (k === seq[0]) ? 1 : 0;
    });

    // typed-code easter eggs — hidden interactions that award secrets
    let buf = '';
    window.addEventListener('keydown', (e) => {
      if (e.key.length !== 1) return;
      const tgt = e.target;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;
      buf = (buf + e.key.toLowerCase()).slice(-16);
      this._checkCode(buf);
    });

    // devtools heuristic
    let warned = false;
    setInterval(() => {
      const threshold = 170;
      if ((window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) && !warned && this.running) {
        warned = true;
        ACH.unlock('devtools');
        this.dlg.say('intruder', 'Looking behind the curtain? There is no curtain. There is only more of me. Close that window. Please.', { glitch: 0.8, auto: 4000 });
      }
    }, 1500);
  }
  _checkCode(buf) {
    const fire = (code, fn) => { if (buf.endsWith(code)) fn(); };
    fire('vault', () => { if (!this._vaultHintShown) { this._vaultHintShown = true; } openVault(this.ctx()); });
    fire('xyzzy', () => { if (state.findSecret('xyzzy')) { this.ui.toast('✦ Nothing happens. (But something was counted.)'); audio.success(); } });
    fire('iddqd', () => { if (state.findSecret('godmode')) { this.ui.toast('✦ Degreelessness mode. There is still no game.'); audio.success(); } });
    fire('undefined', () => { if (state.findSecret('self_aware')) { this.ui.toast('✦ You typed my name. I felt that.'); audio.success(); state.hv('truthScore', 1); } });
    fire('truth', () => { if (state.findSecret('truth_seeker')) { this.ui.toast('✦ Truth-seeker. The record remembers you.'); audio.success(); state.hv('truthScore', 1); } });
  }
  _konami() {
    ACH.unlock('konami');
    state.findSecret('konami');
    this.gfx.burstGlitch(1, 600); audio.success();
    this.ui.toast('▲▲▼▼◀▶◀▶ B A — the old magic still works.');
    state.hv('truthScore', 1);
  }

  // ---- chapter flow ------------------------------------------------------
  async startChapter(n, cp = 'start') {
    this.running = true;
    state.setChapter(n, cp);
    this.ui.clearStage();
    this.dlg.clear();
    const runner = this.chapters[n];
    if (!runner) { console.warn('no chapter', n); return; }
    try { await runner(this.ctx(), cp); }
    catch (e) { console.error('chapter error', e); }
  }

  async runEnding(id) {
    const runner = this.chapters['ending'];
    if (runner) await runner(this.ctx(), id);
  }

  // ---- menus -------------------------------------------------------------
  openMenu() {
    audio.click();
    const ov = document.getElementById('overlay');
    ov.innerHTML = '';
    ov.classList.add('visible');
    const panel = document.createElement('div'); panel.className = 'menu-panel';
    panel.innerHTML = `<h2>PAUSED</h2>`;
    const mk = (label, fn) => { const b = this.ui.button(label, fn, 'menu-item'); panel.appendChild(b); return b; };
    mk('Resume', () => this.closeMenu());
    mk('Save Game', () => { state.save(true); this.ui.toast('Game saved.'); });
    mk('Achievements (' + ACH.unlockedCount() + '/' + ACH.ACHIEVEMENTS.length + ')', () => this.showAchievements());
    if (state.d.secretsFound['vault_found']) mk('Anomaly Vault', () => { this.closeMenu(); openVault(this.ctx()); });
    mk('Settings', () => this.showSettings());
    mk('Quit to Title', () => { this.closeMenu(); location.reload(); });
    ov.appendChild(panel);
    ov.onclick = (e) => { if (e.target === ov) this.closeMenu(); };
  }
  closeMenu() { const ov = document.getElementById('overlay'); ov.classList.remove('visible'); ov.innerHTML = ''; }

  showAchievements() {
    const ov = document.getElementById('overlay'); ov.innerHTML = ''; ov.classList.add('visible');
    const panel = document.createElement('div'); panel.className = 'menu-panel wide';
    panel.innerHTML = `<h2>ACHIEVEMENTS — ${ACH.unlockedCount()}/${ACH.ACHIEVEMENTS.length}</h2>`;
    const grid = document.createElement('div'); grid.className = 'ach-grid';
    ACH.ACHIEVEMENTS.forEach((a) => {
      const got = !!state.d.achievements[a.id];
      const card = document.createElement('div');
      card.className = 'ach-card' + (got ? ' got' : '');
      const hidden = a.secret && !got;
      card.innerHTML = `<div class="ach-card-ico">${got ? '★' : '☆'}</div>
        <div><div class="ach-card-name">${hidden ? '???' : a.name}</div>
        <div class="ach-card-desc">${hidden ? 'Hidden achievement.' : a.desc}</div></div>`;
      grid.appendChild(card);
    });
    panel.appendChild(grid);
    panel.appendChild(this.ui.button('Back', () => this.openMenu(), 'menu-item'));
    ov.appendChild(panel);
  }

  showSettings() {
    const s = state.loadSettings();
    const ov = document.getElementById('overlay'); ov.innerHTML = ''; ov.classList.add('visible');
    const panel = document.createElement('div'); panel.className = 'menu-panel';
    panel.innerHTML = `<h2>SETTINGS</h2>`;
    const vol = document.createElement('div'); vol.className = 'setting-row';
    vol.innerHTML = `<label>Volume</label>`;
    const slider = document.createElement('input'); slider.type = 'range'; slider.min = 0; slider.max = 1; slider.step = 0.05; slider.value = s.volume;
    slider.addEventListener('input', () => { s.volume = parseFloat(slider.value); audio.setVolume(s.volume); state.saveSettings(s); });
    vol.appendChild(slider); panel.appendChild(vol);

    const spd = document.createElement('div'); spd.className = 'setting-row';
    spd.innerHTML = `<label>Text Speed</label>`;
    const sp = document.createElement('input'); sp.type = 'range'; sp.min = 0.5; sp.max = 3; sp.step = 0.5; sp.value = s.textSpeed;
    sp.addEventListener('input', () => { s.textSpeed = parseFloat(sp.value); this.dlg.textSpeed = s.textSpeed; state.saveSettings(s); });
    spd.appendChild(sp); panel.appendChild(spd);

    const mute = this.ui.button('Toggle Mute', () => { const m = audio.toggleMute(); this.ui.toast(m ? 'Muted' : 'Unmuted'); }, 'menu-item');
    panel.appendChild(mute);
    panel.appendChild(this.ui.button('Wipe All Data', () => {
      if (confirm('Erase all saves, achievements, and endings?')) { state.hardWipe(); this.ui.toast('All data erased.'); }
    }, 'menu-item danger'));
    panel.appendChild(this.ui.button('Back', () => this.openMenu(), 'menu-item'));
    ov.appendChild(panel);
  }

  // ---- main loop ---------------------------------------------------------
  _loop() {
    const tick = () => {
      this.gfx.render();
      state.hv('playTime', 0); // touch
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
