require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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
  'sale race','sous race','crève','creve','va mourir','je vais te tuer',
  'terroriste','nazi','hitler'
];

function containsBadWords(text) {
  if (!text) return { found: false, words: [] };
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const found = [];
  for (const word of BAD_WORDS) {
    const normWord = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const regex = new RegExp('(?:^|[\\s,.!?;:\'\"\\-_()\\[\\]])' + normWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|[\\s,.!?;:\'\"\\-_()\\[\\]])', 'i');
    if (regex.test(' ' + lower + ' ')) {
      found.push(word);
    }
  }
  return { found: found.length > 0, words: found };
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
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://i.ibb.co https://*.tile.openstreetmap.org; " +
    "connect-src 'self' https://*.supabase.co https://api.imgbb.com https://nominatim.openstreetmap.org https://api.groq.com; " +
    "frame-src 'none'; object-src 'none'; base-uri 'self'"
  );
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
  next();
});

app.set('trust proxy', 1);
app.use(cors({ origin: process.env.NODE_ENV === 'production' ? false : '*', methods: ['GET', 'POST', 'DELETE'] }));
app.use(compression());
app.use(express.json({ limit: '500kb' }));

// Input sanitization
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].replace(/\0/g, '');
        if (req.body[key].length > 50000) req.body[key] = req.body[key].substring(0, 50000);
      }
    }
  }
  next();
});

// Rate limiter
const hits = new Map();
function limit(max, ms) {
  return (req, res, next) => {
    const k = req.ip || 'unknown';
    const now = Date.now();
    const e = hits.get(k);
    if (!e || now - e.t > ms) { hits.set(k, { c: 1, t: now }); return next(); }
    if (++e.c > max) return res.status(429).json({ error: 'Trop de requêtes' });
    next();
  };
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (n - v.t > 60000) hits.delete(k); }, 30000);

// Static
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d', etag: true, dotfiles: 'deny' }));

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

// Built-in wiki pages (static markdown from repo)
app.get('/api/wiki-static', limit(30, 60000), (req, res) => {
  const dir = path.join(__dirname, 'wiki');
  if (!fs.existsSync(dir)) return res.json([]);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('.'));
  res.json(files.map(f => ({
    slug: f.replace('.md', ''),
    title: f.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  })));
});

app.get('/api/wiki-static/:page', limit(60, 60000), (req, res) => {
  const p = req.params.page.replace(/[^a-zA-Z0-9-_]/g, '');
  if (!p || p.startsWith('.')) return res.status(400).json({ error: 'Invalid' });
  const f = path.join(__dirname, 'wiki', `${p}.md`);
  if (fs.existsSync(f)) res.type('text/plain').send(fs.readFileSync(f, 'utf8'));
  else res.status(404).json({ error: 'Not found' });
});

// Tag Proposals
app.get('/api/tag-proposals', limit(30, 60000), (req, res) => res.json(getTagProposals()));

app.post('/api/tag-proposals', limit(10, 60000), (req, res) => {
  const { name, icon, description, author } = req.body;
  if (!name || name.length < 2 || name.length > 30) return res.status(400).json({ error: 'Nom invalide' });
  if (!description || description.length < 5 || description.length > 200) return res.status(400).json({ error: 'Description invalide' });
  const check = containsBadWords(name + ' ' + description);
  if (check.found) return res.status(400).json({ error: 'Contenu inapproprié' });
  const proposals = getTagProposals();
  if (proposals.find(p => p.name.toLowerCase() === name.toLowerCase())) return res.status(400).json({ error: 'Existe déjà' });
  proposals.push({
    id: crypto.randomBytes(8).toString('hex'),
    name: name.substring(0, 30),
    icon: (icon || 'fa-tag').replace(/[^a-zA-Z0-9-]/g, ''),
    description: description.substring(0, 200),
    author: (author || 'Anonyme').replace(/[<>]/g, '').substring(0, 30),
    votes: 0, voters: [], created_at: new Date().toISOString()
  });
  saveTagProposals(proposals);
  res.json({ ok: true });
});

app.post('/api/tag-proposals/:id/vote', limit(30, 60000), (req, res) => {
  const { voter } = req.body;
  if (!voter) return res.status(400).json({ error: 'ID requis' });
  const proposals = getTagProposals();
  const p = proposals.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Introuvable' });
  if (!p.voters) p.voters = [];
  const idx = p.voters.indexOf(voter);
  if (idx >= 0) { p.voters.splice(idx, 1); p.votes = Math.max(0, (p.votes || 1) - 1); }
  else { p.voters.push(voter); p.votes = (p.votes || 0) + 1; }
  saveTagProposals(proposals);
  res.json({ ok: true, votes: p.votes });
});

// Moderation API
app.post('/api/moderate', limit(30, 60000), async (req, res) => {
  const { title, description } = req.body;
  const fullText = (title || '') + ' ' + (description || '');
  const check = containsBadWords(fullText);
  if (!check.found) return res.json({ flagged: false });

  const groqKey = getGroqKey();
  if (!groqKey) return res.json({ flagged: true, reformulated: false, reason: 'Mots inappropriés' });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Tu es un modérateur pour une plateforme citoyenne en Guadeloupe. Reformule le texte pour supprimer insultes/propos offensants en gardant le sens. Réponds UNIQUEMENT en JSON: {"title":"...","description":"..."}. Si purement haineux: {"rejected":true}' },
          { role: 'user', content: `Titre: ${(title || '').substring(0, 200)}\nDescription: ${(description || '').substring(0, 2000)}` }
        ],
        temperature: 0.3, max_tokens: 500
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error();
    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content.trim());
    if (parsed.rejected) return res.json({ flagged: true, reformulated: false, reason: 'Rejeté' });
    return res.json({ flagged: true, reformulated: true, cleaned: { title: parsed.title || title, description: parsed.description || description } });
  } catch (e) {
    return res.json({ flagged: true, reformulated: false, reason: 'Erreur modération' });
  }
});

// 404 API
app.all('/api/*', (req, res) => res.status(404).json({ error: 'Route inconnue' }));

// SPA
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Erreur serveur' });
});

app.listen(PORT, () => console.log(`Gwadloup Alert v5 on port ${PORT}`));
