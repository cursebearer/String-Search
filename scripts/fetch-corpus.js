/**
 * Baixa livros do Project Gutenberg (textos longos, dominio publico)
 * para usar como corpus de teste com dados reais.
 *
 * Uso: npm run fetch-corpus
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'data', 'corpus');

const BOOKS = [
  { id: 'moby-dick',   url: 'https://www.gutenberg.org/files/2701/2701-0.txt',     label: 'Moby Dick (Melville)' },
  { id: 'frankenstein', url: 'https://www.gutenberg.org/files/84/84-0.txt',         label: 'Frankenstein (Shelley)' },
  { id: 'sherlock',     url: 'https://www.gutenberg.org/files/1661/1661-0.txt',     label: 'Sherlock Holmes (Doyle)' },
  { id: 'pride',        url: 'https://www.gutenberg.org/files/1342/1342-0.txt',     label: 'Pride and Prejudice (Austen)' },
];

async function fetchBook(book) {
  process.stdout.write(`baixando ${book.label}... `);
  const res = await fetch(book.url);
  if (!res.ok) {
    console.log(`FALHOU (HTTP ${res.status})`);
    return null;
  }
  const text = await res.text();
  const file = path.join(OUT_DIR, `${book.id}.txt`);
  await writeFile(file, text, 'utf-8');
  console.log(`ok (${text.length} chars) -> ${file}`);
  return { ...book, length: text.length, file };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const results = [];
  for (const book of BOOKS) {
    const r = await fetchBook(book);
    if (r) results.push(r);
  }
  console.log('\nResumo:');
  results.forEach((r) => console.log(`  - ${r.label}: ${r.length.toLocaleString()} caracteres`));
  console.log(`\nTotal: ${results.reduce((s, r) => s + r.length, 0).toLocaleString()} caracteres em ${OUT_DIR}`);
}

main().catch((err) => {
  console.error('erro:', err);
  process.exit(1);
});
