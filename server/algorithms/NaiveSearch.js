import { performance } from 'node:perf_hooks';
import { SearchStrategy } from './SearchStrategy.js';
import { SearchResult } from '../models/SearchResult.js';
import { escapeChar } from './_util.js';

export class NaiveSearch extends SearchStrategy {
  getKey() { return 'naive'; }
  getName() { return 'Naive (Forca Bruta)'; }
  getComplexity() {
    return { best: 'O(n)', average: 'O(n*m)', worst: 'O(n*m)', space: 'O(1)' };
  }

  search(text, pattern) {
    const n = text.length;
    const m = pattern.length;
    const matches = [];
    let comparisons = 0;
    const start = performance.now();

    for (let i = 0; i <= n - m; i++) {
      let j = 0;
      while (j < m) {
        comparisons++;
        if (text[i + j] !== pattern[j]) break;
        j++;
      }
      if (j === m) matches.push(i);
    }

    return new SearchResult({
      algorithm: this.getKey(),
      pattern,
      textLength: n,
      matches,
      comparisons,
      durationMs: performance.now() - start,
    });
  }

  getSteps(text, pattern) {
    const steps = [];
    const n = text.length;
    const m = pattern.length;

    for (let i = 0; i <= n - m; i++) {
      for (let j = 0; j < m; j++) {
        const match = text[i + j] === pattern[j];
        steps.push({
          type: 'comparison',
          textIndex: i + j,
          patternIndex: j,
          windowStart: i,
          match,
          description: `Comparando text[${i + j}]='${escapeChar(text[i + j])}' com pattern[${j}]='${escapeChar(pattern[j])}' -> ${match ? 'match' : 'mismatch'}`,
        });
        if (!match) break;
        if (j === m - 1) {
          steps.push({
            type: 'found',
            windowStart: i,
            description: `PADRAO ENCONTRADO na posicao ${i}`,
          });
        }
      }
    }
    if (steps.length === 0) {
      steps.push({ type: 'nomatch', description: 'Padrao nao encontrado no texto.' });
    }
    return steps;
  }
}
