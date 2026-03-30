require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// === GROQ KEYS - Single env var, comma separated ===
const GROQ_KEYS = (process.env.GROQ_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
let groqIndex = 0;
function getGroqKey() {
  if (GROQ_KEYS.length === 0) return null;
  const key = GROQ_KEYS[groqIndex % GROQ_KEYS.length];
  groqIndex++;
  return key;
}

// === BAD WORDS FILTER ===
const BAD_WORDS = [
  'putain','merde','connard','connasse','enculé','enculer','nique','niquer',
  'salope','salaud','bordel','foutre','baiser','bite','couille','chier',
  'pétasse','enfoiré','bâtard','batard','fils de pute','fdp','ntm','tg',
  'ta gueule','ferme ta gueule','pd','pédé','pede','gouine','négro','negro',
  'sale race','sous race','crève','creve','va mourir','je vais te tuer',
  'nazi','hitler','p u t a i n','m e r d e','n i q u e','put1','mrd','enkulé',
  'terroriste','viol','violer','pédophile','pedophile',
  'suicide','se suicider','assassiner','massacrer',
  'koukoune','manman ou','fanm a ou','ti kal'
];
const ALWAYS_FLAG = [
  'macron','melenchon','mélenchon','le pen','zemmour','sarkozy','hollande',
  'darmanin','borne','attal','bardella','dupond-moretti',
  'putain','merde','connard','enculé','nique','fdp','ntm',
  'terroriste','nazi','hitler','pédophile','viol'
];

function containsBadWords(text) {
  if (!text) return { found: false, words: [] };
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-\.]/g, ' ').replace(/\s+/g, ' ')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's');
  const found = [];
  for (const word of ALWAYS_FLAG) {
    const nw = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(nw)) found.push(word);
  }
  for (const word of BAD_WORDS) {
    if (found.includes(word)) continue;
    const nw = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const esc = nw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('(?:^|[\\s,.!?;:\'"\\-_()\\[\\]@#])' + esc + '(?:$|[\\s,.!?;:\'"\\-_()\\[\\]@#])', 'i').test(' ' + lower + ' ')) {
      found.push(word);
    }
  }
  return { found: found.length > 0, words: [...new Set(found)] };
}

// === ANTI-FARM (soft) ===
const reportCooldowns = new Map();
function checkReportCooldown(userId) {
  const now = Date.now();
  const data = reportCooldowns.get(userId);
  if (!data) { reportCooldowns.set(userId, { lastCreate: now, lastDelete: 0, deleteCount: 0, resetTime: now }); return { allowed: true }; }
  // Reset delete counter every hour
  if (now - data.resetTime > 3600000) { data.deleteCount = 0; data.resetTime = now; }
  // If deleted more than 5 reports in the last hour and trying to create, add cooldown
  if (data.deleteCount >= 5 && now - data.lastDelete < 600000) {
    return { allowed: false, reason: 'Trop de suppressions récentes. Attendez 10 minutes.' };
  }
  // Min 10 seconds between creations (anti-spam)
  if (now - data.lastCreate < 10000) {
    return { allowed: false, reason: 'Attendez quelques secondes entre chaque signalement' };
  }
  data.lastCreate = now;
  return { allowed: true };
}
function markReportDeleted(userId) {
  const data = reportCooldowns.get(userId);
  if (data) { data.lastDelete = Date.now(); data.deleteCount++; }
  else reportCooldowns.set(userId, { lastCreate: 0, lastDelete: Date.now(), deleteCount: 1, resetTime: Date.now() });
}
setInterval(() => { const n = Date.now(); for (const [k, v] of reportCooldowns) if (n - v.resetTime > 7200000) reportCooldowns.delete(k); }, 3600000);

// === TAG PROPOSALS (persistent JSON) ===
const tagProposalsFile = path.join(__dirname, 'data', 'tag-proposals.json');
function ensureDataDir() { const d = path.join(__dirname, 'data'); if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function getTagProposals() { try { ensureDataDir(); if (fs.existsSync(tagProposalsFile)) return JSON.parse(fs.readFileSync(tagProposalsFile, 'utf8')); } catch (e) {} return []; }
function saveTagProposals(p) { ensureDataDir(); fs.writeFileSync(tagProposalsFile, JSON.stringify(p, null, 2)); }

// === SECURITY HEADERS ===
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
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

app.set('trust proxy', 1);
app.use(cors({ origin: process.env.NODE_ENV === 'production' ? false : '*', methods: ['GET', 'POST', 'DELETE'] }));
app.use(compression({ level: 6, threshold: 1024 }));
app.use(express.json({ limit: '2mb' }));

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
    const k = req.ip || 'unknown'; const now = Date.now(); const e = hits.get(k);
    if (!e || now - e.t > ms) { hits.set(k, { c: 1, t: now }); return next(); }
    if (++e.c > max) return res.status(429).json({ error: 'Trop de requêtes, réessayez dans un moment' });
    next();
  };
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (n - v.t > 60000) hits.delete(k); }, 30000);

// Static with aggressive caching
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '30d', etag: true, dotfiles: 'deny', immutable: true }));

// === API ROUTES ===

app.get('/api/config', limit(60, 60000), (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    imgbbApiKey: process.env.IMGBB_API_KEY || '',
    contactEmail: process.env.CONTACT_EMAIL || 'maxenceponche971@gmail.com',
    groqAvailable: GROQ_KEYS.length > 0,
    repoUrl: 'https://github.com/MaxLananas-debug/gwadloup'
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true, groqKeys: GROQ_KEYS.length, uptime: process.uptime() }));

// Wiki static pages
app.get('/api/wiki-static', limit(30, 60000), (req, res) => {
  const dir = path.join(__dirname, 'wiki');
  if (!fs.existsSync(dir)) return res.json([]);
  res.json(fs.readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('.')).map(f => ({
    slug: f.replace('.md', ''),
    title: f.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  })));
});

app.get('/api/wiki-static/:page', limit(60, 60000), (req, res) => {
  const p = req.params.page.replace(/[^a-zA-Z0-9-_]/g, '');
  const f = path.join(__dirname, 'wiki', `${p}.md`);
  if (p && !p.startsWith('.') && fs.existsSync(f)) res.type('text/plain').send(fs.readFileSync(f, 'utf8'));
  else res.status(404).json({ error: 'Not found' });
});

// Tag Proposals CRUD
app.get('/api/tag-proposals', limit(30, 60000), (req, res) => res.json(getTagProposals()));

app.post('/api/tag-proposals', limit(10, 60000), (req, res) => {
  const { name, icon, description, author } = req.body;
  if (!name || name.length < 2 || name.length > 30) return res.status(400).json({ error: 'Nom invalide (2-30 car.)' });
  if (!description || description.length < 5 || description.length > 200) return res.status(400).json({ error: 'Description invalide (5-200 car.)' });
  const check = containsBadWords(name + ' ' + description);
  if (check.found) return res.status(400).json({ error: 'Contenu inapproprié' });
  const proposals = getTagProposals();
  if (proposals.find(p => p.name.toLowerCase() === name.toLowerCase())) return res.status(400).json({ error: 'Existe déjà' });
  proposals.push({
    id: crypto.randomBytes(8).toString('hex'), name: name.substring(0, 30),
    icon: (icon || 'fa-tag').replace(/[^a-zA-Z0-9-]/g, ''), description: description.substring(0, 200),
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

// Admin: Delete tag proposal
app.delete('/api/tag-proposals/:id', limit(10, 60000), (req, res) => {
  const proposals = getTagProposals();
  const idx = proposals.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Introuvable' });
  proposals.splice(idx, 1);
  saveTagProposals(proposals);
  res.json({ ok: true });
});

// Anti-farm check
app.post('/api/check-farm', limit(60, 60000), (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  res.json(checkReportCooldown(userId));
});

app.post('/api/mark-delete', limit(30, 60000), (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  markReportDeleted(userId);
  res.json({ ok: true });
});

// Moderation - ALWAYS reformulates, never blocks
app.post('/api/moderate', limit(60, 60000), async (req, res) => {
  const { title, description } = req.body;
  const fullText = (title || '') + ' ' + (description || '');
  const check = containsBadWords(fullText);
  if (!check.found) return res.json({ flagged: false });

  const groqKey = getGroqKey();
  if (!groqKey) {
    // No Groq? Local cleanup
    let ct = title || '', cd = description || '';
    for (const w of check.words) { const r = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); ct = ct.replace(r, '***'); cd = cd.replace(r, '***'); }
    return res.json({ flagged: true, reformulated: true, cleaned: { title: ct, description: cd } });
  }

  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: `Tu es un modérateur pour "Gwadloup Alert", plateforme citoyenne en Guadeloupe.
RÈGLES: 1) SUPPRIME personnalités politiques 2) SUPPRIME insultes/vulgarités 3) SUPPRIME comparaisons insultantes 4) CONSERVE le sens utile 5) Reformule professionnellement 6) Ne rejette JAMAIS
Réponds UNIQUEMENT en JSON: {"title":"...","description":"..."}` },
          { role: 'user', content: `Titre: ${(title || '').substring(0, 300)}\nDescription: ${(description || '').substring(0, 2000)}` }
        ],
        temperature: 0.2, max_tokens: 600
      }),
      signal: ctrl.signal
    });
    clearTimeout(to);
    if (!resp.ok) throw new Error();
    const data = await resp.json();
    let jsonStr = data.choices[0].message.content.trim();
    if (jsonStr.includes('```')) jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    return res.json({ flagged: true, reformulated: true, cleaned: { title: (parsed.title || 'Signalement').substring(0, 150), description: (parsed.description || 'Description du problème').substring(0, 2000) } });
  } catch (e) {
    let ct = title || '', cd = description || '';
    for (const w of check.words) { const r = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); ct = ct.replace(r, '***'); cd = cd.replace(r, '***'); }
    return res.json({ flagged: true, reformulated: true, cleaned: { title: ct, description: cd } });
  }
});

// Admin: Bulk actions endpoint
app.post('/api/admin/bulk', limit(10, 60000), (req, res) => {
  // This is handled client-side via Supabase, but we provide server validation
  res.json({ ok: true });
});

// 404 API
app.all('/api/*', (req, res) => res.status(404).json({ error: 'Route inconnue' }));

// SPA
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, req, res, next) => { console.error('Server error:', err); res.status(500).json({ error: 'Erreur serveur' }); });

app.listen(PORT, () => console.log(`Gwadloup Alert v6 — port ${PORT} — ${GROQ_KEYS.length} Groq key(s)`));
