require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Sécurité
app.use((req, res, next) => {
  // Empêcher le clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Empêcher le sniffing MIME
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  // HSTS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));

// Rate limiting simple
const rateLimits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const key = ip;
    if (!rateLimits.has(key)) {
      rateLimits.set(key, { count: 1, start: now });
      return next();
    }
    const entry = rateLimits.get(key);
    if (now - entry.start > windowMs) {
      rateLimits.set(key, { count: 1, start: now });
      return next();
    }
    entry.count++;
    if (entry.count > max) {
      return res.status(429).json({ error: 'Trop de requêtes. Réessayez plus tard.' });
    }
    next();
  };
}

// Nettoyer le rate limit map régulièrement
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimits) {
    if (now - val.start > 60000) rateLimits.delete(key);
  }
}, 60000);

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d', etag: true
}));

// API config — rate limited
app.get('/api/config', rateLimit(30, 60000), (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    imgbbApiKey: process.env.IMGBB_API_KEY || ''
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// Wiki API
app.get('/api/wiki/:page', rateLimit(60, 60000), (req, res) => {
  const page = req.params.page.replace(/[^a-zA-Z0-9-_]/g, '');
  const filePath = path.join(__dirname, 'wiki', `${page}.md`);
  if (fs.existsSync(filePath)) {
    res.type('text/plain').send(fs.readFileSync(filePath, 'utf8'));
  } else {
    res.status(404).json({ error: 'Page not found' });
  }
});

app.get('/api/wiki', rateLimit(30, 60000), (req, res) => {
  const wikiDir = path.join(__dirname, 'wiki');
  if (!fs.existsSync(wikiDir)) { res.json([]); return; }
  const files = fs.readdirSync(wikiDir)
    .filter(f => f.endsWith('.md'))
    .map(f => ({
      slug: f.replace('.md', ''),
      title: f.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }));
  res.json(files);
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Gwadloup Alert v3 — Port ${PORT}`);
});
