// Spatial focus model for a vertical stack of horizontal zones (rows).
// Pure logic: no DOM. Screens supply each zone's size and the on-screen x-centre of its items.

export interface ZoneSpec {
  id: string;
  size: () => number;
  /** Current on-screen horizontal centre of item i, used to pick the nearest item when moving vertically. */
  centerX: (i: number) => number;
}

export interface FocusPos { zone: string; index: number; }

export class FocusModel {
  private zones: ZoneSpec[];
  private z = 0;
  private remembered: Record<string, number> = {};

  constructor(zones: ZoneSpec[], start?: FocusPos | null) {
    this.zones = zones;
    const first = this.firstNonEmpty(0, 1);
    this.z = first < 0 ? 0 : first;
    if (start) this.set(start);
    else this.remembered[this.zones[this.z].id] = 0;
  }

  get pos(): FocusPos {
    const zone = this.zones[this.z];
    return { zone: zone.id, index: this.clampIndex(zone, this.remembered[zone.id] || 0) };
  }

  set(p: FocusPos): boolean {
    const zi = this.zones.findIndex((z) => z.id === p.zone);
    if (zi < 0 || this.zones[zi].size() === 0) return false;
    this.z = zi;
    this.remembered[p.zone] = this.clampIndex(this.zones[zi], p.index);
    return true;
  }

  /** Returns the new position, or null when the move is blocked (edges never wrap: predictable on a remote). */
  move(dir: 'up' | 'down' | 'left' | 'right'): FocusPos | null {
    const cur = this.pos;
    const zone = this.zones[this.z];
    if (dir === 'left' || dir === 'right') {
      const next = cur.index + (dir === 'left' ? -1 : 1);
      if (next < 0 || next >= zone.size()) return null;
      this.remembered[zone.id] = next;
      return this.pos;
    }
    const zi = this.firstNonEmpty(this.z + (dir === 'up' ? -1 : 1), dir === 'up' ? -1 : 1);
    if (zi < 0) return null;
    const target = this.zones[zi];
    const x = zone.centerX(cur.index);
    let best = 0, bestD = Infinity;
    for (let i = 0; i < target.size(); i++) {
      const d = Math.abs(target.centerX(i) - x);
      if (d < bestD) { bestD = d; best = i; }
    }
    this.z = zi;
    this.remembered[target.id] = best;
    return this.pos;
  }

  private firstNonEmpty(from: number, step: number): number {
    for (let i = from; i >= 0 && i < this.zones.length; i += step) if (this.zones[i].size() > 0) return i;
    return -1;
  }

  private clampIndex(zone: ZoneSpec, i: number): number {
    return Math.max(0, Math.min(zone.size() - 1, i));
  }
}
