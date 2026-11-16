// Build: bundles src/ for Chromium 76 into dist/, which is a ready-to-package Tizen web app folder.
//   node scripts/build.mjs           production build
//   node scripts/build.mjs --bench   adds the on-TV benchmark + telemetry to the Mac listener
//   node scripts/build.mjs --serve   desktop dev server (mock Tizen APIs) on http://localhost:8080
//   node scripts/build.mjs --selftest=return   launches the probe app (which closes itself) and reports the return watcher
//   node scripts/build.mjs --tests   compiles tests/ to build/tests/
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

const args = new Set(process.argv.slice(2));
const root = new URL('..', import.meta.url).pathname;

if (args.has('--tests')) {
  rmSync(root + 'build/tests', { recursive: true, force: true });
  await esbuild.build({
    entryPoints: readdirSync(root + 'tests').filter((f) => f.endsWith('.test.ts')).map((f) => root + 'tests/' + f),
    bundle: true, platform: 'node', format: 'esm', outdir: root + 'build/tests', outExtension: { '.js': '.mjs' },
    target: 'node20', logLevel: 'warning',
    define: { __WEATHER_PLACE__: 'null', __DESKTOP__: 'false', __SELFTEST__: '""', __REPORT_URL__: '""' },
  });
  process.exit(0);
}

const bench = args.has('--bench');
const diag = args.has('--diag'); // production build that also reports the return watcher's decisions to the Mac
const selftest = (process.argv.find((a) => a.startsWith('--selftest=')) || '').split('=')[1] || '';
const serve = args.has('--serve');
const desktop = serve || args.has('--desktop');
const macIp = Object.values(networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address ?? '127.0.0.1';
const pkg = JSON.parse(readFileSync(root + 'package.json', 'utf8'));
const out = root + 'dist/';
// Machine-local settings (git-ignored): config/local.json, see config/example.local.json.
let local = {};
try { local = JSON.parse(readFileSync(root + 'config/local.json', 'utf8')); } catch { /* optional */ }
const w = local.weather;
// Only a ~1 km rounded location goes into the bundle and to the weather service.
const weatherPlace = w && typeof w.lat === 'number' && typeof w.lon === 'number'
  ? { name: String(w.name || 'Home'), lat: Math.round(w.lat * 100) / 100, lon: Math.round(w.lon * 100) / 100 } : null;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(root + 'assets', out + 'assets', { recursive: true });
cpSync(root + 'tizen/icon.png', out + 'icon.png');
// Telemetry builds (bench/selftest/diag) may talk to this Mac on the LAN; the production app has no such permission.
const devAccess = bench || selftest || diag ? `<access origin="http://${macIp}:8765" subdomains="false"/>` : '';
writeFileSync(out + 'config.xml', readFileSync(root + 'tizen/config.xml', 'utf8').replace('__VERSION__', pkg.version).replace('__DEV_ACCESS__', devAccess));
writeFileSync(out + 'index.html', readFileSync(root + 'src/index.html', 'utf8'));

const options = {
  entryPoints: { app: root + 'src/main.ts', styles: root + 'src/styles/index.css' },
  bundle: true, outdir: out, target: 'chrome76', format: 'iife', minify: !serve, sourcemap: serve ? 'inline' : false,
  legalComments: 'none', logLevel: 'info',
  loader: { '.jpg': 'file', '.png': 'file' },
  define: {
    __VERSION__: JSON.stringify(pkg.version),
    __BENCH__: String(bench),
    __SELFTEST__: JSON.stringify(selftest),
    __REPORT_URL__: JSON.stringify(bench || selftest || diag ? `http://${macIp}:8765/report` : ''),
    __DESKTOP__: String(desktop),
    __WEATHER_PLACE__: JSON.stringify(weatherPlace),
  },
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: out, port: 8080 });
  console.log(`Desktop preview: http://localhost:${port}  (arrows, Enter, Backspace = Back, Escape = Exit)`);
} else {
  await esbuild.build(options);
  console.log(`dist/ ready (v${pkg.version}${bench ? ', bench → ' + macIp : ''}${selftest ? ', selftest ' + selftest + ' → ' + macIp : ''})`);
}
