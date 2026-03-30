require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Groq keys rotation
const GROQ_KEYS = [
  process.env.GROQ_KEY_1, process.env.GROQ_KEY_2, process.env.GROQ_KEY_3,
  process.env.GROQ_KEY_4, process.env.GROQ_KEY_5, process.env.GROQ_KEY_6,
  process.env.GROQ_KEY_7
].filter(Boolean);
let groqIndex = 0;
function getGroqKey() {
  if (GROQ_KEYS.length === 0) return null;
  const key = GROQ_KEYS[groqIndex % GROQ_KEYS.length];
  groqIndex++;
  return key;
}

// Bad words filter
const BAD_WORDS = [
  'putain','merde','connard','connasse','enculé','enculer','nique','niquer',
  'salope','salaud','bordel','foutre','baiser','bite','couille','chier',
  'pétasse','enfoiré','bâtard','batard','fils de pute','fdp','ntm','tg',
  'ta gueule','ferme ta gueule','pd','pédé','pede','gouine','négro','negro',
  'sale race','sous race','crève','creве','va mourir','je vais te tuer',
  'terroriste','bombe','explosif','nazi','hitler'
];

function containsBadWords(text) {
  if (!text) return { found: false, words: [] };
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const found = [];
  for (const word of BAD_WORDS) {
    const normWord = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(normWord)) found.push(word);
  }
  return { found: found.length > 0, words: found };
}

// Wiki edit history
const wikiHistoryFile = path.join(__dirname, 'wiki', '.history.json');
function getWikiHistory() {
  try {
    if (fs.existsSync(wikiHistoryFile)) return JSON.parse(fs.readFileSync(wikiHistoryFile, 'utf8'));
  } catch (e) {}
  return [];
}
function addWikiHistory(entry) {
  const history = getWikiHistory();
  history.unshift({ ...entry, timestamp: new Date().toISOString() });
  if (history.length > 200) history.length = 200;
  fs.writeFileSync(wikiHistoryFile, JSON.stringify(history, null, 2));
}

// Tag proposals file
const tagProposalsFile = path.join(__dirname, 'data', 'tag-proposals.json');
function ensureDataDir() {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function getTagProposals() {
  try {
    ensureDataDir();
    if (fs.existsSync(tagProposalsFile)) return JSON.parse(fs.readFileSync(tagProposalsFile, 'utf8'));
  } catch (e) {}
  return [];
}
function saveTagProposals(proposals) {
  ensureDataDir();
  fs.writeFileSync(tagProposalsFile, JSON.stringify(proposals, null, 2));
}

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));

// Rate limiter
const hits = new Map();
function limit(max, ms) {
  return (req, res, next) => {
    const k = req.ip;
    const now = Date.now();
    const e = hits.get(k);
    if (!e || now - e.t > ms) { hits.set(k, { c: 1, t: now }); return next(); }
    if (++e.c > max) return res.status(429).json({ error: 'Rate limit' });
    next();
  };
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (n - v.t > 60000) hits.delete(k); }, 30000);

// Static
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d', etag: true }));

// API Config
app.get('/api/config', limit(60, 60000), (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    imgbbApiKey: process.env.IMGBB_API_KEY || '',
    contactEmail: process.env.CONTACT_EMAIL || 'maxenceponche971@gmail.com'
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Wiki - List pages
app.get('/api/wiki', limit(30, 60000), (req, res) => {
  const dir = path.join(__dirname, 'wiki');
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); return res.json([]); }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  res.json(files.map(f => ({
    slug: f.replace('.md', ''),
    title: f.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  })));
});

// Wiki - Read page
app.get('/api/wiki/:page', limit(60, 60000), (req, res) => {
  const p = req.params.page.replace(/[^a-zA-Z0-9-_]/g, '');
  const f = path.join(__dirname, 'wiki', `${p}.md`);
  if (fs.existsSync(f)) res.type('text/plain').send(fs.readFileSync(f, 'utf8'));
  else res.status(404).json({ error: 'Not found' });
});

// Wiki - Create/Edit page
app.post('/api/wiki/:page', limit(20, 60000), (req, res) => {
  const p = req.params.page.replace(/[^a-zA-Z0-9-_]/g, '');
  if (!p || p.length < 2) return res.status(400).json({ error: 'Slug invalide' });
  if (p.startsWith('.')) return res.status(400).json({ error: 'Slug invalide' });

  const { content, author } = req.body;
  if (!content || 
