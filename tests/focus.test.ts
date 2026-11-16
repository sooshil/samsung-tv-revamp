import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FocusModel, ZoneSpec } from '../src/navigation/focus';

const row = (id: string, n: number, w: number, x0 = 0): ZoneSpec => ({ id, size: () => n, centerX: (i) => x0 + i * w + w / 2 });

test('starts on first non-empty zone', () => {
  const f = new FocusModel([row('empty', 0, 100), row('apps', 3, 100)]);
  assert.deepEqual(f.pos, { zone: 'apps', index: 0 });
});

test('left/right stop at edges, never wrap', () => {
  const f = new FocusModel([row('apps', 2, 100)]);
  assert.equal(f.move('left'), null);
  assert.deepEqual(f.move('right'), { zone: 'apps', index: 1 });
  assert.equal(f.move('right'), null);
});

test('vertical move picks horizontally nearest item', () => {
  // big cards 400 wide above small cards 200 wide
  const f = new FocusModel([row('fav', 4, 400), row('all', 8, 200)]);
  f.move('right'); f.move('right'); // fav[2], centre 1000
  assert.deepEqual(f.move('down'), { zone: 'all', index: 4 }); // centre 900 vs 1100: 4 at 900 is first nearest
});

test('skips empty zones vertically and blocks at top/bottom', () => {
  const f = new FocusModel([row('top', 1, 100), row('empty', 0, 100), row('bottom', 2, 100)]);
  assert.equal(f.move('up'), null);
  assert.deepEqual(f.move('down'), { zone: 'bottom', index: 0 });
  assert.equal(f.move('down'), null);
  assert.deepEqual(f.move('up'), { zone: 'top', index: 0 });
});

test('restores a saved position and clamps it when a row shrank', () => {
  const f = new FocusModel([row('a', 3, 100), row('b', 2, 100)], { zone: 'b', index: 5 });
  assert.deepEqual(f.pos, { zone: 'b', index: 1 });
});

test('ignores a saved position in a zone that no longer exists', () => {
  const f = new FocusModel([row('a', 3, 100)], { zone: 'gone', index: 2 });
  assert.deepEqual(f.pos, { zone: 'a', index: 0 });
});
