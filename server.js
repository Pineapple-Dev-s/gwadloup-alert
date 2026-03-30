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
  'terroriste','bombe','explosif','nazi','hitler'
];

// Wiki whitelist - words that contain bad word substrings but are OK
const WIKI_WHITELIST = [
  'bombardement','bombarder','bombardé','bombe atomique','bombé','bombée',
  'plombé','plombée','plomber','colombage','colombier','colombe',
  'salopette','enfoiré de route','batardeau',
  'crever','crevette','crevasse','crévasse',
  'niquement','uniquement','communiquer','communication',
  'pédestre','pédestrian','pédale','pédagogie','pédagogique',
  'négocier','négociation','négritude','montenegro',
  'exploiter','exploitation','explosif','explosion',
  'terrorisme','antiterroriste',
  'bassine','bassin','bassinoire',
  'rebomber','retomber','tombé','tombée',
  'chier','fichier','clicher','afficher',
  'fourniture','fourchette','fournir',
  'baiser','abaiser','abaisser','rabaisser'
];

function containsBadWords(text, useWhitelist) {
  if (!text) return { found: false, words: [] };
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const found = [];

  for (const word of BAD_WORDS) {
    const normWord = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(normWord)) {
      // If whitelist mode, check if the match is part of a whitelisted word
      if (useWhitelist) {
        let isWhitelisted = false;
        for (const safe of WIKI_WHITELIST) {
          const normSafe = safe.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          if (lower.includes(normSafe)) {
            isWhitelisted = true;
            break;
          }
        }
        if (isWhitelisted) continue;
      }

      // Additional check: ensure it's a standalone word or clear substring
      // Allow words where the bad word is part of a longer innocent word
      const regex = new RegExp('(?:^|[\\s,.!?;:\'\"\\-_()\\[\\]])' + normWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|[\\s,.!?;:\'\"\\-_()\\[\\]])', 'i');
      if (regex.test(' ' + lower + ' ')) {
        found.push(word);
      }
    }
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
  try {
    const dir = path.join(__dirname, 'wiki');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(wikiHistoryFile, JSON.stringify(history, null, 2));
  } catch (e) {
    console.error('Wiki history write error:', e);
  }
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

// Security headers - ultra hardened
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions policy - restrict everything
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()');
  // Content Security Policy
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://i.ibb.co https://*.tile.openstreetmap.org; " +
    "connect-src 'self' https://*.supabase.co https://api.imgbb.com https://nominatim.openstreetmap.org https://api.groq.com; " +
    "frame-src 'none'; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );
  // HSTS
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  // Prevent caching of sensitive data
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : '*',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(compression());
app.use(express.json({ limit: '500kb' }));

// Rate limiter with better IP detection
const hits = new Map();
function limit(max, ms) {
  return (req, res, next) => {
    const k = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const e = hits.get(k);
    if (!e || now - e.t > ms) { hits.set(k, { c: 1, t: now }); return next(); }
    if (++e.c > max) {
      res.setHeader('Retry-After', Math.ceil(ms / 1000));
      return res.status(429).json({ error: 'Trop de requêtes. Réessayez dans un moment.' });
    }
    next();
  };
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (n - v.t > 60000) hits.delete(k); }, 30000);

// Input sanitization middleware
function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Remove null bytes
        req.body[key] = req.body[key].replace(/\0/g, '');
        // Limit string length
        if (req.body[key].length > 50000) {
          req.body[key] = req.body[key].substring(0, 50000);
        }
      }
    }
  }
  next();
}
app.use(sanitizeInput);

// Static files with security
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  etag: true,
  dotfiles: 'deny',
  index: 'index.html'
}));

// API Config
app.get('/api/config', limit(60, 60000), (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    imgbbApiKey: process.env.IMGBB_API_KEY || '',
    contactEmail: process.env.CONTACT_EMAIL || 'maxenceponche971@gmail.com'
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true, timestamp: Date.now() }));

// Wiki - List pages
app.get('/api/wiki', limit(30, 60000), (req, res) => {
  const dir = path.join(__dirname, 'wiki');
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); return res.json([]); }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('.'));
  res.json(files.map(f => ({
    slug: f.replace('.md', ''),
    title: f.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  })));
});

// Wiki - Read page
app.get('/api/wiki/:page', limit(60, 60000), (req, res) => {
  const p = req.params.page.replace(/[^a-zA-Z0-9-_]/g, '');
  if (!p || p.startsWith('.')) return res.status(400).json({ error: 'Invalid page' });
  const f = path.join(__dirname, 'wiki', `${p}.md`);
  if (fs.existsSync(f)) res.type('text/plain').send(fs.readFileSync(f, 'utf8'));
  else res.status(404).json({ error: 'Not found' });
});

// Wiki - Create/Edit page
app.post('/api/wiki/:page', limit(20, 60000), (req, res) => {
  const p = req.params.page.replace(/[^a-zA-Z0-9-_]/g, '');
  if (!p || p.length < 2 || p.startsWith('.')) return res.status(400).json({ error: 'Slug invalide' });

  const { content, author } = req.body;
  if (!content || content.length < 10) return res.status(400).json({ error: 'Contenu trop court (min 10 caractères)' });
  if (content.length > 50000) return res.status(400).json({ error: 'Contenu trop long (max 50000 caractères)' });

  // Check bad words with whitelist for wiki content
  const check = containsBadWords(content, true);
  if (check.found) return res.status(400).json({ error: 'Contenu inapproprié détecté: ' + check.words.join(', ') });

  const dir = path.join(__dirname, 'wiki');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${p}.md`);
  const isNew = !fs.existsSync(filePath);

  const header = `<!-- Dernière modification par ${(author || 'Anonyme').replace(/[<>]/g, '')} le ${new Date().toISOString()} -->\n`;
  fs.writeFileSync(filePath, header + content);

  addWikiHistory({
    page: p,
    author: (author || 'Anonyme').replace(/[<>]/g, ''),
    isNew: isNew,
    contentLength: content.length
  });

  res.json({ ok: true, isNew: isNew });
});

// Wiki - Delete page (admin only - verified client-side via Supabase role)
app.delete('/api/wiki/:page', limit(10, 60000), (req, res) => {
  const p = req.params.page.replace(/[^a-zA-Z0-9-_]/g, '');
  if (!p || p.startsWith('.')) return res.status(400).json({ error: 'Invalid page' });

  const filePath = path.join(__dirname, 'wiki', `${p}.md`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Page introuvable' });

  try {
    fs.unlinkSync(filePath);
    addWikiHistory({
      page: p,
      author: (req.body && req.body.author) || 'Admin',
      isNew: false,
      contentLength: 0,
      action: 'deleted'
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('Wiki delete error:', e);
    res.status(500).json({ error: 'Erreur de suppression' });
  }
});

// Wiki - History
app.get('/api/wiki-history', limit(30, 60000), (req, res) => {
  res.json(getWikiHistory().slice(0, 50));
});

// Tag Proposals - List
app.get('/api/tag-proposals', limit(30, 60000), (req, res) => {
  res.json(getTagProposals());
});

// Tag Proposals - Create
app.post('/api/tag-proposals', limit(10, 60000), (req, res) => {
  const { name, icon, description, author } = req.body;
  if (!name || name.length < 2 || name.length > 30) return res.status(400).json({ error: 'Nom invalide (2-30 caractères)' });
  if (!description || description.length < 5 || description.length > 200) return res.status(400).json({ error: 'Description invalide (5-200 caractères)' });

  const check = containsBadWords(name + ' ' + description, false);
  if (check.found) return res.status(400).json({ error: 'Contenu inapproprié' });

  // Sanitize icon input
  const safeIcon = (icon || 'fa-tag').replace(/[^a-zA-Z0-9-]/g, '');

  const proposals = getTagProposals();
  const existing = proposals.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) return res.status(400).json({ error: 'Ce tag existe déjà' });

  proposals.push({
    id: crypto.randomBytes(8).toString('hex'),
    name: name.substring(0, 30),
    icon: safeIcon,
    description: description.substring(0, 200),
    author: (author || 'Anonyme').replace(/[<>]/g, '').substring(0, 30),
    votes: 0,
    voters: [],
    created_at: new Date().toISOString()
  });

  saveTagProposals(proposals);
  res.json({ ok: true });
});

// Tag Proposals - Vote
app.post('/api/tag-proposals/:id/vote', limit(30, 60000), (req, res) => {
  const { voter } = req.body;
  if (!voter || typeof voter !== 'string') return res.status(400).json({ error: 'Voter ID requis' });

  const safeVoter = voter.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 50);

  const proposals = getTagProposals();
  const proposal = proposals.find(p => p.id === req.params.id);
  if (!proposal) return res.status(404).json({ error: 'Proposition introuvable' });

  if (!proposal.voters) proposal.voters = [];

  const idx = proposal.voters.indexOf(safeVoter);
  if (idx >= 0) {
    proposal.voters.splice(idx, 1);
    proposal.votes = Math.max(0, (proposal.votes || 1) - 1);
  } else {
    proposal.voters.push(safeVoter);
    proposal.votes = (proposal.votes || 0) + 1;
  }

  saveTagProposals(proposals);
  res.json({ ok: true, votes: proposal.votes });
});

// Moderation API
app.post('/api/moderate', limit(30, 60000), async (req, res) => {
  const { title, description } = req.body;
  const fullText = (title || '') + ' ' + (description || '');

  // Step 1: Local bad words check (strict mode, no whitelist)
  const check = containsBadWords(fullText, false);

  if (!check.found) {
    return res.json({ flagged: false });
  }

  // Step 2: Try to reformulate with Groq
  const groqKey = getGroqKey();
  if (!groqKey) {
    return res.json({ flagged: true, reformulated: false, reason: 'Mots inappropriés détectés' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'Tu es un modérateur de contenu pour une plateforme citoyenne de signalement de problèmes urbains en Guadeloupe. Tu dois reformuler le texte pour supprimer tout langage inapproprié, insultes, ou propos offensants tout en conservant le sens du message. Réponds UNIQUEMENT avec un JSON: {"title": "titre reformulé", "description": "description reformulée"}. Si le contenu est purement haineux sans message constructif, réponds: {"rejected": true}'
          },
          {
            role: 'user',
            content: `Reformule ce signalement:\nTitre: ${(title || '(vide)').substring(0, 200)}\nDescription: ${(description || '(vide)').substring(0, 2000)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) throw new Error('Groq API error: ' + response.status);

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    try {
      const parsed = JSON.parse(content);
      if (parsed.rejected) {
        return res.json({ flagged: true, reformulated: false, reason: 'Contenu rejeté par la modération' });
      }
      return res.json({
        flagged: true,
        reformulated: true,
        cleaned: {
          title: (parsed.title || title || '').substring(0, 150),
          description: (parsed.description || description || '').substring(0, 2000)
        }
      });
    } catch (e) {
      return res.json({ flagged: true, reformulated: false, reason: 'Mots inappropriés détectés' });
    }
  } catch (e) {
    console.error('Groq moderation error:', e.message);
    return res.json({ flagged: true, reformulated: false, reason: 'Erreur de modération' });
  }
});

// 404 for unknown API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Route inconnue' });
});

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

app.listen(PORT, () => console.log(`Gwadloup Alert v4 on port ${PORT}`));
