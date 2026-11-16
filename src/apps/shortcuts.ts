// Shortcuts to Samsung system panels, shown first in "All apps".
// Verified on this TV (2026-11-15, --selftest=launchers): these open as panels over the dashboard and take focus.
// The full Settings app (com.samsung.tv.coba.setting) accepts a launch but shows nothing, so it isn't offered.
import type { AppEntry } from './catalog';

export const SHORTCUTS: AppEntry[] = [
  { id: 'com.samsung.tv.quickpanel', name: 'Quick Settings', label: 'Quick Settings', iconPath: null, version: '', shortcut: { icon: 'sliders' } },
  { id: 'org.tizen.btaudiolist', name: 'Bluetooth Audio', label: 'Bluetooth Audio', iconPath: null, version: '', shortcut: { icon: 'speaker' } },
];
