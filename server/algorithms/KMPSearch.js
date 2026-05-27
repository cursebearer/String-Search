import { performance } from 'node:perf_hooks';
import { SearchStrategy } from './SearchStrategy.js';
import { SearchResult } from '../models/SearchResult.js';
import { escapeChar } from './_util.js';

export class KMPSearch extends SearchStrategy {
  getKey() { return 'kmp'; }
  getName() { return 'Knuth-Morris-Pratt (KMP)'; }
  getComplexity() {
    return { best: 'O(n)', average: 'O(n+m)', worst: 'O(n+m)', space: 'O(m)' };
  }

  buildLPS(pattern) {
    const m = pattern.length;
    const lps = new Array(m).fill(0);
    let len = 0;
    let i = 1;
    while (i < m) {
      if (pattern[i] === pattern[len]) {
        lps[i++] = ++len;
      } else if (len > 0) {
        len = lps[len - 1];
      } else {
        lps[i++] = 0;
      }
    }
    return lps;
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

    const lps = this.buildLPS(pattern);
    let i = 0;
    let j = 0;
    while (i < n) {
      comparisons++;
      if (text[i] === pattern[j]) {
        i++;
        j++;
        if (j === m) {
          matches.push(i - j);
          j = lps[j - 1];
        }
      } else if (j > 0) {
        j = lps[j - 1];
      } else {
        i++;
      }
    }

    return new SearchResult({
      algorithm: this.getKey(),
      pattern,
      textLength: n,
      matches,
      comparisons,
      durationMs: performance.now() - start,
      extra: { lpsTable: lps },
    });
  }

  getSteps(text, pattern) {
    const steps = [];
    const n = text.length;
    const m = pattern.length;
    if (m === 0 || m > n) {
      return [{ type: 'nomatch', description: 'Padrao invalido ou maior que o texto.' }];
    }
    const lps = this.buildLPS(pattern);
    steps.push({
      type: 'lps_table',
      lps: [...lps],
      pattern,
      description: `Tabela LPS construida: [${lps.join(', ')}]`,
    });

    let i = 0;
    let j = 0;
    while (i < n) {
      const match = text[i] === pattern[j];
      steps.push({
        type: 'comparison',
        textIndex: i,
        patternIndex: j,
        windowStart: i - j,
        match,
        lps: [...lps],
        description: `text[${i}]='${escapeChar(text[i])}' vs pattern[${j}]='${escapeChar(pattern[j])}' -> ${match ? 'match' : 'mismatch'}`,
      });
      if (match) {
        i++;
        j++;
        if (j === m) {
          steps.push({
            type: 'found',
            windowStart: i - j,
            lps: [...lps],
            description: `PADRAO ENCONTRADO na posicao ${i - j}`,
          });
          j = lps[j - 1];
        }
      } else if (j > 0) {
        j = lps[j - 1];
      } else {
        i++;
      }
    }
    return steps;
  }
}
