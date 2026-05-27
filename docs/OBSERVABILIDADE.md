# Observabilidade

## Os três pilares — onde estão e como inspecionar

| Pilar | Implementação | Onde ver |
|---|---|---|
| **Traces** | Spans manuais por algoritmo + auto-instrumentação Express/HTTP | Jaeger UI — http://localhost:16686 |
| **Métricas** | Counters e histograms via `@opentelemetry/api` | Grafana — http://localhost:3001 |
| **Logs** | pino estruturado com `trace_id`/`span_id` injetados | terminal do `npm start` (ou Loki, se adicionado) |

## Setup do SDK

O arquivo `server/tracing.js` é carregado **antes** do código da aplicação via `node --import ./server/tracing.js server/index.js`. Isso garante que a auto-instrumentação consiga interceptar `require/import` do Express, http, etc.

```js
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'string-search',
    [ATTR_SERVICE_VERSION]: '2.0.0',
  }),
  traceExporter: new OTLPTraceExporter({ url: '.../v1/traces' }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: '.../v1/metrics' }),
    exportIntervalMillis: 5000,
  }),
  instrumentations: [getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-fs': { enabled: false },
  })],
});
```

Desligamos o instrumentation-fs porque ele cria spans para **cada** operação de filesystem, poluindo a UI do Jaeger.

## Traces

Cada `POST /api/search` gera uma árvore como:

```
HTTP POST /api/search                         [auto: instrumentation-http]
└── express middleware - router               [auto: instrumentation-express]
    └── search.kmp                            [manual: routes/search.js]
        ├── attributes:
        │   search.algorithm = "kmp"
        │   search.text_length = 1245678
        │   search.pattern_length = 5
        │   search.matches = 89
        │   search.comparisons = 1245803
        │   search.duration_ms = 32.18
        └── status = OK
```

E para `POST /api/compare`:

```
HTTP POST /api/compare
└── compare.all
    ├── search.naive
    ├── search.rk
    ├── search.kmp
    └── search.bm
```

Permite **visualmente** comparar a duração relativa dos 4 algoritmos para o mesmo input, no mesmo trace.

## Métricas

Todas com label `algorithm` para permitir slicing.

| Nome (OTel) | Nome (Prometheus) | Tipo |
|---|---|---|
| `string_search.searches` | `string_search_searches_total` | counter |
| `string_search.duration_ms` | `string_search_duration_ms_bucket/_sum/_count` | histogram |
| `string_search.comparisons` | `string_search_comparisons_bucket/_sum/_count` | histogram |
| `string_search.matches` | `string_search_matches_bucket/_sum/_count` | histogram |
| `string_search.text_size` | `string_search_text_size_bucket/_sum/_count` | histogram |
| `string_search.pattern_size` | `string_search_pattern_size_bucket/_sum/_count` | histogram |
| `string_search.errors` | `string_search_errors_total` | counter |

### Queries PromQL úteis

```promql
# req/s por algoritmo
sum by (algorithm) (rate(string_search_searches_total[1m]))

# p95 de duração por algoritmo
histogram_quantile(0.95,
  sum by (le, algorithm) (rate(string_search_duration_ms_bucket[5m]))
)

# tempo médio
sum by (algorithm) (rate(string_search_duration_ms_sum[5m]))
/
sum by (algorithm) (rate(string_search_duration_ms_count[5m]))
```

## Logs

pino emite JSON em produção, formato bonito em dev. O mixin injeta automaticamente `trace_id` e `span_id` do contexto OTel ativo:

```json
{
  "level": "info",
  "time": 1716742583124,
  "trace_id": "8f3e7b...",
  "span_id": "a91c4b...",
  "algorithm": "kmp",
  "matches": 89,
  "comparisons": 1245803,
  "durationMs": 32.18,
  "msg": "search executed"
}
```

Isso permite no Jaeger clicar num span e ir direto para os logs daquele trace (em produção, com Loki/Tempo correlation).

## Dashboard

Provisionado em `observability/grafana/dashboards/string-search.json`. Painéis:

1. **Total de buscas** (stat global)
2. **Buscas por algoritmo** (stat horizontal)
3. **Taxa de execução** (req/s por algoritmo) — vê picos de carga
4. **Duração p95** por algoritmo — vê regressão de performance
5. **Duração média** (barchart) — comparação direta entre algoritmos
6. **Comparações médias** (barchart) — confirma a teoria: BM/KMP fazem menos
7. **Distribuição de tamanho do texto** (p50/p95/p99) — entende o workload real
8. **Erros totais** — alerta visual

## Como verificar manualmente

```powershell
# manda algumas requests
curl -X POST http://localhost:3000/api/search `
  -H "Content-Type: application/json" `
  -d '{"text":"abracadabra","pattern":"abra","algorithm":"kmp"}'

# vê o trace no Jaeger
start http://localhost:16686

# vê as métricas cruas no Prometheus
start http://localhost:9090/graph?g0.expr=string_search_searches_total

# vê o dashboard no Grafana
start http://localhost:3001
```
