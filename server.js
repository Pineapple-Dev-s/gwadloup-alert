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

// Bad words - EXTENDED LIST
const BAD_WORDS = [
  'putain','merde','connard','connasse','enculé','enculer','nique','niquer',
  'salope','salaud','bordel','foutre','bite','couille','chier',
  'pétasse','enfoiré','bâtard','batard','fils de pute','fdp','ntm','tg',
  'ta gueule','pd','pédé','gouine','négro','negro',
  'sale race','sous race','va mourir','je vais te tuer',
  'nazi','hitler','terroriste','pédophile','pedophile',
  'koukoune','manman ou','ti kal',
  // NEW - insults that were bypassing
  'idiot','idiote','imbécile','imbecile','crétin','cretin','débile','debile',
  'abruti','abrutie','con ','conne','ducon','bouffon','bouffonne',
  'taré','tare','tarée','demeuré','demeure','gogol','mongol',
  'enflure','ordure','pourriture','raclure','morveux','branleur',
  'trouduc','trou du cul','naze','nazes','tocard','tocarde',
  'pov type','pauvre type','pauvre con','gros con','sale con',
  'ferme ta gueule','ferme la','va te faire','casse toi',
  'dégage','degage','la ferme','stupide','bête','bete',
  'nul','nulle','nuls','nulles','incapable','incompétent',
  'minable','lamentable','pathétique','pathetique','ridicule'
];

const ALWAYS_FLAG = [
  'macron','melenchon','mélenchon','le pen','zemmour','sarkozy','hollande',
  'darmanin','borne','attal','bardella',
  'putain','merde','connard','enculé','nique','fdp','ntm',
  'nazi','hitler','pédophile',
  // NEW
  'idiot','imbécile','crétin','débile','abruti','con ','bouffon',
  'taré','demeuré','gogol','stupide'
];

// Soft insults - reformulate but don't censor harshly
const SOFT_INSULTS = [
  'idiot','idiote','stupide','bête','bete','nul','nulle','nuls',
  'ridicule','lamentable','pathétique','pathetique','minable',
  'incapable','incompétent','incompetent'
];

function containsBadWords(text) {
  if (!text) return { found: false, words: [], severity: 'none' };
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-\.]/g, ' ').replace(/\s+/g, ' ')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's')
    .replace(/!/g, 'i').replace(/@/g, 'a').replace(/\$/g, 's');
  const found = [];
  let severity = 'none';

  for (const w of ALWAYS_FLAG) {
    const nw = w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(nw)) {
      found.push(w);
      if (!SOFT_INSULTS.includes(w)) severity = 'hard';
      else if (severity !== 'hard') severity = 'soft';
    }
  }

  for (const w of BAD_WORDS) {
    if (found.includes(w)) continue;
    const nw = w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (new RegExp('(?:^|\\W)' + nw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|\\W)', 'i').test(' ' + lower + ' ')) {
      found.push(w);
      if (!SOFT_INSULTS.includes(w)) severity = 'hard';
      else if (severity !== 'hard') severity = 'soft';
    }
  }

  // Detect patterns like "t bete", "t nul", "t con"
  const insultPatterns = [
    /\bt(?:u es|es|'es)\s+(?:un|une)?\s*(?:idiot|con|nul|bete|stupide|debile|cretin|abruti)/i,
    /(?:quel|quelle)\s+(?:idiot|con|nul|abruti|debile|cretin)/i,
    /(?:espece|espèce)\s+(?:de|d')\s*(?:idiot|con|nul|abruti|debile|cretin|imbecile)/i,
    /(?:gros|grosse|sale|petit|petite)\s+(?:idiot|con|nul|abruti|debile|cretin|merde)/i
  ];
  for (const pattern of insultPatterns) {
    if (pattern.test(lower)) {
      found.push('[insulte détectée]');
      if (severity !== 'hard') severity = 'soft';
    }
  }

  return { found: found.length > 0, words: [...new Set(found)], severity };
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
    repoUrl: 'https://github.com/MaxLananas-debug/gwadloup',
    groqAvailable: GROQ_KEYS.length > 0
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

// Moderation - IMPROVED: Never returns apology messages, always reformulates naturally
app.post('/api/moderate', limit(60, 60000), async (req, res) => {
  const { title, description } = req.body;
  const check = containsBadWords((title || '') + ' ' + (description || ''));
  if (!check.found) return res.json({ flagged: false });

  const key = getGroqKey();
  if (!key) {
    let ct = title || '', cd = description || '';
    for (const w of check.words) {
      if (w === '[insulte détectée]') continue;
      const r = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      ct = ct.replace(r, '***');
      cd = cd.replace(r, '***');
    }
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
          { role: 'system', content: `Tu es un filtre de modération pour "Gwadloup Alert", une plateforme citoyenne en Guadeloupe.

TON TRAVAIL : Reformuler les messages problématiques de manière NATURELLE et CONSTRUCTIVE.

RÈGLES STRICTES :
1. SUPPRIME tout nom de politicien (Macron, Le Pen, Mélenchon, Zemmour, Sarkozy, etc.) → remplace par "une personnalité publique" ou reformule sans
2. SUPPRIME toute insulte ou vulgarité → reformule poliment le même sens
3. SUPPRIME les attaques personnelles → transforme en critique constructive
4. CONSERVE absolument le sens utile et l'intention du message
5. Garde un ton NATUREL, comme si un humain poli l'avait écrit
6. La réponse doit sembler écrite par l'auteur original, pas par un robot

INTERDICTIONS ABSOLUES :
- NE METS JAMAIS de message d'excuse ("Je suis désolé", "Je ne peux pas", etc.)
- NE METS JAMAIS d'explication sur pourquoi tu as modifié
- NE METS JAMAIS de commentaire méta sur le contenu
- NE REFUSE JAMAIS de reformuler - tu reformules TOUJOURS
- NE METS PAS de crochets [censuré] ou d'astérisques ***

EXEMPLES :
- "Macron est un idiot" → "La politique actuelle pose des questions"  
- "Ce mec est un connard il gare sa voiture n'importe où" → "Quelqu'un gare son véhicule de manière gênante"
- "Nique ta mère sale route" → "Cette route est en très mauvais état"
- "T'es bête ou quoi ?" → "Je ne suis pas d'accord avec ce point de vue"
- "En vrai ça serait cool un nouveau tag pour la police qu'est-ce que t'en penses maxence idiot ?" → "En vrai ça serait cool un nouveau tag pour la police, qu'est-ce que vous en pensez ?"

Réponds UNIQUEMENT en JSON valide sans markdown ni backticks : {"title":"...","description":"..."}` },
          { role: 'user', content: `Titre: ${(title || '').substring(0, 300)}\nDescription: ${(description || '').substring(0, 2000)}` }
        ],
        temperature: 0.3, max_tokens: 600
      }),
      signal: ctrl.signal
    });
    clearTimeout(to);
    if (!resp.ok) throw new Error('Groq API error: ' + resp.status);
    const data = await resp.json();
    let txt = data.choices[0].message.content.trim();

    // Clean markdown artifacts
    if (txt.includes('```')) txt = txt.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const start = txt.indexOf('{'), end = txt.lastIndexOf('}');
    if (start >= 0 && end > start) txt = txt.substring(start, end + 1);

    let parsed;
    try {
      parsed = JSON.parse(txt);
    } catch (parseErr) {
      // JSON parse failed - fallback to simple censoring
      throw new Error('JSON parse failed');
    }

    // CRITICAL: Check if LLM returned an apology/refusal message
    const apologyPatterns = [
      'je suis désolé', 'je ne peux pas', 'je ne suis pas en mesure',
      'veuillez reformuler', 'je ne peux pas répondre',
      'nous sommes là pour', 'de manière respectueuse',
      'je m\'excuse', 'il m\'est impossible', 'je refuse',
      'contenu inapproprié', 'message inapproprié'
    ];
    const combinedResult = ((parsed.title || '') + ' ' + (parsed.description || '')).toLowerCase();
    const isApology = apologyPatterns.some(p => combinedResult.includes(p));

    if (isApology) {
      // LLM refused - do manual smart censoring instead
      let ct = title || '', cd = description || '';
      for (const w of check.words) {
        if (w === '[insulte détectée]') continue;
        const r = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        ct = ct.replace(r, '...');
        cd = cd.replace(r, '...');
      }
      return res.json({ flagged: true, reformulated: true, cleaned: { title: ct, description: cd } });
    }

    // Verify the result doesn't contain bad words itself
    const recheck = containsBadWords((parsed.title || '') + ' ' + (parsed.description || ''));
    if (recheck.found) {
      let ct = parsed.title || title || '', cd = parsed.description || description || '';
      for (const w of recheck.words) {
        if (w === '[insulte détectée]') continue;
        const r = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        ct = ct.replace(r, '...');
        cd = cd.replace(r, '...');
      }
      return res.json({ flagged: true, reformulated: true, cleaned: { title: ct, description: cd } });
    }

    return res.json({
      flagged: true, reformulated: true,
      cleaned: {
        title: (parsed.title || 'Signalement').substring(0, 150),
        description: (parsed.description || 'Description').substring(0, 2000)
      }
    });
  } catch (e) {
    // Fallback: simple word replacement
    let ct = title || '', cd = description || '';
    for (const w of check.words) {
      if (w === '[insulte détectée]') continue;
      const r = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      ct = ct.replace(r, '...');
      cd = cd.replace(r, '...');
    }
    return res.json({ flagged: true, reformulated: true, cleaned: { title: ct, description: cd } });
  }
});

app.all('/api/*', (req, res) => res.status(404).json({ error: 'Route inconnue' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Erreur serveur' }); });
app.listen(PORT, () => console.log(`Gwadloup Alert v8 — port ${PORT} — ${GROQ_KEYS.length} Groq key(s)`));
