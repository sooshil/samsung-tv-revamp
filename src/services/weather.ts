// Weather from Open-Meteo (free, no key, no account). The only automatic network call the dashboard makes.
// Privacy: coordinates are rounded to 2 decimals (~1 km) before they leave the TV.
// Fetches on start and on resume when the cache is older than 30 min, and every 30 min while on screen; never while hidden.
import { onVisibility, isVisible } from '../platform/lifecycle';

export interface Place { name: string; lat: number; lon: number; }
export interface Weather {
  at: number;                 // fetch time (ms)
  place: string;
  units: 'F' | 'C';
  temp: number;
  code: number;               // WMO weather code
  isDay: boolean;
  today: { hi: number; lo: number; code: number };
  days: { date: string; hi: number; lo: number; code: number }[];
}

const KEY = 'tvr.weather';
const FRESH_MS = 30 * 60000;
const MAX_AGE_MS = 6 * 3600000;     // older than this is not shown at all

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function weatherUrl(p: Place, units: 'F' | 'C'): string {
  return 'https://api.open-meteo.com/v1/forecast?latitude=' + round2(p.lat) + '&longitude=' + round2(p.lon) +
    '&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code' +
    '&temperature_unit=' + (units === 'F' ? 'fahrenheit' : 'celsius') + '&timezone=auto&forecast_days=4';
}

interface ApiResponse {
  current: { temperature_2m: number; weather_code: number; is_day: number };
  daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; weather_code: number[] };
}

export function parse(r: ApiResponse, place: string, units: 'F' | 'C', at: number): Weather {
  const d = r.daily;
  const days = d.time.map((t, i) => ({ date: t, hi: Math.round(d.temperature_2m_max[i]), lo: Math.round(d.temperature_2m_min[i]), code: d.weather_code[i] }));
  return {
    at, place, units,
    temp: Math.round(r.current.temperature_2m), code: r.current.weather_code, isDay: r.current.is_day === 1,
    today: { hi: days[0].hi, lo: days[0].lo, code: days[0].code }, days: days.slice(1),
  };
}

/** WMO code → short label and icon name. */
export function describe(code: number, isDay = true): { label: string; icon: string } {
  if (code === 0) return { label: isDay ? 'Clear' : 'Clear night', icon: isDay ? 'sun' : 'moon' };
  if (code <= 2) return { label: 'Partly cloudy', icon: isDay ? 'partly' : 'partlyNight' };
  if (code === 3) return { label: 'Cloudy', icon: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'fog' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: 'rain' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: code >= 80 ? 'Showers' : 'Rain', icon: 'rain' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: 'Snow', icon: 'snow' };
  if (code >= 95) return { label: 'Thunderstorms', icon: 'storm' };
  return { label: 'Cloudy', icon: 'cloud' };
}

function readCache(): Weather | null {
  try { const s = localStorage.getItem(KEY); return s ? (JSON.parse(s) as Weather) : null; } catch (e) { return null; }
}
function writeCache(w: Weather): void { try { localStorage.setItem(KEY, JSON.stringify(w)); } catch (e) { /* ignore */ } }

function getJson(url: string): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.timeout = 10000;
    x.onload = () => { if (x.status === 200) { try { resolve(JSON.parse(x.responseText)); } catch (e) { reject(e); } } else reject(new Error('HTTP ' + x.status)); };
    x.onerror = () => reject(new Error('network'));
    x.ontimeout = () => reject(new Error('timeout'));
    x.send();
  });
}

export class WeatherService {
  private timer = 0;
  private listeners: ((w: Weather | null) => void)[] = [];
  private inflight = false;

  constructor(private config: () => { enabled: boolean; place: Place | null; units: 'F' | 'C' }) {
    onVisibility((v) => { if (v) { this.refreshIfStale(); this.schedule(); } else window.clearInterval(this.timer); });
  }

  onChange(l: (w: Weather | null) => void): void { this.listeners.push(l); }

  /** Cached value if usable for the current settings, else null. */
  current(): Weather | null {
    const c = this.config();
    const w = readCache();
    if (!c.enabled || !c.place || !w) return null;
    if (w.place !== c.place.name || w.units !== c.units || Date.now() - w.at > MAX_AGE_MS) return null;
    return w;
  }

  start(): void { this.emit(); this.refreshIfStale(); this.schedule(); }

  /** Settings changed: show what we have and fetch if needed. */
  reconfigure(): void { this.emit(); this.refreshIfStale(); }

  private schedule(): void {
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => { if (isVisible()) this.refreshIfStale(); }, FRESH_MS);
  }

  private refreshIfStale(): void {
    const c = this.config();
    if (!c.enabled || !c.place || this.inflight) return;
    const w = this.current();
    if (w && Date.now() - w.at < FRESH_MS - 60000) return;
    this.inflight = true;
    const place = c.place, units = c.units;
    getJson(weatherUrl(place, units))
      .then((r) => { writeCache(parse(r, place.name, units, Date.now())); })
      .catch(() => { /* offline: keep showing the cached value until it is too old */ })
      .then(() => { this.inflight = false; this.emit(); });
  }

  private emit(): void { const w = this.current(); this.listeners.forEach((l) => l(w)); }
}
