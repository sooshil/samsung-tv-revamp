// Header weather: icon, temperature, condition and today's high/low, plus a compact 3-day strip.
// Hidden when weather is off, no location is set, or the cached value is older than 6 h.
import { el } from './dom';
import { WEATHER_ICONS } from './weatherIcons';
import { describe, Weather } from '../services/weather';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export class WeatherWidget {
  readonly root = el('div.weather');
  private icon = el('div.weather-icon');
  private temp = el('div.weather-temp');
  private line = el('div.weather-line');
  private days = el('div.weather-days');

  constructor() {
    this.root.appendChild(el('div.weather-now', null, [this.icon, this.temp]));
    this.root.appendChild(this.line);
    this.root.appendChild(this.days);
    this.render(null);
  }

  render(w: Weather | null): void {
    this.root.classList.toggle('empty', !w);
    if (!w) return;
    const d = describe(w.code, w.isDay);
    this.icon.innerHTML = WEATHER_ICONS[d.icon]; // static, trusted markup
    this.temp.textContent = w.temp + '°';
    this.line.textContent = d.label + '  ·  H ' + w.today.hi + '°  L ' + w.today.lo + '°';
    this.days.textContent = '';
    w.days.slice(0, 3).forEach((x) => {
      const dd = describe(x.code);
      const ic = el('span.wd-icon');
      ic.innerHTML = WEATHER_ICONS[dd.icon];
      const name = DAY[new Date(x.date + 'T12:00:00').getDay()];
      this.days.appendChild(el('div.wd', null, [el('span.wd-name', null, [name]), ic, el('span.wd-temp', null, [x.hi + '° / ' + x.lo + '°'])]));
    });
  }

  /** One-line form for the screensaver. */
  static short(w: Weather | null): string {
    if (!w) return '';
    return w.temp + '°  ' + describe(w.code, w.isDay).label;
  }
}
