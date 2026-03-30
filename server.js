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

// Banned words list for moderation
const BANNED_WORDS = [
  // Insultes FR
  'connard', 'connasse', 'enculé', 'enculer', 'putain', 'pute', 'salope',
  'salaud', 'batard', 'bâtard', 'ntm', 'nique', 'niquer', 'fdp', 'fils de pute',
  'ta gueule', 'ferme ta gueule', 'va te faire', 'pd', 'pédé', 'tapette',
  'gouine', 'trou du cul', 'trouduc', 'couille', 'branleur', 'branleuse',
  'merde', 'bordel', 'enfoiré', 'enfoirée', 'abruti', 'abrutie', 'débile',
  'crétin', 'crétine', 'idiot', 'idiote', 'imbécile', 'bouffon', 'bouffonne',
  'con', 'conne', 'ducon', 'pouffiasse', 'grognasse', 'pétasse',
  // Racisme / discrimination
  'nègre', 'negre', 'negro', 'bougnoule', 'bougnoul', 'arabe de merde',
  'sale arabe', 'sale noir', 'sale blanc', 'racaille', 'sous-race',
  // Menaces
  'je vais te tuer', 'je vais te buter', 'crève', 'va crever', 'va mourir',
  'suicide toi', 'suicidez-vous',
  // Créole (insultes courantes)
  'kouyon', 'couyon', 'kouyonad', 'manman ou', 'manman aw',
  'lanmè manman', 'gro bonda', 'ti kal'
];

function containsBannedWords(text) {
  if (!text) return { found: false, words: [] };
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const found = [];
  for (const word of BANNED_WORDS) {
    const normalizedWord = word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(normalizedWord)) {
      found.push(word);
    }
  }
  return { found: found.length > 0, words: found };
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
    contactEmail: 'maxenceponche971@gmail.com'
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Moderation endpoint
app.post('/api/moderate', limit(30, 60000), async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title && !description) return res.status(400).json({ error: 'No content' });

    // Check banned words
    const titleCheck = containsBannedWords(title);
    const descCheck = containsBannedWords(description);

    if (titleCheck.found || descCheck.found) {
      const allBanned = [...titleCheck.words, ...descCheck.words];
      // Try to reformulate with Groq
      const key = getGroqKey();
      if (key) {
        try {
          const reformulated = await reformulateWithGroq(key, title, description);
          return res.json({
            flagged: true,
            reformulated: true,
            original: { title, description },
            cleaned: reformulated,
            bannedWords: [...new Set(allBanned)]
          });
        } catch (e) {
          console.error('Groq reformulation failed:', e.message);
          return res.json({
            flagged: true,
            reformulated: false,
            bannedWords: [...new Set(allBanned)],
            error: 'Reformulation failed'
          });
        }
      }
      return res.json({
        flagged: true,
        reformulated: false,
        bannedWords: [...new Set(allBanned)]
      });
    }

    // No banned words - optionally still reformulate for quality
    res.json({ flagged: false, reformulated: false });
  } catch (e) {
    console.error('Moderation error:', e);
    res.status(500).json({ error: 'Moderation failed' });
  }
});

// Groq reformulation
async function reformulateWithGroq(apiKey, title, description) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `Tu es un modérateur de contenu pour une plateforme citoyenne de signalement en Guadeloupe. 
Tu dois reformuler les textes pour retirer tout langage inapproprié, insultes, menaces ou discriminations, 
tout en gardant le sens et les informations utiles du signalement.
Réponds UNIQUEMENT en JSON avec ce format exact: {"title": "titre reformulé", "description": "description reformulée"}
Ne change pas le sens. Garde le même niveau de détail. Sois factuel et neutre.`
        },
        {
          role: 'user',
          content: `Reformule ce signalement:\nTitre: ${title}\nDescription: ${description}`
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();

  // Parse JSON response
  try {
    const parsed = JSON.parse(content);
    return {
      title: parsed.title || title,
      description: parsed.description || description
    };
  } catch {
    // Try to extract from non-JSON response
    return { title: title.replace(/[^\w\s.,!?éèêëàâäùûüôöîïç'-]/gi, ''), description: description.replace(/[^\w\s.,!?éèêëàâäùûüôöîïç'-]/gi, '') };
  }
}

// Wiki - Read
app.get('/api/wiki', limit(30, 60000), (req, res) => {
  const dir = path.join(__dirname, 'wiki');
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  res.json(files.map(f => ({
    slug: f.replace('.md', ''),
    title: f.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  })));
});

app.get('/api/wiki/:page', limit(60, 60000), (req, res) => {
  const p = req.params.page.replace(/[^a-zA-Z0-9-_]/g, '');
  const f = path.join(__dirname, 'wiki', `${p}.md`);
  if (fs.existsSync(f)) res.type('text/plain').send(fs.readFileSync(f, 'utf8'));
  else res.status(404).json({ error: 'Not found' });
});

// Wiki - Create/Edit (community)
app.post('/api/wiki/:page', limit(10, 60000), async (req, res) => {
  try {
    const p = req.params.page.replace(/[^a-zA-Z0-9-_]/g, '');
    if (!p || p.length < 2) return res.status(400).json({ error: 'Invalid page name' });
    const { content, author } = req.body;
    if (!content || content.length < 10) return res.status(400).json({ error: 'Content too short' });
    if (content.length > 50000) return res.status(400).json({ error: 'Content too long' });

    // Moderate content
    const check = containsBannedWords(content);
    if (check.found) {
      return res.status(400).json({ error: 'Contenu inapproprié détecté', bannedWords: check.words });
    }

    const dir = path.join(__dirname, 'wiki');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Add edit history comment at the top if file exists
    const filePath = path.join(dir, `${p}.md`);
    const isNew = !fs.existsSync(filePath);
    const timestamp = new Date().toISOString();
    const header = `<!-- Dernière modification: ${timestamp} par ${author || 'Anonyme'} -->\n`;

    fs.writeFileSync(filePath, header + content, 'utf8');

    // Log edit
    const logDir = path.join(__dirname, 'wiki', '.history');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logEntry = { page: p, author: author || 'Anonyme', timestamp, isNew, contentLength: content.length };
    const logFile = path.join(logDir, 'edits.json');
    let logs = [];
    if (fs.existsSync(logFile)) {
      try { logs = JSON.parse(fs.readFileSync(logFile, 'utf8')); } catch { logs = []; }
    }
    logs.push(logEntry);
    if (logs.length > 1000) logs = logs.slice(-500);
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf8');

    res.json({ ok: true, isNew, slug: p });
  } catch (e) {
    console.error('Wiki save error:', e);
    res.status(500).json({ error: 'Save failed' });
  }
});

// Wiki history
app.get('/api/wiki-history', limit(30, 60000), (req, res) => {
  const logFile = path.join(__dirname, 'wiki', '.history', 'edits.json');
  if (!fs.existsSync(logFile)) return res.json([]);
  try {
    const logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    res.json(logs.reverse().slice(0, 50));
  } catch { res.json([]); }
});

// Tag proposals
const PROPOSALS_FILE = path.join(__dirname, 'data', 'tag-proposals.json');

function loadProposals() {
  if (!fs.existsSync(PROPOSALS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(PROPOSALS_FILE, 'utf8')); } catch { return []; }
}

function saveProposals(proposals) {
  const dir = path.dirname(PROPOSALS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROPOSALS_FILE, JSON.stringify(proposals, null, 2), 'utf8');
}

app.get('/api/tag-proposals', limit(30, 60000), (req, res) => {
  res.json(loadProposals());
});

app.post('/api/tag-proposals', limit(5, 60000), (req, res) => {
  try {
    const { name, icon, description, author } = req.body;
    if (!name || name.length < 2 || name.length > 50) return res.status(400).json({ error: 'Nom invalide (2-50 car.)' });
    if (!description || description.length < 10) return res.status(400).json({ error: 'Description trop courte' });

    // Moderate
    const nameCheck = containsBannedWords(name);
    const descCheck = containsBannedWords(description);
    if (nameCheck.found || descCheck.found) {
      return res.status(400).json({ error: 'Contenu inapproprié' });
    }

    const proposals = loadProposals();

    // Check duplicate
    const exists = proposals.some(p => p.name.toLowerCase() === name.toLowerCase());
    if (exists) return res.status(400).json({ error: 'Ce tag a déjà été proposé' });

    const proposal = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
      name, icon: icon || 'fa-tag', description,
      author: author || 'Anonyme',
      votes: 0, voters: [],
      status: 'pending',
      created_at: new Date().toISOString()
    };

    proposals.push(proposal);
    saveProposals(proposals);
    res.json({ ok: true, proposal });
  } catch (e) {
    console.error('Tag proposal error:', e);
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/tag-proposals/:id/vote', limit(20, 60000), (req, res) => {
  try {
    const { voter } = req.body;
    if (!voter) return res.status(400).json({ error: 'Voter required' });

    const proposals = loadProposals();
    const proposal = proposals.find(p => p.id === req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Not found' });

    if (proposal.voters.includes(voter)) {
      // Unvote
      proposal.voters = proposal.voters.filter(v => v !== voter);
      proposal.votes = Math.max(0, proposal.votes - 1);
    } else {
      proposal.voters.push(voter);
      proposal.votes++;
    }

    saveProposals(proposals);
    res.json({ ok: true, votes: proposal.votes });
  } catch (e) {
    res.status(500).json({ error: 'Vote failed' });
  }
});

// SPA
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Port ${PORT}`));
