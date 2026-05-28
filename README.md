# String Search — Etapa 2 (Observabilidade)

Comparador interativo dos algoritmos **Naive, Rabin-Karp, KMP e Boyer-Moore**, agora com backend Node.js, instrumentação **OpenTelemetry** e stack completa de observabilidade (Jaeger + Prometheus + Grafana).

> Etapa 1 entregou a corretude algorítmica + visualização. Esta etapa adiciona engenharia de software, padrões de projeto, e observabilidade ponta a ponta.

---

> **Equipe:** Rafael e Lucas
> **Disciplina:** Algoritmos Avancados 
> **Data:** 27/05/2026

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js 20+, Express, ES Modules |
| Frontend | HTML/CSS/JS puro (servido pelo backend) |
| Tracing | OpenTelemetry SDK + auto-instrumentation Node |
| Métricas | OpenTelemetry Metrics + Prometheus exporter |
| Logs | pino (estruturado, com trace_id) |
| Coleta | OpenTelemetry Collector (OTLP/HTTP) |
| Visualização | Jaeger (traces), Grafana (métricas) |

## Arquitetura

```
┌─────────────┐    HTTP/JSON    ┌──────────────────────────┐
│  Browser    │ ──────────────► │  Node.js (Express)       │
│  public/    │                 │  - Strategy pattern      │
└─────────────┘                 │  - 4 algoritmos isolados │
                                │  - SearchResult model    │
                                └────────────┬─────────────┘
                                             │ OTLP/HTTP (traces+metrics)
                                             ▼
                                ┌──────────────────────────┐
                                │ OpenTelemetry Collector  │
                                └──────┬───────────┬───────┘
                                       │           │
                                       ▼           ▼
                                ┌──────────┐  ┌──────────────┐
                                │  Jaeger  │  │  Prometheus  │
                                │  (traces)│  │  (metrics)   │
                                └────┬─────┘  └──────┬───────┘
                                     │               │
                                     └─────► Grafana ◄──── (dashboard)
```

## Como rodar

### Pré-requisitos
- **Node.js 20+** (`node --version`)
- **Docker Desktop** ([download Windows](https://www.docker.com/products/docker-desktop/)) — necessário para a stack de observabilidade

### 1) Instalar dependências
```powershell
npm install
```

### 2) Subir a stack de observabilidade (Docker)
```powershell
docker compose up -d
```

Isso sobe 4 containers:
- `otel-collector` (porta 4318 OTLP/HTTP)
- `jaeger` (UI em http://localhost:16686)
- `prometheus` (UI em http://localhost:9090)
- `grafana` (UI em http://localhost:3001, login anônimo / admin:admin)

### 3) Subir o backend Node
```powershell
npm start
```
Acesse a app em **http://localhost:3000**.

### 4) Popular o dashboard com dados reais
Em outro terminal:
```powershell
npm run fetch-corpus       # baixa ~10MB de livros do Project Gutenberg
npm run load-test          # dispara 100 buscas variadas no backend
```

Abra o Grafana → dashboard **"String Search - Comparador de Algoritmos"**.

## Como usar cada UI

### Grafana — http://localhost:3001
Visualiza as métricas do Prometheus em gráficos prontos.

1. Login: `admin` / `admin` (ou modo anônimo já como Viewer).
2. Menu lateral → **Dashboards** → **"String Search - Comparador de Algoritmos"**.
3. No canto sup. direito, ajuste o timerange (ex.: **Last 15 minutes**) e o auto-refresh (**5s**).
4. Painéis disponíveis:
   - **Total de buscas** e **Buscas por algoritmo** (stat)
   - **Taxa de execução (req/s)** (timeseries)
   - **Duração p95 (ms) por algoritmo** (timeseries)
   - **Duração média (ms) por algoritmo** (barchart)
   - **Comparações médias por algoritmo** (barchart)

> Se o dashboard ficar vazio, gere carga rodando `npm run load-test` em outro terminal.

### Jaeger — http://localhost:16686
Mostra o trace (rastro) de cada requisição individual.

1. Dropdown **Service** → escolha `string-search`.
2. (Opcional) Dropdown **Operation** → filtra por endpoint (ex.: `POST /api/search`, `compare.all`).
3. Clique **Find Traces**.
4. Clique em qualquer trace pra ver a **timeline de spans**:
   - `compare.all` → `search.naive` → `search.rk` → `search.kmp` → `search.bm`
   - Cada span mostra tempo de execução, `search.text_length`, `search.pattern_length`, `search.matches`, etc.

### Prometheus — http://localhost:9090
Acesso cru aos dados de métrica via PromQL. Use a aba **Graph** pra ver linha no tempo, **Table** pra ver número instantâneo.

Cole qualquer uma das queries abaixo no campo de consulta e clique **Execute**.

> As queries abaixo usam **somatórios acumulados** (sem `rate()`), então funcionam mesmo quando o `load-test` já terminou faz tempo. Pra ver "taxa em tempo real" troque `metric` por `rate(metric[5m])`, mas precisa ter buscas acontecendo na janela.

#### Básicas — volume de buscas
```promql
# Total de buscas por algoritmo
sum by (algorithm) (string_search_searches_total)

# Total geral
sum(string_search_searches_total)
```

#### Duração (tempo de execução em ms)
```promql
# Tempo médio por algoritmo (histórico desde o início)
sum by (algorithm) (string_search_duration_ms_sum)
/
sum by (algorithm) (string_search_duration_ms_count)

# p50 (mediana)
histogram_quantile(0.50, sum by (le, algorithm) (string_search_duration_ms_bucket))

# p95 (95% das buscas terminam abaixo desse valor)
histogram_quantile(0.95, sum by (le, algorithm) (string_search_duration_ms_bucket))

# p99 (pior caso prático)
histogram_quantile(0.99, sum by (le, algorithm) (string_search_duration_ms_bucket))
```

#### Comparações (quantos caracteres cada algoritmo "tocou")
Métrica mais didática — mostra que KMP/BM fazem menos comparações que Naive.
```promql
# Comparações médias por busca, por algoritmo
sum by (algorithm) (string_search_comparisons_sum)
/
sum by (algorithm) (string_search_comparisons_count)

# Razão Naive/BM — quantas vezes o Naive faz mais comparações que Boyer-Moore
(
  sum(string_search_comparisons_sum{algorithm="naive"})
  / sum(string_search_comparisons_count{algorithm="naive"})
)
/
(
  sum(string_search_comparisons_sum{algorithm="bm"})
  / sum(string_search_comparisons_count{algorithm="bm"})
)
```

#### Matches encontrados
```promql
# Matches médios por busca
sum by (algorithm) (string_search_matches_sum)
/
sum by (algorithm) (string_search_matches_count)
```

#### Tamanho médio das entradas
```promql
# Tamanho médio do texto (n)
sum by (algorithm) (string_search_text_size_sum)
/
sum by (algorithm) (string_search_text_size_count)

# Tamanho médio do padrão (m)
sum by (algorithm) (string_search_pattern_size_sum)
/
sum by (algorithm) (string_search_pattern_size_count)
```

#### Erros
```promql
sum by (algorithm) (string_search_errors_total)
```

#### Conceitos rápidos de PromQL
| Função | O que faz |
|---|---|
| `sum by (label)` | agrega somando, mantendo a label especificada |
| `histogram_quantile(0.95, ...)` | percentil a partir dos buckets de histograma |
| `_sum / _count` | média de um histograma (`_sum` = soma total, `_count` = nº de amostras) |
| `{algorithm="kmp"}` | filtra por label |
| `rate(metric[5m])` | (opcional) "por segundo, média dos últimos 5 min" — útil pro Grafana com auto-refresh, mas exige buscas acontecendo na janela |

## Estrutura

```
String-Search/
├── server/
│   ├── index.js                      # Express app
│   ├── tracing.js                    # OpenTelemetry SDK (carregado via --import)
│   ├── metrics.js                    # contadores e histogramas customizados
│   ├── logger.js                     # pino + correlação com trace_id
│   ├── routes/search.js              # POST /api/search, /steps, /compare
│   ├── algorithms/
│   │   ├── SearchStrategy.js         # classe base (Strategy pattern)
│   │   ├── NaiveSearch.js
│   │   ├── RabinKarpSearch.js
│   │   ├── KMPSearch.js
│   │   ├── BoyerMooreSearch.js
│   │   ├── SearchContext.js          # Context que mantém o mapa de estratégias
│   │   └── _util.js
│   └── models/SearchResult.js        # objeto de retorno padronizado e imutável
├── public/                           # frontend estático
├── observability/
│   ├── otel-collector-config.yaml
│   ├── prometheus.yml
│   └── grafana/
│       ├── provisioning/
│       └── dashboards/string-search.json
├── scripts/
│   ├── fetch-corpus.js
│   └── load-test.js
├── docs/
│   ├── ARQUITETURA.md
│   ├── OBSERVABILIDADE.md
│   └── relatorio-uso-ia.md
├── docker-compose.yml
└── package.json
```

## API

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | healthcheck |
| `GET` | `/api/algorithms` | lista algoritmos disponíveis com complexidades |
| `POST` | `/api/search` | executa busca com 1 algoritmo (`{text, pattern, algorithm}`) |
| `POST` | `/api/steps` | retorna passos didáticos para visualização |
| `POST` | `/api/compare` | executa os 4 algoritmos e retorna métricas comparadas |

## Métricas expostas (Prometheus)

| Métrica | Tipo | Labels | O que mede |
|---|---|---|---|
| `string_search_searches_total` | counter | `algorithm` | nº total de buscas |
| `string_search_duration_ms_*` | histogram | `algorithm` | tempo de execução |
| `string_search_comparisons_*` | histogram | `algorithm` | comparações por busca |
| `string_search_matches_*` | histogram | `algorithm` | matches encontrados |
| `string_search_text_size_*` | histogram | `algorithm` | tamanho do texto |
| `string_search_pattern_size_*` | histogram | `algorithm` | tamanho do padrão |
| `string_search_errors_total` | counter | `algorithm` | erros |

## Próximos passos
- Veja `docs/OBSERVABILIDADE.md` para detalhes da instrumentação
- Veja `docs/ARQUITETURA.md` para o desenho da etapa 2
- Veja `docs/relatorio-uso-ia.md` (template a preencher)
