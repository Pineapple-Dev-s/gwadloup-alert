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
  if (!content || content.length < 10) return res.status(400).json({ error: 'Contenu trop court (min 10 caractères)' });
  if (content.length > 50000) return res.status(400).json({ error: 'Contenu trop long (max 50000 caractères)' });

  // Check bad words
  const check = containsBadWords(content);
  if (check.found) return res.status(400).json({ error: 'Contenu inapproprié détecté' });

  const dir = path.join(__dirname, 'wiki');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${p}.md`);
  const isNew = !fs.existsSync(filePath);

  // Add metadata comment
  const header = `<!-- Dernière modification par ${author || 'Anonyme'} le ${new Date().toISOString()} -->\n`;
  fs.writeFileSync(filePath, header + content);

  addWikiHistory({
    page: p,
    author: author || 'Anonyme',
    isNew: isNew,
    contentLength: content.length
  });

  res.json({ ok: true, isNew: isNew });
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

  const check = containsBadWords(name + ' ' + description);
  if (check.found) return res.status(400).json({ error: 'Contenu inapproprié' });

  const proposals = getTagProposals();
  const existing = proposals.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) return res.status(400).json({ error: 'Ce tag existe déjà' });

  proposals.push({
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
    name: name,
    icon: icon || 'fa-tag',
    description: description,
    author: author || 'Anonyme',
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
  if (!voter) return res.status(400).json({ error: 'Voter ID requis' });

  const proposals = getTagProposals();
  const proposal = proposals.find(p => p.id === req.params.id);
  if (!proposal) return res.status(404).json({ error: 'Proposition introuvable' });

  if (!proposal.voters) proposal.voters = [];

  const idx = proposal.voters.indexOf(voter);
  if (idx >= 0) {
    proposal.voters.splice(idx, 1);
    proposal.votes = Math.max(0, (proposal.votes || 1) - 1);
  } else {
    proposal.voters.push(voter);
    proposal.votes = (proposal.votes || 0) + 1;
  }

  saveTagProposals(proposals);
  res.json({ ok: true, votes: proposal.votes });
});

// Moderation API
app.post('/api/moderate', limit(30, 60000), async (req, res) => {
  const { title, description } = req.body;
  const fullText = (title || '') + ' ' + (description || '');

  // Step 1: Local bad words check
  const check = containsBadWords(fullText);

  if (!check.found) {
    return res.json({ flagged: false });
  }

  // Step 2: Try to reformulate with Groq
  const groqKey = getGroqKey();
  if (!groqKey) {
    return res.json({ flagged: true, reformulated: false, reason: 'Mots inappropriés détectés' });
  }

  try {
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
            content: `Reformule ce signalement:\nTitre: ${title || '(vide)'}\nDescription: ${description || '(vide)'}`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) throw new Error('Groq API error');

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
          title: parsed.title || title,
          description: parsed.description || description
        }
      });
    } catch (e) {
      return res.json({ flagged: true, reformulated: false, reason: 'Mots inappropriés détectés' });
    }
  } catch (e) {
    console.error('Groq moderation error:', e);
    return res.json({ flagged: true, reformulated: false, reason: 'Erreur de modération' });
  }
});

// SPA
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Gwadloup Alert v4 on port ${PORT}`));
