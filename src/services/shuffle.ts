// A shuffled deck of indices: every item once before any repeats, and never the same item twice in a row.
export class Deck {
  private cards: number[] = [];
  private last = -1;

  reset(): void { this.cards = []; }

  draw(n: number): number {
    if (n <= 1) { this.last = 0; return 0; }
    if (!this.cards.length || this.cards.some((c) => c >= n)) {
      const d = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = d[i]; d[i] = d[j]; d[j] = t; }
      if (d[d.length - 1] === this.last) { const t = d[0]; d[0] = d[d.length - 1]; d[d.length - 1] = t; } // cards are drawn from the end
      this.cards = d;
    }
    this.last = this.cards.pop() as number;
    return this.last;
  }
}
