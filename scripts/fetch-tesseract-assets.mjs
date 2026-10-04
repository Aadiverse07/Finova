import { cp, mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'public', 'tesseract');
await mkdir(out, { recursive: true });

async function walk(dir) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await walk(full)); else found.push(full);
  }
  return found;
}

const workerCandidates = await walk(join(root, 'node_modules', 'tesseract.js'));
const coreCandidates = await walk(join(root, 'node_modules', 'tesseract.js-core'));
const worker = workerCandidates.find((x) => x.endsWith('worker.min.js'));
const core = coreCandidates.find((x) => x.endsWith('tesseract-core.wasm.js'));
const wasm = coreCandidates.find((x) => x.endsWith('.wasm'));
if (worker) await cp(worker, join(out, 'worker.min.js'));
if (core) await cp(core, join(out, 'tesseract-core.wasm.js'));
if (wasm) await cp(wasm, join(out, 'tesseract-core.wasm'));
const report = { worker: Boolean(worker), core: Boolean(core), wasm: Boolean(wasm), languageData: ['eng.traineddata.gz', 'hin.traineddata.gz'].filter((x) => existsSync(join(out, x))) };
await writeFile(join(out, 'manifest.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!worker || !core) process.exitCode = 1;
