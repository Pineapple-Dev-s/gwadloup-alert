require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const GROQ_KEYS = (process.env.GROQ_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
let groqIdx = 0;
function getGroqKey() {
  if (!GROQ_KEYS.length) return null;
  return GROQ_KEYS[groqIdx++ % GROQ_KEYS.length];
}

// ═══════════════════════════════════════════════════════
// ANALYTICS ENGINE — In-memory with periodic persistence
// ═══════════════════════════════════════════════════════
const analytics = {
  // Current data (in memory for speed)
  today: new Date().toISOString().split('T')[0],
  data: {
    pageviews: {},      // { "2025-03-30": 1234 }
    visitors: {},       // { "2025-03-30": Set() }
    pages: {},          // { "/": 500, "/#report/xxx": 20 }
    referrers: {},      // { "instagram.com": 50 }
    devices: { mobile: 0, tablet: 0, desktop: 0 },
    browsers: {},       // { "Chrome": 400 }
    countries: {},      // from Accept-Language
    events: {},         // { "report_created": 10 }
    hourly: {},         // { "14": 50 }
    live: [],           // last 100 visits for "live" view
    totalPageviews: 0,
    totalVisitors: 0,
    peakConcurrent: 0,
    _concurrent: 0
  },

  // File path for persistence
  filePath: path.join(__dirname, '.analytics.json'),

  init: function() {
    // Load from file if exists
    try {
      if (fs.existsSync(this.filePath)) {
        var saved = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        // Restore everything except Sets (visitors)
        this.data.pageviews = saved.pageviews || {};
        this.data.pages = saved.pages || {};
        this.data.referrers = saved.referrers || {};
        this.data.devices = saved.devices || { mobile: 0, tablet: 0, desktop: 0 };
        this.data.browsers = saved.browsers || {};
        this.data.countries = saved.countries || {};
        this.data.events = saved.events || {};
        this.data.hourly = saved.hourly || {};
        this.data.totalPageviews = saved.totalPageviews || 0;
        this.data.totalVisitors = saved.totalVisitors || 0;
        this.data.peakConcurrent = saved.peakConcurrent || 0;
        // Rebuild visitor sets from counts
        this.data.visitors = {};
        if (saved.visitorCounts) {
          for (var day in saved.visitorCounts) {
            this.data.visitors[day] = new Set();
            // We can't restore individual IPs, but we keep the count
          }
        }
        console.log('Analytics loaded: ' + this.data.totalPageviews + ' total pageviews');
      }
    } catch(e) {
      console.warn('Analytics load error:', e.message);
    }

    // Save every 5 minutes
    setInterval(function() { analytics.save(); }, 300000);

    // Reset daily at midnight
    setInterval(function() {
      var now = new Date().toISOString().split('T')[0];
      if (now !== analytics.today) {
        analytics.today = now;
        analytics.data.hourly = {};
      }
    }, 60000);
  },

  save: function() {
    try {
      var toSave = JSON.parse(JSON.stringify(this.data));
      // Convert Sets to counts for serialization
      toSave.visitorCounts = {};
      for (var day in this.data.visitors) {
        if (this.data.visitors[day] instanceof Set) {
          toSave.visitorCounts[day] = this.data.visitors[day].size;
        }
      }
      delete toSave.visitors;
      delete toSave.live;
      delete toSave._concurrent;
      fs.writeFileSync(this.filePath, JSON.stringify(toSave), 'utf8');
    } catch(e) {
      console.warn('Analytics save error:', e.message);
    }
  },

  track: function(req) {
    var now = new Date();
    var day = now.toISOString().split('T')[0];
    var hour = String(now.getHours());
    var ua = req.headers['user-agent'] || '';
    var ref = req.headers['referer'] || req.headers['referrer'] || '';
    var lang = req.headers['accept-language'] || '';
    var ip = req.ip || req.connection.remoteAddress || 'unknown';
    var visitorId = this._hash(ip + ua.substring(0, 50));
    var page = req.path || '/';

    // Pageview
    if (!this.data.pageviews[day]) this.data.pageviews[day] = 0;
    this.data.pageviews[day]++;
    this.data.totalPageviews++;

    // Unique visitor
    if (!this.data.visitors[day]) this.data.visitors[day] = new Set();
    var isNew = !this.data.visitors[day].has(visitorId);
    this.data.visitors[day].add(visitorId);
    if (isNew) this.data.totalVisitors++;

    // Page
    if (!this.data.pages[page]) this.data.pages[page] = 0;
    this.data.pages[page]++;

    // Referrer
    if (ref) {
      try {
        var refHost = new URL(ref).hostname.replace('www.', '');
        if (refHost && refHost !== req.hostname) {
          if (!this.data.referrers[refHost]) this.data.referrers[refHost] = 0;
          this.data.referrers[refHost]++;
        }
      } catch(e) {}
    }

    // Device
    var device = this._getDevice(ua);
    this.data.devices[device]++;

    // Browser
    var browser = this._getBrowser(ua);
    if (!this.data.browsers[browser]) this.data.browsers[browser] = 0;
    this.data.browsers[browser]++;

    // Language/Country
    var country = this._getCountry(lang);
    if (!this.data.countries[country]) this.data.countries[country] = 0;
    this.data.countries[country]++;

    // Hourly
    if (!this.data.hourly[hour]) this.data.hourly[hour] = 0;
    this.data.hourly[hour]++;

    // Live visitors (last 100)
    this.data.live.push({
      time: now.toISOString(),
      page: page,
      device: device,
      browser: browser,
      country: country,
      ref: ref ? (function() { try { return new URL(ref).hostname; } catch(e) { return ''; } })() : '',
      isNew: isNew
    });
    if (this.data.live.length > 100) this.data.live = this.data.live.slice(-100);

    // Concurrent
    this.data._concurrent++;
    if (this.data._concurrent > this.data.peakConcurrent) {
      this.data.peakConcurrent = this.data._concurrent;
    }
    setTimeout(function() { analytics.data._concurrent = Math.max(0, analytics.data._concurrent - 1); }, 30000);
  },

  trackEvent: function(name) {
    if (!this.data.events[name]) this.data.events[name] = 0;
    this.data.events[name]++;
  },

  getStats: function(days) {
    days = days || 30;
    var now = new Date();
    var result = {
      period: days + ' jours',
      totalPageviews: this.data.totalPageviews,
      totalVisitors: this.data.totalVisitors,
      peakConcurrent: this.data.peakConcurrent,
      currentConcurrent: this.data._concurrent,
      daily: [],
      topPages: [],
      topReferrers: [],
      devices: this.data.devices,
      browsers: [],
      countries: [],
      events: this.data.events,
      hourly: this.data.hourly,
      live: this.data.live.slice(-20)
    };

    // Daily stats for last N days
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(now);
      d.setDate(d.getDate() - i);
      var key = d.toISOString().split('T')[0];
      result.daily.push({
        date: key,
        pageviews: this.data.pageviews[key] || 0,
        visitors: this.data.visitors[key] ? this.data.visitors[key].size : 0
      });
    }

    // Top pages
    var pages = Object.entries(this.data.pages).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 15);
    result.topPages = pages.map(function(p) { return { path: p[0], views: p[1] }; });

    // Top referrers
    var refs = Object.entries(this.data.referrers).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 10);
    result.topReferrers = refs.map(function(r) { return { source: r[0], visits: r[1] }; });

    // Browsers
    var browsers = Object.entries(this.data.browsers).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 8);
    result.browsers = browsers.map(function(b) { return { name: b[0], count: b[1] }; });

    // Countries
    var countries = Object.entries(this.data.countries).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 10);
    result.countries = countries.map(function(c) { return { name: c[0], count: c[1] }; });

    // Today stats
    var today = now.toISOString().split('T')[0];
    result.todayPageviews = this.data.pageviews[today] || 0;
    result.todayVisitors = this.data.visitors[today] ? this.data.visitors[today].size : 0;

    return result;
  },

  _hash: function(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + c;
      hash = hash & hash;
    }
    return 'v' + Math.abs(hash).toString(36);
  },

  _getDevice: function(ua) {
    if (/iPad|tablet|Tab/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iPhone|iPod/i.test(ua)) return 'mobile';
    return 'desktop';
  },

  _getBrowser: function(ua) {
    if (/Edg\//i.test(ua)) return 'Edge';
    if (/OPR|Opera/i.test(ua)) return 'Opera';
    if (/Firefox/i.test(ua)) return 'Firefox';
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
    if (/Chrome/i.test(ua)) return 'Chrome';
    if (/MSIE|Trident/i.test(ua)) return 'IE';
    return 'Autre';
  },

  _getCountry: function(lang) {
    if (!lang) return 'Inconnu';
    var primary = lang.split(',')[0].trim();
    var parts = primary.split('-');
    var region = parts.length > 1 ? parts[1].toUpperCase() : parts[0].toUpperCase();
    var map = { FR: 'France', GP: 'Guadeloupe', MQ: 'Martinique', GF: 'Guyane', RE: 'Réunion', US: 'États-Unis', GB: 'Royaume-Uni', CA: 'Canada', BE: 'Belgique', CH: 'Suisse', HT: 'Haïti', SN: 'Sénégal', CI: 'Côte d\'Ivoire', CM: 'Cameroun', DE: 'Allemagne', ES: 'Espagne', IT: 'Italie', BR: 'Brésil', PT: 'Portugal' };
    return map[region] || region || 'Inconnu';
  }
};

analytics.init();

// ═══════════════════════════════════════════════════════
// MODERATION
// ═══════════════════════════════════════════════════════
const BAD_WORDS = [
  'putain','merde','connard','connasse','enculé','enculer','nique','niquer',
  'salope','salaud','bordel','foutre','bite','couille','chier',
  'pétasse','enfoiré','bâtard','batard','fils de pute','fdp','ntm','tg',
  'ta gueule','pd','pédé','gouine','négro','negro',
  'sale race','sous race','va mourir','je vais te tuer',
  'nazi','hitler','terroriste','pédophile','pedophile',
  'koukoune','manman ou','ti kal',
  'idiot','idiote','imbécile','imbecile','crétin','cretin','débile','debile',
  'abruti','abrutie','con ','conne','ducon','bouffon','bouffonne',
  'taré','tare','tarée','demeuré','demeure','gogol','mongol',
  'enflure','ordure','pourriture','raclure','morveux','branleur',
  'trouduc','trou du cul','naze','nazes','tocard','tocarde',
  'pov type','pauvre type','pauvre con','gros con','sale con',
  'ferme ta gueule','ferme la','va te faire','casse toi',
  'dégage','degage','la ferme','stupide','bête','bete'
];
const ALWAYS_FLAG = [
  'macron','melenchon','mélenchon','le pen','zemmour','sarkozy','hollande',
  'darmanin','borne','attal','bardella',
  'putain','merde','connard','enculé','nique','fdp','ntm',
  'nazi','hitler','pédophile',
  'idiot','imbécile','crétin','débile','abruti','con ','bouffon',
  'taré','demeuré','gogol','stupide'
];
const SOFT_INSULTS = [
  'idiot','idiote','stupide','bête','bete','nul','nulle','nuls',
  'ridicule','lamentable','pathétique','pathetique','minable',
  'incapable','incompétent','incompetent'
];

function containsBadWords(text) {
  if (!text) return { found: false, words: [], severity: 'none' };
  var lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-\.]/g, ' ').replace(/\s+/g, ' ')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's')
    .replace(/!/g, 'i').replace(/@/g, 'a').replace(/\$/g, 's');
  var found = [];
  var severity = 'none';
  for (var i = 0; i < ALWAYS_FLAG.length; i++) {
    var w = ALWAYS_FLAG[i];
    var nw = w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(nw)) { found.push(w); if (SOFT_INSULTS.indexOf(w) === -1) severity = 'hard'; else if (severity !== 'hard') severity = 'soft'; }
  }
  for (var i = 0; i < BAD_WORDS.length; i++) {
    var w = BAD_WORDS[i];
    if (found.indexOf(w) !== -1) continue;
    var nw = w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (new RegExp('(?:^|\\W)' + nw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|\\W)', 'i').test(' ' + lower + ' ')) {
      found.push(w); if (SOFT_INSULTS.indexOf(w) === -1) severity = 'hard'; else if (severity !== 'hard') severity = 'soft';
    }
  }
  var insultPatterns = [
    /\bt(?:u es|es|'es)\s+(?:un|une)?\s*(?:idiot|con|nul|bete|stupide|debile|cretin|abruti)/i,
    /(?:quel|quelle)\s+(?:idiot|con|nul|abruti|debile|cretin)/i,
    /(?:espece|espèce)\s+(?:de|d')\s*(?:idiot|con|nul|abruti|debile|cretin|imbecile)/i,
    /(?:gros|grosse|sale|petit|petite)\s+(?:idiot|con|nul|abruti|debile|cretin|merde)/i
  ];
  for (var j = 0; j < insultPatterns.length; j++) {
    if (insultPatterns[j].test(lower)) { found.push('[insulte]'); if (severity !== 'hard') severity = 'soft'; }
  }
  var unique = [];
  for (var k = 0; k < found.length; k++) { if (unique.indexOf(found[k]) === -1) unique.push(found[k]); }
  return { found: unique.length > 0, words: unique, severity: severity };
}

var cooldowns = new Map();
function checkCooldown(userId) {
  var now = Date.now(), d = cooldowns.get(userId);
  if (!d) { cooldowns.set(userId, { last: now, delCount: 0, delReset: now }); return { allowed: true }; }
  if (now - d.delReset > 3600000) { d.delCount = 0; d.delReset = now; }
  if (d.delCount >= 5 && now - d.last < 600000) return { allowed: false, reason: 'Trop de suppressions. Attendez 10 min.' };
  if (now - d.last < 8000) return { allowed: false, reason: 'Attendez quelques secondes' };
  d.last = now;
  return { allowed: true };
}
function markDelete(userId) {
  var d = cooldowns.get(userId);
  if (d) d.delCount++; else cooldowns.set(userId, { last: Date.now(), delCount: 1, delReset: Date.now() });
}

// ═══════════════════════════════════════════════════════
// SECURITY HEADERS
// ═══════════════════════════════════════════════════════
app.use(function(req, res, next) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://i.ibb.co https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.tile.opentopomap.org https://server.arcgisonline.com; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.imgbb.com https://nominatim.openstreetmap.org https://api.groq.com https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://*.tile.opentopomap.org https://server.arcgisonline.com https://fonts.googleapis.com https://fonts.gstatic.com; " +
    "frame-src 'none'; object-src 'none'; base-uri 'self'");
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

app.set('trust proxy', 1);
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(function(req, res, next) {
  if (req.body) {
    for (var k in req.body) {
      if (typeof req.body[k] === 'string') {
        req.body[k] = req.body[k].replace(/\0/g, '');
        if (req.body[k].length > 50000) req.body[k] = req.body[k].substring(0, 50000);
      }
    }
  }
  next();
});

// ═══════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════
var hits = new Map();
function limit(max, ms) {
  return function(req, res, next) {
    var k = req.ip || 'x', now = Date.now(), e = hits.get(k);
    if (!e || now - e.t > ms) { hits.set(k, { c: 1, t: now }); return next(); }
    if (++e.c > max) return res.status(429).json({ error: 'Trop de requêtes' });
    next();
  };
}
setInterval(function() { var n = Date.now(); for (var [k, v] of hits) { if (n - v.t > 60000) hits.delete(k); } }, 30000);

// ═══════════════════════════════════════════════════════
// TRACKING MIDDLEWARE — track page views
// ═══════════════════════════════════════════════════════
app.use(function(req, res, next) {
  // Only track HTML page requests and the tracking pixel
  if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/js/') && !req.path.startsWith('/css/') && !req.path.startsWith('/icons/') && req.path !== '/sw.js' && req.path !== '/manifest.json') {
    analytics.track(req);
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '30d', etag: true, dotfiles: 'deny' }));

// ═══════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════
app.get('/api/config', limit(60, 60000), function(req, res) {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    imgbbApiKey: process.env.IMGBB_API_KEY || '',
    contactEmail: process.env.CONTACT_EMAIL || 'maxenceponche971@gmail.com',
    repoUrl: 'https://github.com/MaxLananas-debug/gwadloup',
    groqAvailable: GROQ_KEYS.length > 0
  });
});

app.get('/api/health', function(req, res) { res.json({ ok: true, groq: GROQ_KEYS.length, uptime: process.uptime() }); });

// ═══════════════════════════════════════════════════════
// ANALYTICS API
// ═══════════════════════════════════════════════════════
app.post('/api/analytics/track', limit(120, 60000), function(req, res) {
  var page = req.body.page || '/';
  var event = req.body.event;
  // Track with the real request info
  analytics.track(req);
  if (event) analytics.trackEvent(event);
  res.json({ ok: true });
});

app.post('/api/analytics/event', limit(120, 60000), function(req, res) {
  var event = req.body.event;
  if (event && typeof event === 'string' && event.length < 50) {
    analytics.trackEvent(event);
  }
  res.json({ ok: true });
});

app.get('/api/analytics', limit(30, 60000), function(req, res) {
  // Only admins should see this — verified client-side
  var days = parseInt(req.query.days) || 30;
  if (days > 365) days = 365;
  res.json(analytics.getStats(days));
});

// ═══════════════════════════════════════════════════════
// WIKI STATIC
// ═══════════════════════════════════════════════════════
app.get('/api/wiki-static', limit(30, 60000), function(req, res) {
  var dir = path.join(__dirname, 'wiki');
  if (!fs.existsSync(dir)) return res.json([]);
  res.json(fs.readdirSync(dir).filter(function(f) { return f.endsWith('.md') && !f.startsWith('.'); }).map(function(f) {
    return { slug: f.replace('.md', ''), title: f.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); }) };
  }));
});
app.get('/api/wiki-static/:page', limit(60, 60000), function(req, res) {
  var p = req.params.page.replace(/[^a-zA-Z0-9-_]/g, '');
  var f = path.join(__dirname, 'wiki', p + '.md');
  if (p && !p.startsWith('.') && fs.existsSync(f)) res.type('text/plain').send(fs.readFileSync(f, 'utf8'));
  else res.status(404).json({ error: 'Not found' });
});

// ═══════════════════════════════════════════════════════
// ANTI-FARM & MODERATION
// ═══════════════════════════════════════════════════════
app.post('/api/check-farm', limit(60, 60000), function(req, res) {
  if (!req.body.userId) return res.status(400).json({ error: 'Missing' });
  res.json(checkCooldown(req.body.userId));
});
app.post('/api/mark-delete', limit(30, 60000), function(req, res) {
  if (req.body.userId) markDelete(req.body.userId);
  res.json({ ok: true });
});

app.post('/api/moderate', limit(60, 60000), async function(req, res) {
  var title = req.body.title || '';
  var description = req.body.description || '';
  var context = req.body.context || '';
  var isWiki = context === 'wiki';
  var check = containsBadWords(title + ' ' + description);
  if (!check.found) return res.json({ flagged: false });

  var key = getGroqKey();
  if (!key) {
    var ct = title, cd = description;
    for (var i = 0; i < check.words.length; i++) {
      var w = check.words[i];
      if (w === '[insulte]') continue;
      var r = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      ct = ct.replace(r, '...'); cd = cd.replace(r, '...');
    }
    return res.json({ flagged: true, reformulated: true, cleaned: { title: ct, description: cd } });
  }

  var mdNote = isWiki ? '\n\nIMPORTANT: CONSERVE tout le formatage Markdown existant (##, -, **, *, etc).' : '';

  try {
    var ctrl = new AbortController();
    var to = setTimeout(function() { ctrl.abort(); }, 12000);
    var resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Tu es un filtre de modération pour "Gwadloup Alert", plateforme citoyenne Guadeloupe.\n\nRÈGLES:\n1. SUPPRIME noms de politiciens → "une personnalité publique"\n2. SUPPRIME insultes → reformule poliment\n3. CONSERVE le sens utile\n4. Ton NATUREL\n\nINTERDIT:\n- JAMAIS d\'excuse/explication\n- JAMAIS de refus\n- PAS de [censuré] ni ***' + mdNote + '\n\nRéponds UNIQUEMENT en JSON: {"title":"...","description":"..."}' },
          { role: 'user', content: 'Titre: ' + title.substring(0, 300) + '\nDescription: ' + description.substring(0, 5000) }
        ],
        temperature: 0.3,
        max_tokens: isWiki ? 2000 : 600
      }),
      signal: ctrl.signal
    });
    clearTimeout(to);
    if (!resp.ok) throw new Error();
    var data = await resp.json();
    var txt = data.choices[0].message.content.trim();
    if (txt.indexOf('```') !== -1) txt = txt.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    var s = txt.indexOf('{'), e = txt.lastIndexOf('}');
    if (s >= 0 && e > s) txt = txt.substring(s, e + 1);
    var parsed;
    try { parsed = JSON.parse(txt); } catch (pe) { throw pe; }
    var apology = ['je suis désolé','je ne peux pas','veuillez reformuler','je ne peux pas répondre','contenu inapproprié'];
    var combined = ((parsed.title || '') + ' ' + (parsed.description || '')).toLowerCase();
    for (var a = 0; a < apology.length; a++) { if (combined.indexOf(apology[a]) !== -1) throw new Error('apology'); }
    var recheck = containsBadWords((parsed.title || '') + ' ' + (parsed.description || ''));
    if (recheck.found) {
      var ct2 = parsed.title || '', cd2 = parsed.description || '';
      for (var i = 0; i < recheck.words.length; i++) {
        var w = recheck.words[i]; if (w === '[insulte]') continue;
        var r = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        ct2 = ct2.replace(r, '...'); cd2 = cd2.replace(r, '...');
      }
      return res.json({ flagged: true, reformulated: true, cleaned: { title: ct2, description: cd2 } });
    }
    return res.json({ flagged: true, reformulated: true, cleaned: { title: (parsed.title || 'Signalement').substring(0, 150), description: (parsed.description || 'Description').substring(0, 5000) } });
  } catch (err) {
    var ct = title, cd = description;
    for (var i = 0; i < check.words.length; i++) {
      var w = check.words[i]; if (w === '[insulte]') continue;
      var r = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      ct = ct.replace(r, '...'); cd = cd.replace(r, '...');
    }
    return res.json({ flagged: true, reformulated: true, cleaned: { title: ct, description: cd } });
  }
});

app.all('/api/*', function(req, res) { res.status(404).json({ error: 'Route inconnue' }); });
app.get('*', function(req, res) { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.use(function(err, req, res, next) { console.error(err); res.status(500).json({ error: 'Erreur serveur' }); });

// Save analytics on shutdown
process.on('SIGTERM', function() { analytics.save(); process.exit(0); });
process.on('SIGINT', function() { analytics.save(); process.exit(0); });

app.listen(PORT, function() { console.log('Gwadloup Alert v13 — port ' + PORT + ' — ' + GROQ_KEYS.length + ' Groq key(s) — Analytics ON'); });
