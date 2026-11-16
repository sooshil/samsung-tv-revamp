import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, describe, weatherUrl } from '../src/services/weather';

test('weatherUrl rounds coordinates to 2 decimals', () => {
  const u = weatherUrl({ name: 'X', lat: 40.123456, lon: -75.006789 }, 'F');
  assert.match(u, /latitude=40\.12&longitude=-75\.01&/);
  assert.match(u, /temperature_unit=fahrenheit/);
});

test('parse maps Open-Meteo response', () => {
  const w = parse({
    current: { temperature_2m: 44.9, weather_code: 3, is_day: 1 },
    daily: { time: ['2026-11-15', '2026-11-16', '2026-11-17'], temperature_2m_max: [48.8, 56.1, 61.7], temperature_2m_min: [44.7, 44.6, 42.7], weather_code: [61, 3, 0] },
  }, 'Springfield', 'F', 1);
  assert.equal(w.temp, 45);
  assert.deepEqual(w.today, { hi: 49, lo: 45, code: 61 });
  assert.equal(w.days.length, 2);
});

test('describe covers WMO groups', () => {
  assert.equal(describe(0).icon, 'sun');
  assert.equal(describe(0, false).icon, 'moon');
  assert.equal(describe(63).label, 'Rain');
  assert.equal(describe(81).label, 'Showers');
  assert.equal(describe(75).icon, 'snow');
  assert.equal(describe(96).icon, 'storm');
});
