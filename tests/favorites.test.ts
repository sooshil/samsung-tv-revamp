import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addFavorite, removeFavorite, moveFavorite, MAX_FAVORITES } from '../src/apps/favorites';

test('add appends once and respects the maximum', () => {
  assert.deepEqual(addFavorite(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(addFavorite(['a', 'b'], 'a'), ['a', 'b']);
  const full = Array.from({ length: MAX_FAVORITES }, (_, i) => 'x' + i);
  assert.equal(addFavorite(full, 'new'), full);
});

test('remove drops only that id', () => {
  assert.deepEqual(removeFavorite(['a', 'b', 'c'], 'b'), ['a', 'c']);
  assert.deepEqual(removeFavorite(['a'], 'zzz'), ['a']);
});

test('move swaps neighbours and stops at the ends', () => {
  assert.deepEqual(moveFavorite(['a', 'b', 'c'], 'c', -1), ['a', 'c', 'b']);
  assert.deepEqual(moveFavorite(['a', 'b', 'c'], 'a', 1), ['b', 'a', 'c']);
  const l = ['a', 'b'];
  assert.equal(moveFavorite(l, 'a', -1), l);
  assert.equal(moveFavorite(l, 'b', 1), l);
  assert.equal(moveFavorite(l, 'q', 1), l);
});
