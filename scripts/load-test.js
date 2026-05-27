/**
 * Script de carga — dispara N buscas contra o backend usando os textos do corpus
 * baixado por fetch-corpus.js. Popula os dashboards Grafana com dados reais.
 *
 * Uso:
 *   npm run load-test                          # padroes default
 *   node scripts/load-test.js 200 the,and,of   # 200 buscas, padroes especificos
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = path.resolve(__dirname, '..', 'data', 'corpus');
const API = process.env.API_URL || 'http://localhost:3000';

const N = parseInt(process.argv[2] || '100', 10);
const PATTERNS = (process.argv[3] || 'the,and,of,was,Captain,whale,monster,Holmes,love,Elizabeth')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);
const ALGORITHMS = ['naive', 'rk', 'kmp', 'bm'];

async function loadCorpus() {
  const files = await readdir(CORPUS_DIR).catch(() => []);
  const texts = [];
  for (const f of files.filter((x) => x.endsWith('.txt'))) {
    const content = await readFile(path.join(CORPUS_DIR, f), 'utf-8');
    texts.push({ name: f, text: content });
  }
  if (!texts.length) {
    console.error(`nenhum .txt em ${CORPUS_DIR}. rode primeiro: npm run fetch-corpus`);
    process.exit(1);
  }
  return texts;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function runOne(text, pattern, algorithm) {
  const t0 = Date.now();
  const res = await fetch(`${API}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, pattern, algorithm }),
  });
  const elapsed = Date.now() - t0;
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }
  const json = await res.json();
  return { algorithm, pattern, matches: json.matchCount, serverMs: json.durationMs, networkMs: elapsed };
}

async function main() {
  const texts = await loadCorpus();
  console.log(`corpus: ${texts.length} arquivo(s) | total ${texts.reduce((s, t) => s + t.text.length, 0).toLocaleString()} chars`);
  console.log(`disparando ${N} buscas contra ${API} ...\n`);

  const stats = Object.fromEntries(ALGORITHMS.map((a) => [a, { n: 0, totalMs: 0, totalComps: 0 }]));

  for (let i = 0; i < N; i++) {
    const t = pick(texts);
    const pattern = pick(PATTERNS);
    const algo = ALGORITHMS[i % ALGORITHMS.length];
    try {
      const r = await runOne(t.text, pattern, algo);
      stats[algo].n++;
      stats[algo].totalMs += r.serverMs;
      if (i % 10 === 0) {
        process.stdout.write(`[${String(i + 1).padStart(4)}/${N}] ${algo.padEnd(5)} "${pattern}" em ${t.name.padEnd(20)} -> ${r.matches} matches em ${r.serverMs.toFixed(2)}ms\n`);
      }
    } catch (err) {
      console.error(`  erro: ${err.message}`);
    }
  }

  console.log('\nResumo por algoritmo:');
  for (const [algo, s] of Object.entries(stats)) {
    if (s.n === 0) continue;
    console.log(`  ${algo.padEnd(6)} | n=${s.n} | tempo medio=${(s.totalMs / s.n).toFixed(3)}ms`);
  }
  console.log('\nAbra o Grafana em http://localhost:3001 para ver os dashboards.');
}

main().catch((err) => {
  console.error('erro fatal:', err);
  process.exit(1);
});
