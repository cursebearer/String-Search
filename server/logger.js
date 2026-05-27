import pino from 'pino';
import { trace, context } from '@opentelemetry/api';

const isDev = (process.env.NODE_ENV || 'development') !== 'production';

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
      }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  mixin() {
    const span = trace.getSpan(context.active());
    if (!span) return {};
    const sc = span.spanContext();
    return { trace_id: sc.traceId, span_id: sc.spanId };
  },
});

export const logger = baseLogger;
