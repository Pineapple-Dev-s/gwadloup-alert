require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(compression());
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  etag: true
}));

// API config
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    imgbbApiKey: process.env.IMGBB_API_KEY || ''
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// Wiki API — sert les fichiers markdown
app.get('/api/wiki/:page', (req, res) => {
  const page = req.params.page.replace(/[^a-zA-Z0-9-_]/g, '');
  const filePath = path.join(__dirname, 'wiki', `${page}.md`);
  if (fs.existsSync(filePath)) {
    res.type('text/plain').send(fs.readFileSync(filePath, 'utf8'));
  } else {
    res.status(404).json({ error: 'Page not found' });
  }
});

app.get('/api/wiki', (req, res) => {
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
