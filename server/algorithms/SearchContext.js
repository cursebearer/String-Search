import { NaiveSearch } from './NaiveSearch.js';
import { RabinKarpSearch } from './RabinKarpSearch.js';
import { KMPSearch } from './KMPSearch.js';
import { BoyerMooreSearch } from './BoyerMooreSearch.js';

/**
 * Context do padrao Strategy.
 * Mantem um mapa de estrategias disponiveis e roteia chamadas.
 */
export class SearchContext {
  constructor() {
    const algorithms = [
      new NaiveSearch(),
      new RabinKarpSearch(),
      new KMPSearch(),
      new BoyerMooreSearch(),
    ];
    this.strategies = Object.fromEntries(algorithms.map((a) => [a.getKey(), a]));
  }

  hasStrategy(key) {
    return Object.prototype.hasOwnProperty.call(this.strategies, key);
  }

  getStrategy(key) {
    const s = this.strategies[key];
    if (!s) throw new Error(`Algoritmo desconhecido: ${key}`);
    return s;
  }

  listStrategies() {
    return Object.values(this.strategies).map((s) => ({
      key: s.getKey(),
      name: s.getName(),
      complexity: s.getComplexity(),
    }));
  }

  run(key, text, pattern) {
    return this.getStrategy(key).search(text, pattern);
  }

  steps(key, text, pattern) {
    return this.getStrategy(key).getSteps(text, pattern);
  }

  runAll(text, pattern) {
    return Object.values(this.strategies).map((s) => s.search(text, pattern));
  }
}

export const searchContext = new SearchContext();
