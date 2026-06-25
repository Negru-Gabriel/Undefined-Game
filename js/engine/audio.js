// ---------------------------------------------------------------------------
// AUDIO: fully procedural WebAudio engine. No external files (offline-ready).
//  * layered dynamic soundtrack (drone + pad + arpeggio + sub pulse)
//  * ambient noise beds
//  * procedural glitch / UI / typing SFX
//  * reactive: intensity & corruption modulate the mix
// ---------------------------------------------------------------------------

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.intensity = 0.3;      // 0..1 musical energy
    this.corruption = 0;       // 0..1 detune / noise
    this.volume = 0.7;
    this.muted = false;
    this._layers = [];
    this._droneOscs = [];
    this._padOscs = [];
    this._arpTimer = null;
    this._scaleIdx = 0;
    this.tempo = 1;            // chapter tempo multiplier (higher = faster arp)
    this.pluckType = 'square'; // arp waveform per chapter
    // minor-ish scales (semitone offsets) for mood shifts
    this.scales = [
      [0, 2, 3, 5, 7, 8, 10],   // aeolian
      [0, 1, 3, 5, 7, 8, 10],   // phrygian
      [0, 2, 3, 5, 6, 8, 11],   // exotic / unsettling
      [0, 2, 4, 7, 9],          // major pentatonic (warm / resolved)
      [0, 3, 5, 6, 7, 10],      // blues (tense)
    ];
    this.root = 146.83; // D3
    // Per-chapter sonic identity: distinct key, scale, tempo, timbre, mood.
    this.themes = {
      1: { name: 'denial',    root: 146.83, scale: 0, tempo: 0.85, pluck: 'square',   drone: 380,  intensity: 0.22 }, // D aeolian, sparse
      2: { name: 'desktop',   root: 164.81, scale: 3, tempo: 1.15, pluck: 'triangle', drone: 900,  intensity: 0.34 }, // E pentatonic, brighter
      3: { name: 'intruder',  root: 138.59, scale: 1, tempo: 1.0,  pluck: 'sawtooth', drone: 520,  intensity: 0.40 }, // C# phrygian, uneasy
      4: { name: 'machine',   root: 110.00, scale: 2, tempo: 1.3,  pluck: 'square',   drone: 1300, intensity: 0.5  }, // A exotic, mechanical
      5: { name: 'collapse',  root: 97.999, scale: 4, tempo: 1.6,  pluck: 'sawtooth', drone: 1700, intensity: 0.72 }, // G blues, frantic
      6: { name: 'choice',    root: 130.81, scale: 0, tempo: 0.7,  pluck: 'triangle', drone: 600,  intensity: 0.45 }, // C aeolian, solemn
    };
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.0; this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.9; this.sfxGain.connect(this.master);
    this._noiseBuffer = this._makeNoise();
  }

  async start() {
    this.init();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.started) return;
    this.started = true;
    this._buildBeds();
    this._startArp();
    this.musicGain.gain.setTargetAtTime(0.5, this.ctx.currentTime, 3.0);
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.muted ? 0 : v; }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : this.volume; return this.muted; }

  _makeNoise() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // continuous layers --------------------------------------------------------
  _buildBeds() {
    const t = this.ctx.currentTime;
    // deep drone (two detuned saws through a lowpass)
    const drone = this.ctx.createGain(); drone.gain.value = 0.0; drone.connect(this.musicGain);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 6; lp.connect(drone);
    [0, 7].forEach((semi, i) => {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = this.root * Math.pow(2, semi / 12) / 2;
      o.detune.value = i === 0 ? -6 : 8;
      o.connect(lp); o.start();
      this._layers.push(o);
      this._droneOscs.push({ osc: o, semi: semi - 12 }); // one octave down
    });
    drone.gain.setTargetAtTime(0.16, t, 4);
    this._droneGain = drone; this._droneLP = lp;

    // airy pad (triangle cluster)
    const pad = this.ctx.createGain(); pad.gain.value = 0; pad.connect(this.musicGain);
    const padFilter = this.ctx.createBiquadFilter(); padFilter.type = 'bandpass'; padFilter.frequency.value = 700; padFilter.Q.value = 1.2; padFilter.connect(pad);
    [0, 3, 7, 12].forEach((semi) => {
      const o = this.ctx.createOscillator(); o.type = 'triangle';
      o.frequency.value = this.root * Math.pow(2, semi / 12);
      o.connect(padFilter); o.start();
      this._layers.push(o);
      this._padOscs.push({ osc: o, semi });
    });
    pad.gain.setTargetAtTime(0.05, t, 6);
    this._padGain = pad; this._padFilter = padFilter;

    // ambient noise bed (filtered)
    const amb = this.ctx.createGain(); amb.gain.value = 0.0; amb.connect(this.musicGain);
    const ns = this.ctx.createBufferSource(); ns.buffer = this._noiseBuffer; ns.loop = true;
    const nf = this.ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 600;
    ns.connect(nf); nf.connect(amb); ns.start();
    amb.gain.setTargetAtTime(0.02, t, 5);
    this._ambGain = amb; this._ambFilter = nf;
    this._layers.push(ns);

    // slow LFO on pad filter for movement
    this._lfo = this.ctx.createOscillator(); this._lfo.frequency.value = 0.07;
    this._lfoGain = this.ctx.createGain(); this._lfoGain.gain.value = 300;
    this._lfo.connect(this._lfoGain); this._lfoGain.connect(padFilter.frequency); this._lfo.start();
  }

  _startArp() {
    const step = () => {
      if (!this.started) return;
      const scale = this.scales[this._scaleIdx];
      if (Math.random() < 0.3 + this.intensity * 0.6) {
        const deg = scale[Math.floor(Math.random() * scale.length)];
        const oct = Math.random() < 0.5 ? 1 : 2;
        const freq = this.root * Math.pow(2, deg / 12) * oct;
        this._pluck(freq, 0.05 + this.intensity * 0.07);
      }
      const interval = ((0.36 - this.intensity * 0.16) / (this.tempo || 1)) * 1000;
      this._arpTimer = setTimeout(step, interval * (0.8 + Math.random() * 0.4));
    };
    step();
  }

  _pluck(freq, gain = 0.08) {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = this.pluckType || 'square';
    o.frequency.value = freq;
    o.detune.value = this.corruption * 60 * (Math.random() - 0.5);
    const g = this.ctx.createGain(); g.gain.value = 0;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    o.connect(f); f.connect(g); g.connect(this.musicGain);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.start(t); o.stop(t + 0.55);
  }

  // reactive setters ---------------------------------------------------------
  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, v));
    if (!this.started) return;
    const t = this.ctx.currentTime;
    this._droneLP.frequency.setTargetAtTime(300 + this.intensity * 1400, t, 1.5);
    this._padGain.gain.setTargetAtTime(0.04 + this.intensity * 0.08, t, 2);
    this._ambGain.gain.setTargetAtTime(0.02 + this.intensity * 0.05, t, 2);
  }
  setCorruption(v01) {
    this.corruption = Math.max(0, Math.min(1, v01));
    if (!this.started) return;
    const t = this.ctx.currentTime;
    this._layers.forEach((o) => { if (o.detune) o.detune.setTargetAtTime((o.detune.value || 0) * 0 + this.corruption * 40 * (Math.random() - 0.5), t, 0.5); });
    this._ambFilter.frequency.setTargetAtTime(600 + this.corruption * 3000, t, 1);
  }
  setScale(i) { this._scaleIdx = i % this.scales.length; }

  // Smoothly retune the sustained drone + pad to a new root frequency.
  setRoot(freq, glide = 2.5) {
    this.root = freq;
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    this._droneOscs.forEach(({ osc, semi }) => osc.frequency.setTargetAtTime(freq * Math.pow(2, semi / 12), t, glide));
    this._padOscs.forEach(({ osc, semi }) => osc.frequency.setTargetAtTime(freq * Math.pow(2, semi / 12), t, glide));
  }

  // Apply a whole chapter's sonic identity at once.
  setChapterTheme(n) {
    const th = this.themes[n] || this.themes[1];
    this._themeName = th.name;
    this.pluckType = th.pluck;
    this.tempo = th.tempo;
    this.setScale(th.scale);
    this.setRoot(th.root);
    this.setIntensity(th.intensity);
    if (this.started && this._droneLP) {
      this._droneLP.frequency.setTargetAtTime(th.drone, this.ctx.currentTime, 2.5);
    }
  }

  // one-shot SFX -------------------------------------------------------------
  blip(freq = 600, dur = 0.04, type = 'square', gain = 0.05) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = gain;
    o.connect(g); g.connect(this.sfxGain);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }
  type() { this.blip(420 + Math.random() * 220, 0.02, 'square', 0.025); }
  click() { this.blip(900, 0.03, 'square', 0.06); }
  hover() { this.blip(1300, 0.02, 'sine', 0.025); }
  error() {
    this.blip(180, 0.18, 'sawtooth', 0.09);
    setTimeout(() => this.blip(120, 0.22, 'sawtooth', 0.09), 60);
  }
  success() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.12, 'triangle', 0.07), i * 90)); }

  glitch(intensity = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this._noiseBuffer;
    const g = this.ctx.createGain(); g.gain.value = 0.0;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = 800 + Math.random() * 3000; f.Q.value = 8;
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    const dur = 0.08 + Math.random() * 0.18 * intensity;
    g.gain.setValueAtTime(0.18 * intensity, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t); src.stop(t + dur + 0.02);
    // pitch sweep companion
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(1200, t); o.frequency.exponentialRampToValueAtTime(80, t + dur);
    const og = this.ctx.createGain(); og.gain.value = 0.04 * intensity;
    o.connect(og); og.connect(this.sfxGain);
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }

  crash() {
    if (!this.ctx) return;
    this.glitch(1.5);
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(440, t); o.frequency.exponentialRampToValueAtTime(20, t + 1.2);
    const g = this.ctx.createGain(); g.gain.value = 0.12;
    o.connect(g); g.connect(this.sfxGain);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.start(t); o.stop(t + 1.3);
  }

  drone(on) {
    if (!this._droneGain) return;
    this._droneGain.gain.setTargetAtTime(on ? 0.16 : 0.0, this.ctx.currentTime, 1.5);
  }
}

export const audio = new AudioEngine();
