# Relatório de Uso de IA — Etapa 2

> **Equipe:** Rafael Pavesi dos Passos e Lucas Warmling
> **Disciplina:** Algoritmos Avancados 
> **Data:** 27/05/2026

---

## Ferramentas utilizadas

- **Claude (Anthropic)** — modelo Opus 4.7 via Claude Code CLI

## O que foi feito com auxílio de IA

### 1) Análise da etapa 1
Pedimos à IA uma análise do código da etapa 1 já entregue. A IA identificou:
- Bug latente em `SearchContext.runAll` (chamava `search()` duas vezes)
- Primo pequeno no Rabin-Karp (`q=101`) gerando muitas colisões
- Risco de XSS em alguns `innerHTML`
- Sugestões de métricas adicionais (ex.: falsos positivos do RK)

### 2) Decisões de arquitetura para etapa 2
A IA propôs três opções de arquitetura (backend Node, frontend puro com OTel browser, CLI separado) e nós escolhemos backend Node por ser o padrão da indústria para OpenTelemetry e o que mais se aproxima do que a rubrica pedia.

### 3) Geração de código
Com a arquitetura decidida, a IA gerou:
- Esqueleto do Strategy pattern (`SearchStrategy` + 4 algoritmos em arquivos separados)
- Classe `SearchResult` imutável
- Setup do OpenTelemetry SDK (tracing + metrics + auto-instrumentation)
- Backend Express com rotas REST e validação
- `docker-compose.yml` com Collector + Jaeger + Prometheus + Grafana
- Dashboard Grafana JSON pré-provisionado
- Scripts de carga (`fetch-corpus.js` e `load-test.js`)
- Documentação (este arquivo, README, ARQUITETURA.md, OBSERVABILIDADE.md)

### 4) O que **não** foi feito pela IA
- Decisões de escopo e prioridades (o que entregar)
- Escolha de quais algoritmos comparar (definido na etapa 1)
- Validação manual no Jaeger/Grafana após subir a stack
- Análise comparativa teórico vs prático no relatório final

## Como validamos as saídas da IA

- **Testes manuais**: executamos cada endpoint via `curl` e via UI
- **Inspeção de traces**: abrimos o Jaeger e verificamos a estrutura dos spans
- **Inspeção de métricas**: conferimos no Prometheus que as métricas tinham os labels corretos
- **Lint mental**: lemos o código gerado e ajustamos onde havia divergência (ex.: nomes de métrica para a convenção Prometheus)

## Aprendizados

- A IA acelera muito código boilerplate (configs, docker-compose, dashboards JSON), mas a correção arquitetural depende de a equipe explicar o **porquê** das escolhas
- Sempre validar nomes de métricas e formatos de export — pequenas divergências entre OTel SDK e Prometheus exporter quebram dashboards
- O fluxo "IA propõe opções → equipe decide → IA implementa" foi mais produtivo do que pedir tudo de uma vez

## Limitações observadas

- A IA não testa o código em runtime (não roda `docker compose up` por nós)
- Pode propor versões de pacotes que já mudaram (verificamos no `npm view <pkg>` quando havia dúvida)
- Não sabe automaticamente as preferências do nosso curso/professor — direcionamos com a rubrica
