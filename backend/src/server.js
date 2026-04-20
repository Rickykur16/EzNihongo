import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import { db } from './db.js';
import authRouter from './routes/auth.js';
import contentRouter from './routes/content.js';
import progressRouter from './routes/progress.js';
import discussionsRouter from './routes/discussions.js';
import adminRouter from './routes/admin.js';

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

app.set('trust proxy', 1);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, db: 'connected', time: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, db: 'error', error: err.message });
  }
});

app.use('/api/auth', authRouter);
app.use('/api', contentRouter);
app.use('/api', progressRouter);
app.use('/api/discussions', discussionsRouter);
app.use('/api/admin', adminRouter);

// 404
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('API error:', err);
  if (err?.code === '23505') {
    return res.status(409).json({ error: 'Conflict (unique constraint)' });
  }
  if (err?.code === '23503') {
    return res.status(400).json({ error: 'Referenced resource not found' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, '127.0.0.1', () => {
  console.log(`EzNihongo API listening on 127.0.0.1:${port}`);
});
