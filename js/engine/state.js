import { bus } from './bus.js';

// ---------------------------------------------------------------------------
// SAVE / STATE SYSTEM
// Stores: chapter, flags, inventory, achievements, endings, corruptionLevel,
// hiddenVariables, trust, memory. Supports autosave, manual save, fake
// corruption events and a recovery system.
// ---------------------------------------------------------------------------

const SAVE_KEY = 'UNDEFINED_SAVE_v1';
const BACKUP_KEY = 'UNDEFINED_SAVE_BACKUP_v1';
const SETTINGS_KEY = 'UNDEFINED_SETTINGS_v1';

function freshSave() {
  return {
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    chapter: 0,            // 0 = title, 1..6 = chapters
    checkpoint: 'start',   // label inside a chapter
    flags: {},             // boolean / scalar story flags
    inventory: [],         // collected items {id,name,desc,icon}
    achievements: {},      // id -> timestamp unlocked
    endings: {},           // ending id -> timestamp seen
    corruptionLevel: 0,    // 0..100
    trust: { narrator: 50, intruder: 0 },
    memory: [],            // reconstructed memory fragments
    secretsFound: {},      // secret id -> true
    hiddenVariables: {     // never shown directly to player
      lookedAtConsole: 0,
      timesLied: 0,
      timesDoubted: 0,
      idleSeconds: 0,
      fakeCrashes: 0,
      truthScore: 0,
      playTime: 0,
      sessionStart: Date.now(),
    },
  };
}

export class State {
  constructor() {
    this.data = freshSave();
    this._autosaveTimer = null;
    this.loaded = false;
  }

  // ---- persistence -------------------------------------------------------
  hasSave() { return !!localStorage.getItem(SAVE_KEY); }

  load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { this.loaded = false; return false; }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || parsed.__corrupt) throw new Error('corrupt');
      this.data = Object.assign(freshSave(), parsed);
      this.data.hiddenVariables = Object.assign(freshSave().hiddenVariables, parsed.hiddenVariables || {});
      this.data.hiddenVariables.sessionStart = Date.now();
      this.loaded = true;
      bus.emit('state:loaded', this.data);
      return true;
    } catch (e) {
      bus.emit('state:corrupt-detected', raw);
      return false;
    }
  }

  // Try to recover from the rolling backup slot.
  recover() {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      this.data = Object.assign(freshSave(), parsed);
      this.persist();
      bus.emit('state:recovered', this.data);
      return true;
    } catch (e) { return false; }
  }

  persist() {
    this.data.updatedAt = Date.now();
    // rolling backup: previous valid save becomes the backup
    const prev = localStorage.getItem(SAVE_KEY);
    if (prev && !prev.includes('__corrupt')) localStorage.setItem(BACKUP_KEY, prev);
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
  }

  save(manual = false) {
    this.persist();
    bus.emit('state:saved', { manual });
  }

  reset() {
    this.data = freshSave();
    this.persist();
    bus.emit('state:reset');
  }

  hardWipe() {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(BACKUP_KEY);
    this.data = freshSave();
    bus.emit('state:wiped');
  }

  startAutosave(ms = 12000) {
    this.stopAutosave();
    this._autosaveTimer = setInterval(() => this.save(false), ms);
  }
  stopAutosave() { if (this._autosaveTimer) clearInterval(this._autosaveTimer); this._autosaveTimer = null; }

  // ---- fake corruption / recovery theater --------------------------------
  // Writes a deliberately broken blob to the main slot to drive an in-fiction
  // "your save is corrupted" event. The real data is kept in memory + backup.
  injectFakeCorruption() {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(this.data));
    const garbage = '{"__corrupt":true,"glitch":"' + Math.random().toString(36).slice(2) + '0xDEADBEEF"}';
    localStorage.setItem(SAVE_KEY, garbage);
    this.data.hiddenVariables.fakeCrashes++;
    bus.emit('state:fake-corrupt');
  }
  healFakeCorruption() {
    this.persist();
    bus.emit('state:healed');
  }

  // ---- accessors ---------------------------------------------------------
  get d() { return this.data; }

  setFlag(k, v = true) { this.data.flags[k] = v; bus.emit('flag', { k, v }); }
  getFlag(k, def = false) { return k in this.data.flags ? this.data.flags[k] : def; }

  setChapter(n, checkpoint = 'start') {
    this.data.chapter = n; this.data.checkpoint = checkpoint;
    bus.emit('chapter', n); this.save(false);
  }

  addItem(item) {
    if (this.data.inventory.find(i => i.id === item.id)) return false;
    this.data.inventory.push(item);
    bus.emit('inventory:add', item); this.save(false);
    return true;
  }
  hasItem(id) { return !!this.data.inventory.find(i => i.id === id); }
  removeItem(id) {
    this.data.inventory = this.data.inventory.filter(i => i.id !== id);
    bus.emit('inventory:change');
  }

  addMemory(frag) {
    if (this.data.memory.find(m => m.id === frag.id)) return false;
    this.data.memory.push(frag); bus.emit('memory:add', frag); this.save(false);
    return true;
  }

  findSecret(id) {
    if (this.data.secretsFound[id]) return false;
    this.data.secretsFound[id] = true;
    bus.emit('secret', id); this.save(false);
    return true;
  }
  secretCount() { return Object.keys(this.data.secretsFound).length; }

  // ---- corruption / trust ------------------------------------------------
  setCorruption(v) {
    this.data.corruptionLevel = Math.max(0, Math.min(100, v));
    bus.emit('corruption', this.data.corruptionLevel);
  }
  addCorruption(delta) { this.setCorruption(this.data.corruptionLevel + delta); }
  get corruption() { return this.data.corruptionLevel; }

  addTrust(who, delta) {
    this.data.trust[who] = Math.max(0, Math.min(100, (this.data.trust[who] || 0) + delta));
    bus.emit('trust', { who, value: this.data.trust[who] });
  }

  hv(k, delta) {
    if (delta === undefined) return this.data.hiddenVariables[k];
    this.data.hiddenVariables[k] = (this.data.hiddenVariables[k] || 0) + delta;
    return this.data.hiddenVariables[k];
  }

  // ---- settings ----------------------------------------------------------
  loadSettings() {
    try { return Object.assign({ volume: 0.7, effects: true, textSpeed: 1 }, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); }
    catch { return { volume: 0.7, effects: true, textSpeed: 1 }; }
  }
  saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }
}

export const state = new State();
