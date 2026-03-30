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

// Enhanced bad words filter - includes political figures, slurs, creative bypasses
const BAD_WORDS = [
  // Insultes classiques
  'putain','merde','connard','connasse','enculé','enculer','nique','niquer',
  'salope','salaud','bordel','foutre','baiser','bite','couille','chier',
  'pétasse','enfoiré','bâtard','batard','fils de pute','fdp','ntm','tg',
  'ta gueule','ferme ta gueule','pd','pédé','pede','gouine','négro','negro',
  'sale race','sous race','crève','creve','va mourir','je vais te tuer',
  'nazi','hitler',
  // Insultes créatives / contournements
  'p u t a i n','m e r d e','c o n n a r d','n i q u e',
  'put1','mrd','cnnrd','enkulé','nck','ntm','stfu',
  // Personnalités politiques (pas d'insultes via noms)
  'macron','melenchon','mélenchon','le pen','lepen','zemmour','hollande',
  'sarkozy','darmanin','borne','attal','bardella','ruffin','dupond-moretti',
  // Termes haineux
  'terroriste','bombe','explosif','viol','violer','pédophile','pedophile',
  'suicide','se suicider','crever','mourir','tuer','assassiner','massacrer',
  // Insultes créoles (Guadeloupe)
  'koukoune','manman ou','fanm a ou','ti kal'
];

// Words that should ALWAYS be reformulated even in longer strings
const ALWAYS_FLAG = [
  'macron','melenchon','mélenchon','le pen','zemmour','sarkozy',
  'putain','merde','connard','enculé','nique','fdp','ntm',
  'terroriste','nazi','hitler','pédophile','viol'
];

function containsBadWords(text) {
  if (!text) return { found: false, words: [] };
  // Normalize: lowercase, remove accents, remove extra spaces
  const lower = text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-\.]/g, ' ')  // Replace separators with spaces
    .replace(/\s+/g, ' ')      // Normalize spaces
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's'); // Leet speak

  const found = [];

  // Check ALWAYS_FLAG words (substring match - catches "macron" in any context)
  for (const word of ALWAYS_FLAG) {
    const normWord = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(normWord)) {
      found.push(word);
    }
  }

  // Check full BAD_WORDS list with word boundary
  for (const word of BAD_WORDS) {
    if (found.includes(word)) continue; // Already flagged
    const normWord = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Check with word boundaries
    const escaped = normWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(?:^|[\\s,.!?;:\'"\\-_()\\[\\]@#])' + escaped + '(?:$|[\\s,.!?;:\'"\\-_()\\[\\]@#])', 'i');
    if (regex.test(' ' + lower + ' ')) {
      found.push(word);
    }
  }

  return { found: found.length > 0, words: [...new Set(found)] };
}

// Anti-farm: track report creation per user
const reportCooldowns = new Map(); // userId -> { count, firstTime, lastDelete }
function checkReportFarm(userId) {
  const now = Date.now();
  const data = reportCooldowns.get(userId);
  
  if (!data) {
    reportCooldowns.set(userId, { count: 1, firstTime: now, lastDelete: 0 });
    return { allowed: true };
  }
  
  // Reset counter every 24h
  if (now - data.firstTime > 86400000) {
    reportCooldowns.set(userId, { count: 1, firstTime: now, lastDelete: data.lastDelete });
    return { allowed: true };
  }
  
  // Max 10 reports per 24h
  if (data.count >= 10) {
    return { allowed: false, reason: 'Maximum 10 signalements par jour' };
  }
  
  // If deleted recently, 5 min cooldown before creating another
  if (data.lastDelete && now - data.lastDelete < 300000) {
    return { allowed: false, reason: 'Attendez 5 minutes après une suppression' };
  }
  
  data.count++;
  return { allowed: true };
}

function markReportDeleted(userId) {
  const data = reportCooldowns.get(userId);
  if (data) {
    data.lastDelete = Date.now();
  } else {
    reportCooldowns.set(userId, { count: 0, firstTime: Date.now(), lastDelete: Date.now() });
  }
}

// Cleanup cooldowns every hour
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of reportCooldowns) {
    if (now - v.firstTime > 86400000) reportCooldowns.delete(k);
  }
}, 3600000);

// Tag proposals file
const tagProposalsFile = path.join(__dirname, 'data', 'tag-proposals.json');
function ensureDataDir() {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function getTagProposals() {
  try { ensureDataDir(); if (fs.existsSync(tagProposalsFile)) return JSON.parse(fs.readFileSync(tagProposalsFile, 'utf8')); } catch (e) {} return [];
}
function saveTagProposals(proposals) {
  ensureDataDir(); fs.writeFileSync(tagProposalsFile, JSON.stringify(proposals, null, 2));
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
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
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
    const k = req.ip || 'unknown'; const now = Date.now(); const e = hits.get(k);
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
    name: name.substring(0, 30), icon: (icon || 'fa-tag').replace(/[^a-zA-Z0-9-]/g, ''),
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

// Anti-farm check endpoint
app.post('/api/check-farm', limit(30, 60000), (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const result = checkReportFarm(userId);
  res.json(result);
});

// Mark deletion for anti-farm
app.post('/api/mark-delete', limit(30, 60000), (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  markReportDeleted(userId);
  res.json({ ok: true });
});

// Moderation API - ALWAYS reformulates and posts (never blocks)
app.post('/api/moderate', limit(30, 60000), async (req, res) => {
  const { title, description } = req.body;
  const fullText = (title || '') + ' ' + (description || '');

  const check = containsBadWords(fullText);

  if (!check.found) {
    return res.json({ flagged: false });
  }

  // ALWAYS try to reformulate with Groq - never block the user
  const groqKey = getGroqKey();
  if (!groqKey) {
    // No Groq key? Do basic local cleanup
    let cleanTitle = title || '';
    let cleanDesc = description || '';
    for (const word of check.words) {
      const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      cleanTitle = cleanTitle.replace(regex, '***');
      cleanDesc = cleanDesc.replace(regex, '***');
    }
    return res.json({ flagged: true, reformulated: true, cleaned: { title: cleanTitle, description: cleanDesc } });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `Tu es un modérateur de contenu pour "Gwadloup Alert", une plateforme citoyenne de signalement de problèmes urbains en Guadeloupe.

RÈGLES STRICTES:
1. SUPPRIME toute référence à des personnalités politiques (Macron, Le Pen, Mélenchon, etc.)
2. SUPPRIME toutes les insultes, vulgarités et propos offensants
3. SUPPRIME les comparaisons insultantes, le sarcasme méchant
4. CONSERVE le sens utile du signalement (localisation, type de problème, description technique)
5. Reformule de manière professionnelle et neutre
6. Si le message est UNIQUEMENT une insulte sans information utile, invente une description neutre basée sur la catégorie

IMPORTANT: Tu DOIS toujours fournir un résultat utilisable. Ne rejette JAMAIS.

Réponds UNIQUEMENT avec ce JSON (pas de texte autour):
{"title": "titre reformulé propre", "description": "description reformulée propre"}`
          },
          {
            role: 'user',
            content: `Reformule ce signalement:\nTitre: ${(title || '').substring(0, 300)}\nDescription: ${(description || '').substring(0, 2000)}`
          }
        ],
        temperature: 0.2,
        max_tokens: 600
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error('Groq error');

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    try {
      // Try to extract JSON from response (handle markdown code blocks)
      let jsonStr = content;
      if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }
      const parsed = JSON.parse(jsonStr);
      return res.json({
        flagged: true,
        reformulated: true,
        cleaned: {
          title: (parsed.title || 'Signalement').substring(0, 150),
          description: (parsed.description || 'Description du problème').substring(0, 2000)
        }
      });
    } catch (parseErr) {
      // JSON parse failed - do basic local cleanup
      let cleanTitle = title || '';
      let cleanDesc = description || '';
      for (const word of check.words) {
        const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        cleanTitle = cleanTitle.replace(regex, '***');
        cleanDesc = cleanDesc.replace(regex, '***');
      }
      return res.json({ flagged: true, reformulated: true, cleaned: { title: cleanTitle, description: cleanDesc } });
    }
  } catch (e) {
    // Network/timeout error - do basic local cleanup
    let cleanTitle = title || '';
    let cleanDesc = description || '';
    for (const word of check.words) {
      const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      cleanTitle = cleanTitle.replace(regex, '***');
      cleanDesc = cleanDesc.replace(regex, '***');
    }
    return res.json({ flagged: true, reformulated: true, cleaned: { title: cleanTitle, description: cleanDesc } });
  }
});

// 404 API
app.all('/api/*', (req, res) => res.status(404).json({ error: 'Route inconnue' }));

// SPA
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, req, res, next) => { console.error('Server error:', err); res.status(500).json({ error: 'Erreur serveur' }); });

app.listen(PORT, () => console.log(`Gwadloup Alert v5 on port ${PORT}`));
