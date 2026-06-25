// Tiny event bus used across the engine.
export class Bus {
  constructor() { this.map = new Map(); }
  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt).add(fn);
    return () => this.off(evt, fn);
  }
  off(evt, fn) { if (this.map.has(evt)) this.map.get(evt).delete(fn); }
  emit(evt, payload) {
    if (this.map.has(evt)) for (const fn of [...this.map.get(evt)]) {
      try { fn(payload); } catch (e) { console.error('[bus]', evt, e); }
    }
  }
}
export const bus = new Bus();
