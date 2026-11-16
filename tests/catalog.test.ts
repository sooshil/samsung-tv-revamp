import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog } from '../src/apps/catalog';
import { DEFAULTS, migrate } from '../src/settings/store';

const app = (id: string, name = id) => ({ id, name, iconPath: null, version: '1' });
const installed = [
  app('9Ur5IzDKqV.TizenYouTube', 'YouTube'), app('org.tizen.netflix-app', 'Netflix'), app('org.tizen.primevideo', 'Prime Video'),
  app('org.tizen.primevideo-dummy', 'Prime Video'), app('com.samsung.tv.aria-dummy', 'Apple TV'), app('org.tizen.cloning'),
  app('com.samsung.tv.coba.setting', 'Setting'), app('tvs-lite-app'), app('tvrevamp00.Dashboard', 'Home'),
  app('MCmYXNxgcu.DisneyPlus', 'Disney+'), app('com.samsung.tv.aria-video', 'Apple TV'), app('org.tizen.browser', 'Internet'),
  app('wKDM33Rods.ZEE5', 'ZEE5 - Movies, Shows'),
];

test('favourites keep configured order and skip uninstalled apps', () => {
  const c = buildCatalog(installed, migrate({ ...DEFAULTS, favorites: ['org.tizen.netflix-app', 'missing.App', '9Ur5IzDKqV.TizenYouTube'] }), 'tvrevamp00.Dashboard');
  assert.deepEqual(c.favorites.map((a) => a.label), ['Netflix', 'YouTube']);
});

test('system components, dummies and self are excluded; real apps kept', () => {
  const c = buildCatalog(installed, migrate({ ...DEFAULTS, favorites: [], hidden: [] }), 'tvrevamp00.Dashboard');
  assert.deepEqual(c.others.map((a) => a.id).sort(), [
    '9Ur5IzDKqV.TizenYouTube', 'MCmYXNxgcu.DisneyPlus', 'com.samsung.tv.aria-video', 'org.tizen.browser',
    'org.tizen.netflix-app', 'org.tizen.primevideo', 'wKDM33Rods.ZEE5',
  ]);
});

test('short names and custom labels', () => {
  const c = buildCatalog(installed, migrate({ ...DEFAULTS, favorites: ['wKDM33Rods.ZEE5', 'org.tizen.browser'], labels: { 'org.tizen.browser': 'Web' } }), 'x');
  assert.deepEqual(c.favorites.map((a) => a.label), ['ZEE5', 'Web']);
});

test('migrate repairs corrupt settings', () => {
  const s = migrate({ theme: 'neon', favorites: 'nope', screensaverMinutes: -4, labels: null });
  assert.equal(s.theme, 'midnight');
  assert.deepEqual(s.favorites, DEFAULTS.favorites);
  assert.equal(s.screensaverMinutes, DEFAULTS.screensaverMinutes);
  assert.deepEqual(s.labels, {});
  assert.deepEqual(migrate(null), DEFAULTS);
});

test('migrate v1 → v2 drops ZEE5 from favourites and hides unused apps, keeping the rest', () => {
  const s = migrate({ version: 1, favorites: ['9Ur5IzDKqV.TizenYouTube', 'wKDM33Rods.ZEE5', 'aR24dvmurV.SmartSTBplus'], hidden: ['x.Y'], screensaverMinutes: 5 });
  assert.deepEqual(s.favorites, ['9Ur5IzDKqV.TizenYouTube', 'aR24dvmurV.SmartSTBplus']);
  assert.ok(s.hidden.includes('x.Y') && s.hidden.includes('gzcc4LRFBF.Peacock'));
  assert.equal(s.screensaverMinutes, 5);
  assert.equal(s.version, 2);
  // Already v2: the owner's own choices are left alone.
  assert.deepEqual(migrate({ ...s, favorites: ['wKDM33Rods.ZEE5'], hidden: [] }).favorites, ['wKDM33Rods.ZEE5']);
});
