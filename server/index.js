import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import searchRoutes from './routes/search.js';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.use('/api', searchRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.use(express.static(PUBLIC_DIR));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, _req, res, _next) => {
  logger.error({ err: err.message, stack: err.stack }, 'unhandled error');
  res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, () => {
  logger.info({ port: PORT, publicDir: PUBLIC_DIR }, 'string-search server iniciado');
});
