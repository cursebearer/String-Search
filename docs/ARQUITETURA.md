# Arquitetura — Etapa 2

## Visão geral

A aplicação foi reestruturada em **3 camadas** claras:

1. **Domínio** (`server/algorithms/`, `server/models/`) — algoritmos puros, sem dependência de framework.
2. **Aplicação** (`server/routes/`) — orquestra chamadas, valida entrada, instrumenta com OTel.
3. **Apresentação** (`public/`) — UI que consome a API REST.

A separação resolve o principal problema da etapa 1: tudo estava num único `app.js` misturando lógica de algoritmo, manipulação de DOM e cálculo de métricas.

## Padrões de projeto aplicados

### Strategy

Cada algoritmo é uma classe que estende `SearchStrategy`:

```
SearchStrategy (abstract)
├── NaiveSearch
├── RabinKarpSearch
├── KMPSearch
└── BoyerMooreSearch
```

A interface define:
- `getKey()` — id do algoritmo
- `getName()` — nome legível
- `getComplexity()` — complexidades teóricas
- `search(text, pattern) → SearchResult` — execução
- `getSteps(text, pattern) → Step[]` — passos didáticos para visualização

O `SearchContext` mantém um mapa `key → instância` e expõe `run(key, text, pattern)`. Adicionar um quinto algoritmo (ex.: Z-Algorithm) é apenas:
1. criar `ZAlgorithmSearch.js`
2. importar e adicionar no array do `SearchContext`

Nenhuma outra parte do sistema (rotas, métricas, frontend) precisa mudar — característica clássica do Strategy.

### Result Object (Value Object)

`SearchResult` é uma classe imutável (`Object.freeze`) com formato padronizado:

```js
{
  algorithm, pattern, patternLength, textLength,
  matches, matchCount,
  comparisons, durationMs, durationUs,
  extra: { /* lps, badCharTable, spuriousHits, etc */ }
}
```

Padronizar o retorno permite:
- mesmas métricas para todos os algoritmos (sem ifs por tipo)
- frontend único independente do algoritmo
- testes uniformes

### Separação de responsabilidades

| Responsabilidade | Lugar |
|---|---|
| Lógica algorítmica pura | `server/algorithms/*.js` |
| Modelo de dados | `server/models/SearchResult.js` |
| HTTP / validação | `server/routes/search.js` |
| Bootstrap / DI | `server/index.js` |
| Observabilidade (cross-cutting) | `server/tracing.js`, `metrics.js`, `logger.js` |
| Visualização / DOM | `public/app.js` |

Os algoritmos **não conhecem** Express, OpenTelemetry, nem o DOM. Isso os torna testáveis de forma isolada e reutilizáveis em outros contextos (CLI, worker, etc.).

## Decisões justificadas

**Por que backend Node em vez de frontend puro?**
OpenTelemetry tem um SDK browser, mas o ecossistema (exporters maduros, instrumentação automática, integração com Collector) é dominado pelo Node. Como a rubrica pede "observabilidade de verdade", o backend torna possível tracer instrumentação real (HTTP server, queries futuras a banco, etc.).

**Por que OTel Collector em vez de exportar direto para Jaeger/Prometheus?**
O Collector é o padrão da indústria — desacopla a aplicação dos backends de telemetria. Hoje mandamos para Jaeger; amanhã podemos mudar para Tempo/Datadog sem tocar uma linha do código da aplicação.

**Por que primo grande no Rabin-Karp (`1_000_000_007`)?**
Na etapa 1 usamos `q=101`, que gera muitas colisões e degrada o algoritmo para O(n·m) na prática. Aumentando o primo o algoritmo se aproxima do desempenho teórico, e expomos o número de "spurious hits" como atributo do span para análise.

**Por que pino e não winston?**
pino é o logger Node mais rápido (~5x winston) e tem suporte nativo a JSON estruturado — combina com a estratégia de mandar logs para o Collector via OTLP. Usamos `pino-pretty` só em dev.
