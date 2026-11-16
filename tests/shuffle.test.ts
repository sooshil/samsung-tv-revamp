import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Deck } from '../src/services/shuffle';

test('every item once per round, no immediate repeats across rounds', () => {
  const d = new Deck();
  let prev = -1;
  for (let round = 0; round < 50; round++) {
    const seen = new Set<number>();
    for (let i = 0; i < 7; i++) { const c = d.draw(7); assert.notEqual(c, prev); seen.add(c); prev = c; }
    assert.equal(seen.size, 7);
  }
});

test('handles tiny and shrinking lists', () => {
  const d = new Deck();
  assert.equal(d.draw(1), 0);
  for (let i = 0; i < 20; i++) { const c = d.draw(3); assert.ok(c >= 0 && c < 3); }
  for (let i = 0; i < 20; i++) { const c = d.draw(2); assert.ok(c >= 0 && c < 2); }
});
