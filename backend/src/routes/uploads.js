import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireAdmin } from '../middleware.js';

const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/www/eznihongo/uploads';
const PUBLIC_BASE = process.env.UPLOAD_PUBLIC_BASE || '/uploads';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname || '') || '.bin';
    const name = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WEBP, GIF images are allowed'));
    }
    cb(null, true);
  },
});

router.post('/', requireAuth, requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const publicUrl = `${PUBLIC_BASE}/${req.file.filename}`;
  res.status(201).json({ url: publicUrl, size: req.file.size, mime: req.file.mimetype });
});

router.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
});

export default router;
