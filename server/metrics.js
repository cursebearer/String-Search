import { metrics } from '@opentelemetry/api';

/**
 * Metricas customizadas da aplicacao.
 * Expostas via OTLP (ver tracing.js) -> Collector -> Prometheus -> Grafana.
 */
const meter = metrics.getMeter('string-search', '2.0.0');

export const searchesTotal = meter.createCounter('string_search.searches', {
  description: 'Numero total de buscas executadas',
});

export const searchDuration = meter.createHistogram('string_search.duration_ms', {
  description: 'Duracao de uma busca em milissegundos',
});

export const searchComparisons = meter.createHistogram('string_search.comparisons', {
  description: 'Numero de comparacoes realizadas em uma busca',
});

export const searchMatches = meter.createHistogram('string_search.matches', {
  description: 'Numero de ocorrencias encontradas em uma busca',
});

export const textSize = meter.createHistogram('string_search.text_size', {
  description: 'Tamanho do texto (n) submetido',
});

export const patternSize = meter.createHistogram('string_search.pattern_size', {
  description: 'Tamanho do padrao (m) submetido',
});

export const errorsTotal = meter.createCounter('string_search.errors', {
  description: 'Numero total de erros nas buscas',
});

export function recordSearch(result) {
  const attrs = { algorithm: result.algorithm };
  searchesTotal.add(1, attrs);
  searchDuration.record(result.durationMs, attrs);
  searchComparisons.record(result.comparisons, attrs);
  searchMatches.record(result.matchCount, attrs);
  textSize.record(result.textLength, attrs);
  patternSize.record(result.patternLength, attrs);
}
