import { performance } from 'node:perf_hooks';
import { SearchStrategy } from './SearchStrategy.js';
import { SearchResult } from '../models/SearchResult.js';
import { escapeChar } from './_util.js';

export class BoyerMooreSearch extends SearchStrategy {
  getKey() { return 'bm'; }
  getName() { return 'Boyer-Moore'; }
  getComplexity() {
    return { best: 'O(n/m)', average: 'O(n/m)', worst: 'O(n*m)', space: 'O(sigma)' };
  }

  buildBadChar(pattern) {
    const bc = Object.create(null);
    for (let i = 0; i < pattern.length; i++) bc[pattern[i]] = i;
    return bc;
  }

  search(text, pattern) {
    const n = text.length;
    const m = pattern.length;
    const matches = [];
    let comparisons = 0;
    const start = performance.now();

    if (m === 0 || m > n) {
      return new SearchResult({
        algorithm: this.getKey(),
        pattern,
        textLength: n,
        matches,
        comparisons,
        durationMs: performance.now() - start,
      });
    }

    const bc = this.buildBadChar(pattern);
    let s = 0;
    while (s <= n - m) {
      let j = m - 1;
      while (j >= 0) {
        comparisons++;
        if (pattern[j] !== text[s + j]) break;
        j--;
      }
      if (j < 0) {
        matches.push(s);
        s += (s + m < n) ? m - (bc[text[s + m]] ?? -1) : 1;
      } else {
        s += Math.max(1, j - (bc[text[s + j]] ?? -1));
      }
    }

    return new SearchResult({
      algorithm: this.getKey(),
      pattern,
      textLength: n,
      matches,
      comparisons,
      durationMs: performance.now() - start,
      extra: { badCharTable: { ...bc } },
    });
  }

  getSteps(text, pattern) {
    const steps = [];
    const n = text.length;
    const m = pattern.length;
    if (m === 0 || m > n) {
      return [{ type: 'nomatch', description: 'Padrao invalido ou maior que o texto.' }];
    }
    const bc = this.buildBadChar(pattern);
    steps.push({
      type: 'bad_char_table',
      table: { ...bc },
      pattern,
      description: `Tabela Bad Character: {${Object.entries(bc).map(([k, v]) => `'${escapeChar(k)}'->${v}`).join(', ')}}`,
    });

    let s = 0;
    while (s <= n - m) {
      let j = m - 1;
      while (j >= 0) {
        const match = pattern[j] === text[s + j];
        steps.push({
          type: 'comparison',
          textIndex: s + j,
          patternIndex: j,
          windowStart: s,
          match,
          table: { ...bc },
          description: `Direita->Esquerda: text[${s + j}]='${escapeChar(text[s + j])}' vs pattern[${j}]='${escapeChar(pattern[j])}' -> ${match ? 'ok' : 'mismatch'}`,
        });
        if (!match) break;
        j--;
      }
      if (j < 0) {
        steps.push({
          type: 'found',
          windowStart: s,
          table: { ...bc },
          description: `PADRAO ENCONTRADO na posicao ${s}`,
        });
        s += (s + m < n) ? m - (bc[text[s + m]] ?? -1) : 1;
      } else {
        const bcVal = bc[text[s + j]] ?? -1;
        const shift = Math.max(1, j - bcVal);
        steps.push({
          type: 'shift',
          windowStart: s,
          shift,
          mismatchChar: text[s + j],
          bcVal,
          j,
          table: { ...bc },
          description: `Mismatch em '${escapeChar(text[s + j])}': bad_char=${bcVal} | shift=${shift}`,
        });
        s += shift;
      }
    }
    return steps;
  }
}
