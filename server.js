require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Groq keys
const GROQ_KEYS = (process.env.GROQ_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
let groqIdx = 0;
function getGroqKey() {
  if (!GROQ_KEYS.length) return null;
  return GROQ_KEYS[groqIdx++ % GROQ_KEYS.length];
}

// Bad words
const BAD_WORDS = [
  'putain','merde','connard','connasse','enculé','enculer','nique','niquer',
  'salope','salaud','bordel','foutre','bite','couille','chier',
  'pétasse','enfoiré','bâtard','batard','fils de pute','fdp','ntm','tg',
  'ta gueule','pd','pédé','gouine','négro','negro',
  'sale race','sous race','va mourir','je vais te tuer',
  'nazi','hitler','terroriste','pédophile','pedophile',
  'koukoune','manman ou','ti kal'
];
const ALWAYS_FLAG = [
  'macron','melenchon','mélenchon','le pen','zemmour','sarkozy','hollande',
  'darmanin','borne','attal','bardella',
  'putain','merde','connard','enculé','nique','fdp','ntm',
  'nazi','hitler','pédophile'
];

function containsBadWords(text) {
  if (!text) return { found: false, words: [] };
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-\.]/g, ' ').replace(/\s+/g, ' ')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's');
  const found = [];
  for (const w of ALWAYS_FLAG) { if (lower.includes(w.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) found.push(w); }
  for (const w of BAD_WORDS) {
    if (found.includes(w)) continue;
    const nw = w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (new RegExp('(?:^|\\W)' + nw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|\\W)', 'i').test(' ' + lower + ' ')) found.push(w);
  }
  return { found: found.length > 0, words: [...new Set(found)] };
}

// Anti spam
const cooldowns = new Map();
function checkCooldown(userId) {
  const now = Date.now(), d = cooldowns.get(userId);
  if (!d) { cooldowns.set(userId, { last: now, delCount: 0, delReset: now }); return { allowed: true }; }
  if (now - d.delReset > 3600000) { d.delCount = 0; d.delReset = now; }
  if (d.delCount >= 5 && now - d.last < 600000) return { allowed: false, reason: 'Trop de suppressions. Attendez 10 min.' };
  if (now - d.last < 8000) return { allowed: false, reason: 'Attendez quelques secondes' };
  d.last = now;
  return { allowed: true };
}
function markDelete(userId) {
  const d = cooldowns.get(userId);
  if (d) d.delCount++; else cooldowns.set(userId, { last: Date.now(), delCount: 1, delReset: Date.now() });
}

// Security
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://i.ibb.co https://*.tile.openstreetmap.org; " +
    "connect-src 'self' https://*.supabase.co https://api.imgbb.com https://nominatim.openstreetmap.org https://api.groq.com; " +
    "frame-src 'none'; object-src 'none'; base-uri 'self'");
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

app.set('trust proxy', 1);
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  if (req.body) for (const k in req.body) if (typeof req.body[k] === 'string') { req.body[k] = req.body[k].replace(/\0/g, ''); if (req.body[k].length > 50000) req.body[k] = req.body[k].substring(0, 50000); }
  next();
});

const hits = new Map();
function limit(max, ms) {
  return (req, res, next) => {
    const k = req.ip || 'x', now = Date.now(), e = hits.get(k);
    if (!e || now - e.t > ms) { hits.set(k, { c: 1, t: now }); return next(); }
    if (++e.c > max) return res.status(429).json({ error: 'Trop de requêtes' });
    next();
  };
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (n - v.t > 60000) hits.delete(k); }, 30000);

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '30d', etag: true, dotfiles: 'deny' }));

// Config
app.get('/api/config', limit(60, 60000), (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    imgbbApiKey: process.env.IMGBB_API_KEY || '',
    contactEmail: process.env.CONTACT_EMAIL || 'maxenceponche971@gmail.com',
    repoUrl: 'https://github.com/MaxLananas-debug/gwadloup'
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true, groq: GROQ_KEYS.length }));

// Wiki static
app.get('/api/wiki-static', limit(30, 60000), (req, res) => {
  const dir = path.join(__dirname, 'wiki');
  if (!fs.existsSync(dir)) return res.json([]);
  res.json(fs.readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('.')).map(f => ({
    slug: f.replace('.md', ''), title: f.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  })));
});
app.get('/api/wiki-static/:page', limit(60, 60000), (req, res) => {
  const p = req.params.page.replace(/[^a-zA-Z0-9-_]/g, '');
  const f = path.join(__dirname, 'wiki', `${p}.md`);
  if (p && !p.startsWith('.') && fs.existsSync(f)) res.type('text/plain').send(fs.readFileSync(f, 'utf8'));
  else res.status(404).json({ error: 'Not found' });
});

// Anti-farm
app.post('/api/check-farm', limit(60, 60000), (req, res) => {
  if (!req.body.userId) return res.status(400).json({ error: 'Missing' });
  res.json(checkCooldown(req.body.userId));
});
app.post('/api/mark-delete', limit(30, 60000), (req, res) => {
  if (req.body.userId) markDelete(req.body.userId);
  res.json({ ok: true });
});

// Moderation - NEVER blocks, ALWAYS reformulates
app.post('/api/moderate', limit(60, 60000), async (req, res) => {
  const { title, description } = req.body;
  const check = containsBadWords((title || '') + ' ' + (description || ''));
  if (!check.found) return res.json({ flagged: false });

  const key = getGroqKey();
  if (!key) {
    let ct = title || '', cd = description || '';
    for (const w of check.words) { const r = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); ct = ct.replace(r, '[censuré]'); cd = cd.replace(r, '[censuré]'); }
    return res.json({ flagged: true, reformulated: true, cleaned: { title: ct, description: cd } });
  }

  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: `Tu modères "Gwadloup Alert", plateforme citoyenne Guadeloupe.
RÈGLES:
1. SUPPRIME noms de politiciens (Macron, Le Pen, etc) - remplace par "une personnalité" ou supprime la référence
2. SUPPRIME insultes/vulgarités - reformule poliment
3. CONSERVE le sens utile du message
4. Garde un ton naturel et amical, pas robotique
5. Si quelqu'un insulte un autre utilisateur, reformule en critique constructive
6. Ne mets JAMAIS de message d'erreur/excuse dans la réponse

Réponds UNIQUEMENT en JSON valide sans markdown: {"title":"...","description":"..."}` },
          { role: 'user', content: `Titre: ${(title || '').substring(0, 300)}\nDescription: ${(description || '').substring(0, 2000)}` }
        ],
        temperature: 0.3, max_tokens: 600
      }),
      signal: ctrl.signal
    });
    clearTimeout(to);
    if (!resp.ok) throw new Error();
    const data = await resp.json();
    let txt = data.choices[0].message.content.trim();
    if (txt.includes('```')) txt = txt.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    // Find first { and last }
    const start = txt.indexOf('{'), end = txt.lastIndexOf('}');
    if (start >= 0 && end > start) txt = txt.substring(start, end + 1);
    const parsed = JSON.parse(txt);
    // Verify the result doesn't contain bad words itself
    const recheck = containsBadWords((parsed.title || '') + ' ' + (parsed.description || ''));
    if (recheck.found) {
      let ct = parsed.title || title || '', cd = parsed.description || description || '';
      for (const w of recheck.words) { const r = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); ct = ct.replace(r, '[censuré]'); cd = cd.replace(r, '[censuré]'); }
      return res.json({ flagged: true, reformulated: true, cleaned: { title: ct, description: cd } });
    }
    return res.json({ flagged: true, reformulated: true, cleaned: { title: (parsed.title || 'Signalement').substring(0, 150), description: (parsed.description || 'Description').substring(0, 2000) } });
  } catch (e) {
    let ct = title || '', cd = description || '';
    for (const w of check.words) { const r = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); ct = ct.replace(r, '[censuré]'); cd = cd.replace(r, '[censuré]'); }
    return res.json({ flagged: true, reformulated: true, cleaned: { title: ct, description: cd } });
  }
});

app.all('/api/*', (req, res) => res.status(404).json({ error: 'Route inconnue' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Erreur serveur' }); });
app.listen(PORT, () => console.log(`Gwadloup Alert v7 — port ${PORT} — ${GROQ_KEYS.length} Groq key(s)`));
