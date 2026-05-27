/**
 * Estrutura padronizada de retorno das buscas.
 * Imutavel apos construcao (Object.freeze).
 */
export class SearchResult {
  constructor({
    algorithm,
    pattern,
    textLength,
    matches,
    comparisons,
    durationMs,
    extra = {},
  }) {
    this.algorithm = algorithm;
    this.pattern = pattern;
    this.patternLength = pattern.length;
    this.textLength = textLength;
    this.matches = matches;
    this.matchCount = matches.length;
    this.comparisons = comparisons;
    this.durationMs = durationMs;
    this.durationUs = durationMs * 1000;
    this.extra = extra;
    Object.freeze(this);
    Object.freeze(this.matches);
    Object.freeze(this.extra);
  }

  toJSON() {
    return {
      algorithm: this.algorithm,
      pattern: this.pattern,
      patternLength: this.patternLength,
      textLength: this.textLength,
      matches: this.matches,
      matchCount: this.matchCount,
      comparisons: this.comparisons,
      durationMs: this.durationMs,
      durationUs: this.durationUs,
      extra: this.extra,
    };
  }
}
