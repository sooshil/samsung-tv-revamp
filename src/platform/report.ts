// Diagnostic telemetry to the Mac listener (scripts/probe-receiver.py).
// Compiled to a no-op in production builds: __REPORT_URL__ is '' unless built with --bench or --selftest.
export function report(section: string, data: unknown): void {
  if (!__REPORT_URL__) return;
  try {
    const x = new XMLHttpRequest();
    x.open('POST', __REPORT_URL__, true);
    x.setRequestHeader('Content-Type', 'text/plain');
    x.send(JSON.stringify({ section, t: Math.round(performance.now()), data }));
  } catch (e) { /* listener not running */ }
}
