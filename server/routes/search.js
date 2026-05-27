import express from 'express';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { searchContext } from '../algorithms/SearchContext.js';
import { recordSearch, errorsTotal } from '../metrics.js';
import { logger } from '../logger.js';

const router = express.Router();
const tracer = trace.getTracer('string-search.routes', '2.0.0');

function validateBody(req, res) {
  const { text, pattern, algorithm } = req.body || {};
  if (typeof text !== 'string' || !text.length) {
    res.status(400).json({ error: 'campo "text" obrigatorio (string nao vazia)' });
    return null;
  }
  if (typeof pattern !== 'string' || !pattern.length) {
    res.status(400).json({ error: 'campo "pattern" obrigatorio (string nao vazia)' });
    return null;
  }
  if (pattern.length > text.length) {
    res.status(400).json({ error: 'pattern nao pode ser maior que text' });
    return null;
  }
  if (algorithm !== undefined && !searchContext.hasStrategy(algorithm)) {
    res.status(400).json({ error: `algoritmo desconhecido: ${algorithm}` });
    return null;
  }
  return { text, pattern, algorithm };
}

/**
 * Cria um span filho para a execucao isolada de um algoritmo.
 * Captura atributos relevantes (texto/padrao length, match count) e marca erros.
 */
function runWithSpan(algorithm, text, pattern) {
  return tracer.startActiveSpan(`search.${algorithm}`, (span) => {
    try {
      span.setAttribute('search.algorithm', algorithm);
      span.setAttribute('search.text_length', text.length);
      span.setAttribute('search.pattern_length', pattern.length);

      const result = searchContext.run(algorithm, text, pattern);

      span.setAttribute('search.matches', result.matchCount);
      span.setAttribute('search.comparisons', result.comparisons);
      span.setAttribute('search.duration_ms', result.durationMs);
      span.setStatus({ code: SpanStatusCode.OK });

      recordSearch(result);
      logger.info(
        {
          algorithm,
          textLength: text.length,
          patternLength: pattern.length,
          matches: result.matchCount,
          comparisons: result.comparisons,
          durationMs: result.durationMs,
        },
        'search executed',
      );

      return result;
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      errorsTotal.add(1, { algorithm });
      throw err;
    } finally {
      span.end();
    }
  });
}

router.get('/algorithms', (_req, res) => {
  res.json(searchContext.listStrategies());
});

router.post('/search', (req, res) => {
  const input = validateBody(req, res);
  if (!input) return;
  const algorithm = input.algorithm || 'naive';
  try {
    const result = runWithSpan(algorithm, input.text, input.pattern);
    res.json(result.toJSON());
  } catch (err) {
    logger.error({ err: err.message, algorithm }, 'search failed');
    res.status(500).json({ error: err.message });
  }
});

router.post('/steps', (req, res) => {
  const input = validateBody(req, res);
  if (!input) return;
  const algorithm = input.algorithm || 'naive';
  tracer.startActiveSpan(`steps.${algorithm}`, (span) => {
    try {
      span.setAttribute('search.algorithm', algorithm);
      span.setAttribute('search.text_length', input.text.length);
      span.setAttribute('search.pattern_length', input.pattern.length);
      const steps = searchContext.steps(algorithm, input.text, input.pattern);
      span.setAttribute('search.step_count', steps.length);
      span.setStatus({ code: SpanStatusCode.OK });
      res.json({ algorithm, count: steps.length, steps });
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      errorsTotal.add(1, { algorithm });
      logger.error({ err: err.message, algorithm }, 'steps failed');
      res.status(500).json({ error: err.message });
    } finally {
      span.end();
    }
  });
});

router.post('/compare', (req, res) => {
  const input = validateBody(req, res);
  if (!input) return;
  tracer.startActiveSpan('compare.all', (parent) => {
    try {
      parent.setAttribute('search.text_length', input.text.length);
      parent.setAttribute('search.pattern_length', input.pattern.length);
      const results = searchContext
        .listStrategies()
        .map(({ key }) => runWithSpan(key, input.text, input.pattern).toJSON());
      parent.setStatus({ code: SpanStatusCode.OK });
      res.json({
        textLength: input.text.length,
        patternLength: input.pattern.length,
        results,
      });
    } catch (err) {
      parent.recordException(err);
      parent.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      logger.error({ err: err.message }, 'compare failed');
      res.status(500).json({ error: err.message });
    } finally {
      parent.end();
    }
  });
});

export default router;
