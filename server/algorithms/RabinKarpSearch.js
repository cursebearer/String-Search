import { performance } from 'node:perf_hooks';
import { SearchStrategy } from './SearchStrategy.js';
import { SearchResult } from '../models/SearchResult.js';
import { escapeChar } from './_util.js';

const BASE = 256;
const PRIME = 1_000_000_007;

export class RabinKarpSearch extends SearchStrategy {
  getKey() { return 'rk'; }
  getName() { return 'Rabin-Karp'; }
  getComplexity() {
    return { best: 'O(n+m)', average: 'O(n+m)', worst: 'O(n*m)', space: 'O(1)' };
  }

  _modPow(base, exp, mod) {
    let result = 1n;
    let b = BigInt(base) % BigInt(mod);
    let e = BigInt(exp);
    const m = BigInt(mod);
    while (e > 0n) {
      if (e & 1n) result = (result * b) % m;
      b = (b * b) % m;
      e >>= 1n;
    }
    return Number(result);
  }

  search(text, pattern) {
    const n = text.length;
    const m = pattern.length;
    const matches = [];
    let comparisons = 0;
    let spuriousHits = 0;
    const start = performance.now();

    if (m === 0 || m > n) {
      return new SearchResult({
        algorithm: this.getKey(),
        pattern,
        textLength: n,
        matches,
        comparisons,
        durationMs: performance.now() - start,
        extra: { spuriousHits, base: BASE, prime: PRIME },
      });
    }

    const h = this._modPow(BASE, m - 1, PRIME);
    let p = 0;
    let t = 0;
    for (let i = 0; i < m; i++) {
      p = (BASE * p + pattern.charCodeAt(i)) % PRIME;
      t = (BASE * t + text.charCodeAt(i)) % PRIME;
    }

    for (let i = 0; i <= n - m; i++) {
      if (p === t) {
        let j = 0;
        while (j < m) {
          comparisons++;
          if (text[i + j] !== pattern[j]) break;
          j++;
        }
        if (j === m) matches.push(i);
        else spuriousHits++;
      }
      if (i < n - m) {
        t = (BASE * (t - text.charCodeAt(i) * h) + text.charCodeAt(i + m)) % PRIME;
        if (t < 0) t += PRIME;
      }
    }

    return new SearchResult({
      algorithm: this.getKey(),
      pattern,
      textLength: n,
      matches,
      comparisons,
      durationMs: performance.now() - start,
      extra: { spuriousHits, base: BASE, prime: PRIME },
    });
  }

  getSteps(text, pattern) {
    const steps = [];
    const n = text.length;
    const m = pattern.length;
    const q = 101;
    const d = 256;

    if (m === 0 || m > n) {
      return [{ type: 'nomatch', description: 'Padrao invalido ou maior que o texto.' }];
    }

    let h = 1;
    for (let i = 0; i < m - 1; i++) h = (h * d) % q;
    let p = 0;
    let t = 0;
    for (let i = 0; i < m; i++) {
      p = (d * p + pattern.charCodeAt(i)) % q;
      t = (d * t + text.charCodeAt(i)) % q;
    }

    steps.push({
      type: 'hash_init',
      patternHash: p,
      windowHash: t,
      windowStart: 0,
      description: `Inicializacao didatica: hash(padrao)=${p} | hash(janela)=${t} | d=${d}, q=${q}`,
    });

    for (let i = 0; i <= n - m; i++) {
      const hm = p === t;
      steps.push({
        type: 'hash_check',
        windowStart: i,
        patternHash: p,
        windowHash: t,
        hashMatch: hm,
        description: `Janela [${i}..${i + m - 1}]: hash=${t} vs hash_padrao=${p} -> ${hm ? 'POSSIVEL MATCH' : 'hashes diferentes, pular'}`,
      });
      if (hm) {
        let j = 0;
        while (j < m) {
          const match = text[i + j] === pattern[j];
          steps.push({
            type: 'comparison',
            textIndex: i + j,
            patternIndex: j,
            windowStart: i,
            match,
            description: `Verificacao char: text[${i + j}]='${escapeChar(text[i + j])}' vs pattern[${j}]='${escapeChar(pattern[j])}' -> ${match ? 'ok' : 'falso positivo'}`,
          });
          if (!match) break;
          if (j === m - 1) {
            steps.push({ type: 'found', windowStart: i, description: `PADRAO ENCONTRADO na posicao ${i}` });
          }
          j++;
        }
      }
      if (i < n - m) {
        t = (d * (t - text.charCodeAt(i) * h) + text.charCodeAt(i + m)) % q;
        if (t < 0) t += q;
        steps.push({
          type: 'roll_hash',
          windowStart: i + 1,
          windowHash: t,
          patternHash: p,
          description: `Rolling hash: remove '${escapeChar(text[i])}', adiciona '${escapeChar(text[i + m])}' -> novo hash=${t}`,
        });
      }
    }
    return steps;
  }
}
