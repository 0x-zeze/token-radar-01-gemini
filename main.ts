// Meridian Launch Radar entrypoint (Node 22, standard library only, zero network).
// Reads /input/snapshot.json (or --input <path>), fits peer valuation & token-odds models,
// validates held-out twice (walk-forward and LOO), writes /output/board.json, /output/data.js,
// copies dashboard/ and screenshots/ into /output, and writes /output/dossier.json via buildDossier.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const TEXT_MAX_BYTES = 65_536;
const DOSSIER_MAX_BYTES = 1_572_864;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const DASHBOARD_CAPS = { max_files: 400, max_bytes: 4_194_304 };
const PLAIN_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
const NET_URL_RE = /https?:\/\//i;

function readArg(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${flag}`);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1]!;
  const prefix = `--${flag}=`;
  const eq = process.argv.find((a) => a.startsWith(prefix));
  return eq !== undefined ? eq.slice(prefix.length) : fallback;
}

function copyDirFlat(srcDir: string, dstDir: string): string[] {
  if (!existsSync(srcDir)) return [];
  mkdirSync(dstDir, { recursive: true });
  const names = readdirSync(srcDir).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const copied: string[] = [];
  for (const name of names) {
    if (name.startsWith('.')) continue;
    const src = join(srcDir, name);
    if (!statSync(src).isFile()) continue;
    if (!PLAIN_NAME.test(name)) {
      throw new Error(`invalid filename in ${srcDir}: ${name}`);
    }
    copyFileSync(src, join(dstDir, name));
    copied.push(name);
  }
  return copied;
}

const inputArg = readArg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`meridian radar: missing snapshot at ${inputFile}\n`);
  process.exit(2);
}

const outDir = readArg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, payload } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`meridian radar: board validation failed: ${issue}\n`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ as_of: snapshot.as_of, model: payload.model_name, rows: board })}\n`);
writeFileSync(join(outDir, 'data.js'), dataScript(payload));

const dashFiles = copyDirFlat(join(ROOT, 'dashboard'), join(outDir, 'dashboard'));
for (const name of dashFiles) {
  const body = readFileSync(join(outDir, 'dashboard', name), 'utf8');
  if (NET_URL_RE.test(body)) {
    process.stderr.write(`meridian radar: dashboard/${name} contains a forbidden network URL\n`);
    process.exit(1);
  }
}
const shotFiles = copyDirFlat(join(ROOT, 'screenshots'), join(outDir, 'screenshots'));

let dossierBytes = 0;
if (shotFiles.length >= 3) {
  const dossier = buildDossier(outDir, {
    text_max_bytes: TEXT_MAX_BYTES,
    screenshots: SCREENSHOT_CAPS,
    dashboard: DASHBOARD_CAPS,
  });
  dossierBytes = dossier.length;
  if (dossierBytes > DOSSIER_MAX_BYTES) {
    process.stderr.write(`meridian radar: dossier.json is ${dossierBytes} bytes, over 1.5 MiB cap\n`);
    process.exit(1);
  }
  writeFileSync(join(outDir, 'dossier.json'), dossier);
} else {
  process.stderr.write(`meridian radar: screenshots/ has ${shotFiles.length} file(s); need 3 to 4 images to write dossier.json\n`);
  process.exit(1);
}

const fullVal = payload.validation.terms[payload.validation.terms.length - 1]!;
process.stdout.write(
  `meridian radar: ${payload.summary.total_protocols} protocols accounted (${payload.summary.watchlist_count} watchlist, ${payload.summary.early_count} early, ${payload.summary.derivative_count} derivative, ${payload.summary.live_count} live)\n` +
    `meridian radar: peer fit (n=${payload.valuation.peer_count}) WF x${fullVal.walk_forward.med_mult} | LOO x${fullVal.loo.med_mult} | odds AUC ${payload.validation.odds.cv10_auc}\n` +
    `meridian radar: wrote board.json, data.js, dashboard/ (${dashFiles.length} files), screenshots/ (${shotFiles.length} images), dossier.json (${dossierBytes} bytes)\n`,
);
