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
  'connard', 'connasse', 'salaud', 'salope', 'putain', 'pute', 'merde',
  'enculé', 'enculer', 'nique', 'niquer', 'ntm', 'ntm', 'fdp', 'fils de pute',
  'batard', 'bâtard', 'pd', 'tapette', 'gogol', 'mongol', 'débile',
  'abruti', 'crétin', 'idiot', 'imbécile', 'con ', 'conne',
  // Racisme
  'nègre', 'négro', 'bougnoul', 'bougnoule', 'arabe', 'sale arabe',
  'sale noir', 'sale blanc', 'racaille',
  // Menaces
  'je vais te tuer', 'je vais te buter', 'crève', 'va mourir',
  'je te retrouve', 'tu vas payer',
  // Spam
  'bitcoin', 'crypto monnaie', 'gagner argent', 'cliquez ici',
  'offre gratuite', 'promotion exclusive'
];

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
app.use(express.json({ limit: '2mb' }));

// Rate limiter
const hits = new Map();
function limit(max, ms) {
  return (req, res, next) => {
    const k = req.ip;
    const now = Date.now();
    const e = hits.get(k);
    if (!e || now - e.t > ms) { hits.set(k, { c: 1, t: now }); return next(); }
    if (++e.c > max) return res.status(429).json({ error: 'Trop de requêtes, réessayez plus tard' });
    next();
  };
}
setInterval(() => {
  const n = Date.now();
  for (const [k, v] of hits) if (n - v.t > 60000) hits.delete(k);
}, 30000);

// Static
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d', etag: true }));

// API Config
app.get('/api/config', limit(60, 60000), (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    imgbbApiKey: process.env.IMGBB_API_KEY || '',
    hasGroq: GROQ_KEYS.length > 0,
    contactEmail: 'maxenceponche971@gmail.com'
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// === MODERATION API ===

// Check content for banned words
app.post('/api/moderate', limit(30, 60000), (req, res) => {
  const { title, description } = req.body;
  if (!title && !description) return res.json({ ok: true, flags: [] });

  const flags = [];
  const combined = ((title || '') + ' ' + (description || '')).toLowerCase();

  for (const word of BANNED_WORDS) {
    if (combined.includes(word.toLowerCase())) {
      flags.push(word);
    }
  }

  // Check for excessive caps (more than 60% uppercase)
  const alphaChars = combined.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  if (alphaChars.length > 10) {
    const upperCount = (combined.match(/[A-ZÀ-Ÿ]/g) || []).length;
    if (upperCount / alphaChars.length > 0.6) {
      flags.push('MAJUSCULES_EXCESSIVES');
    }
  }

  // Check for repeated characters (like "aaaaaaa")
  if (/(.)\1{5,}/i.test(combined)) {
    flags.push('CARACTERES_REPETES');
  }

  res.json({
    ok: flags.length === 0,
    flags: flags,
    flagCount: flags.length
  });
});

// Reformulate with Groq AI
app.post('/api/reformulate', limit(20, 60000), async (req, res) => {
  const { title, description } = req.body;
  const key = getGroqKey();

  if (!key) {
    return res.json({ ok: false, error: 'Service IA indisponible' });
  }

  if (!title || !description) {
    return res.json({ ok: false, error: 'Titre et description requis' });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `Tu es un assistant qui reformule des signalements citoyens pour la Guadeloupe. 
Tu dois:
1. Corriger l'orthographe et la grammaire
2. Rendre le texte professionnel et respectueux
3. Garder le sens original et les détails importants
4. Supprimer tout contenu inapproprié, insultes ou menaces
5. Garder un ton factuel et descriptif
6. Ne pas inventer d'informations
7. Répondre UNIQUEMENT avec un JSON valide: {"title":"...","description":"..."}`
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
      console.error('Groq API error:', response.status);
      return res.json({ ok: false, error: 'Erreur API IA' });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    try {
      // Try to parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.json({
          ok: true,
          title: parsed.title || title,
          description: parsed.description || description
        });
      }
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
    }

    // Fallback: return original
    res.json({ ok: false, error: 'Reformulation impossible' });

  } catch (err) {
    console.error('Groq error:', err);
    res.json({ ok: false, error: 'Erreur de connexion IA' });
  }
});

// === WIKI API ===

const wikiDir = path.join(__dirname, 'wiki');

// List wiki pages
app.get('/api/wiki', limit(30, 60000), (req, res) => {
  if (!fs.existsSync(wikiDir)) {
    fs.mkdirSync(wikiDir, { recursive: true });
  }
  const files = fs.readdirSync(wikiDir).filter(f => f.endsWith('.md'));
  res.json(files.map(f => ({
    slug: f.replace('.md', ''),
    title: f.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    modified: fs.statSync(path.join(wikiDir, f)).mtime
  })));
});

// Read wiki page
app.get('/api/wiki/:page', limit(60, 60000), (req, res) => {
  const p = req.params.page.replace(/[^a-zA-Z0-9-_]/g, '');
  const f = path.join(wikiDir, `${p}.md`);
  if (fs.existsSync(f)) {
    const content = fs.readFileSync(f, 'utf8');
    const stats = fs.statSync(f);
    res.json({
      content: content,
      modified: stats.mtime,
      slug: p
    });
  } else {
    res.status(404).json({ error: 'Page introuvable' });
  }
});

// Create/Update wiki page (authenticated users)
app.post('/api/wiki/:page', limit(10, 60000), (req, res) => {
  const p = req.params.page.replace(/[^a-zA-Z0-9-_]/g, '');
  if (!p || p.length < 2 || p.length > 60) {
    return res.status(400).json({ error: 'Nom de page invalide (2-60 caractères, lettres/chiffres/tirets)' });
  }

  const { content, author } = req.body;
  if (!content || content.trim().length < 10) {
    return res.status(400).json({ error: 'Contenu trop court (min 10 caractères)' });
  }
  if (content.length > 50000) {
    return res.status(400).json({ error: 'Contenu trop long (max 50000 caractères)' });
  }

  // Add metadata header
  const header = `<!-- Dernière modification par ${author || 'Anonyme'} le ${new Date().toLocaleDateString('fr-FR')} -->\n`;
  const finalContent = header + content;

  if (!fs.existsSync(wikiDir)) {
    fs.mkdirSync(wikiDir, { recursive: true });
  }

  fs.writeFileSync(path.join(wikiDir, `${p}.md`), finalContent, 'utf8');
  res.json({ ok: true, slug: p });
});

// Delete wiki page (admin only - checked client-side)
app.delete('/api/wiki/:page', limit(10, 60000), (req, res) => {
  const p = req.params.page.replace(/[^a-zA-Z0-9-_]/g, '');
  const f = path.join(wikiDir, `${p}.md`);

  // Protect default pages
  const protectedPages = ['accueil', 'categories', 'communes', 'technologie'];
  if (protectedPages.includes(p)) {
    return res.status(403).json({ error: 'Page protégée, suppression impossible' });
  }

  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: 'Page introuvable' });
  }
});

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Gwadloup Alert — Port ${PORT} — ${GROQ_KEYS.length} clés Groq chargées`));
