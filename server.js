require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { marked } = require('marked');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const GROQ_KEYS = (process.env.GROQ_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
let groqIdx = 0;
function getGroqKey() {
  if (!GROQ_KEYS.length) return null;
  return GROQ_KEYS[groqIdx++ % GROQ_KEYS.length];
}

let supabaseAdmin = null;
function initSupabaseAdmin() {
  var url = process.env.SUPABASE_URL;
  var key = process.env.SUPABASE_ANON_KEY;
  if (url && key) {
    supabaseAdmin = createClient(url, key);
    console.log('Supabase connected');
  }
}

// ═══════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════
const analytics = {
  buffer: [],
  bufferEvents: [],
  liveVisitors: new Map(),
  peakConcurrent: 0,

  init: function() {
    initSupabaseAdmin();
    var self = this;
    setInterval(function() { self.flush(); }, 15000);
    setInterval(function() {
      var now = Date.now();
      for (var [k, v] of self.liveVisitors) {
        if (now - v.lastSeen > 120000) self.liveVisitors.delete(k);
      }
    }, 60000);
    setInterval(function() { self.aggregateDaily(); }, 600000);
  },

  track: function(data) {
    this.buffer.push({
      session_id: data.sessionId || 'unknown',
      page: data.page || '/',
      referrer: data.referrer || null,
      device: data.device || 'desktop',
      browser: data.browser || 'Autre',
      country: data.country || 'Inconnu',
      is_new_visitor: data.isNew !== false
    });
    this.liveVisitors.set(data.sessionId, {
      lastSeen: Date.now(),
      page: data.page,
      device: data.device,
      browser: data.browser,
      country: data.country,
      referrer: data.referrer
    });
    if (this.liveVisitors.size > this.peakConcurrent) {
      this.peakConcurrent = this.liveVisitors.size;
    }
  },

  trackEvent: function(name, metadata) {
    this.bufferEvents.push({ event_name: name, metadata: metadata || null });
  },

  flush: async function() {
    if (!supabaseAdmin) return;
    if (this.buffer.length > 0) {
      var batch = this.buffer.splice(0, this.buffer.length);
      try { await supabaseAdmin.from('analytics_events').insert(batch); }
      catch(e) { this.buffer = batch.concat(this.buffer); }
    }
    if (this.bufferEvents.length > 0) {
      var batchE = this.bufferEvents.splice(0, this.bufferEvents.length);
      try { await supabaseAdmin.from('analytics_custom_events').insert(batchE); }
      catch(e) { this.bufferEvents = batchE.concat(this.bufferEvents); }
    }
  },

  aggregateDaily: async function() {
    if (!supabaseAdmin) return;
    var today = new Date().toISOString().split('T')[0];
    try {
      var result = await supabaseAdmin.from('analytics_events').select('*')
        .gte('created_at', today + 'T00:00:00')
        .lt('created_at', today + 'T23:59:59.999');
      if (!result.data) return;
      var events = result.data;
      var sessions = new Set(), newSessions = new Set();
      var pages = {}, referrers = {}, browsers = {}, countries = {}, hourly = {};
      var mobile = 0, desktop = 0, tablet = 0;
      for (var i = 0; i < events.length; i++) {
        var ev = events[i];
        sessions.add(ev.session_id);
        if (ev.is_new_visitor) newSessions.add(ev.session_id);
        pages[ev.page] = (pages[ev.page] || 0) + 1;
        if (ev.referrer) referrers[ev.referrer] = (referrers[ev.referrer] || 0) + 1;
        browsers[ev.browser] = (browsers[ev.browser] || 0) + 1;
        countries[ev.country] = (countries[ev.country] || 0) + 1;
        var h = new Date(ev.created_at).getHours().toString();
        hourly[h] = (hourly[h] || 0) + 1;
        if (ev.device === 'mobile') mobile++;
        else if (ev.device === 'tablet') tablet++;
        else desktop++;
      }
      var topN = function(obj, n) {
        return Object.entries(obj)
          .sort(function(a, b) { return b[1] - a[1]; })
          .slice(0, n)
          .reduce(function(acc, cur) { acc[cur[0]] = cur[1]; return acc; }, {});
      };
      await supabaseAdmin.from('analytics_daily').upsert({
        date: today,
        pageviews: events.length,
        visitors: sessions.size,
        new_visitors: newSessions.size,
        mobile: mobile,
        desktop: desktop,
        tablet: tablet,
        top_pages: topN(pages, 20),
        top_referrers: topN(referrers, 15),
        top_browsers: topN(browsers, 10),
        top_countries: topN(countries, 15),
        hourly: hourly,
        updated_at: new Date().toISOString()
      }, { onConflict: 'date' });
    } catch(e) {}
  },

  getStats: async function(days) {
    if (!supabaseAdmin) return { error: 'No database' };
    days = days || 30;
    try {
      var now = new Date();
      var startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);
      var startStr = startDate.toISOString().split('T')[0];
      var todayStr = now.toISOString().split('T')[0];
      var dailyResult = await supabaseAdmin.from('analytics_daily').select('*')
        .gte('date', startStr).order('date', { ascending: true });
      var daily = dailyResult.data || [];
      var totalPV = 0, totalV = 0, totalMobile = 0, totalDesktop = 0, totalTablet = 0;
      var allPages = {}, allReferrers = {}, allBrowsers = {}, allCountries = {}, allHourly = {};
      var merge = function(t, s) { for (var k in s) { t[k] = (t[k] || 0) + s[k]; } };
      for (var i = 0; i < daily.length; i++) {
        var d = daily[i];
        totalPV += d.pageviews || 0;
        totalV += d.visitors || 0;
        totalMobile += d.mobile || 0;
        totalDesktop += d.desktop || 0;
        totalTablet += d.tablet || 0;
        merge(allPages, d.top_pages || {});
        merge(allReferrers, d.top_referrers || {});
        merge(allBrowsers, d.top_browsers || {});
        merge(allCountries, d.top_countries || {});
        merge(allHourly, d.hourly || {});
      }
      var sortObj = function(obj, limit) {
        return Object.entries(obj)
          .sort(function(a, b) { return b[1] - a[1]; })
          .slice(0, limit)
          .map(function(e) { return { name: e[0], count: e[1] }; });
      };
      return {
        period: days + ' jours',
        periodPageviews: totalPV,
        periodVisitors: totalV,
        todayPageviews: (daily.find(function(d) { return d.date === todayStr; }) || {}).pageviews || 0,
        currentConcurrent: this.liveVisitors.size,
        peakConcurrent: this.peakConcurrent,
        daily: daily.map(function(d) { return { date: d.date, pageviews: d.pageviews, visitors: d.visitors }; }),
        topPages: sortObj(allPages, 20),
        topReferrers: sortObj(allReferrers, 15),
        browsers: sortObj(allBrowsers, 10),
        countries: sortObj(allCountries, 15),
        hourly: allHourly,
        devices: { mobile: totalMobile, desktop: totalDesktop, tablet: totalTablet }
      };
    } catch(e) { return { error: e.message }; }
  }
};

// ═══════════════════════════════════════════════════════
// TRACKING HELPERS
// ═══════════════════════════════════════════════════════
function parseTrackingData(req) {
  var ua = req.headers['user-agent'] || '';
  var ref = req.headers['referer'] || '';
  var lang = req.headers['accept-language'] || '';
  var ip = req.ip || 'unknown';
  var sessionId = hashStr(ip + ua.substring(0, 80) + new Date().toISOString().split('T')[0]);
  var referrer = null;
  if (ref) {
    try {
      var rh = new URL(ref).hostname.replace('www.', '');
      if (rh && rh !== req.hostname && rh !== 'localhost') referrer = rh;
    } catch(e) {}
  }
  var device = /iPad|tablet|Tab/i.test(ua) ? 'tablet' : /Mobile|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';
  var browser = /Edg/i.test(ua) ? 'Edge' : /OPR|Opera/i.test(ua) ? 'Opera' : /Firefox/i.test(ua) ? 'Firefox' :
    /Safari/i.test(ua) && !/Chrome/i.test(ua) ? 'Safari' : /Chrome/i.test(ua) ? 'Chrome' : 'Autre';
  var country = 'Inconnu';
  if (lang) {
    var p = lang.split(',')[0].split('-');
    var r = p.length > 1 ? p[1].toUpperCase() : '';
    var m = { FR: 'France', GP: 'Guadeloupe', MQ: 'Martinique', US: 'États-Unis', GB: 'Royaume-Uni', CA: 'Canada', BE: 'Belgique', CH: 'Suisse', HT: 'Haïti' };
    country = m[r] || r || 'Inconnu';
  }
  return { sessionId: sessionId, referrer: referrer, device: device, browser: browser, country: country };
}

function hashStr(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h = h & h; }
  return 'v' + Math.abs(h).toString(36);
}

// ═══════════════════════════════════════════════════════
// MODERATION
// ═══════════════════════════════════════════════════════
const BAD_WORDS = ['putain','merde','connard','connasse','enculé','nique','niquer','salope','bordel','bite','couille','chier','pétasse','enfoiré','bâtard','fils de pute','fdp','ntm','tg','ta gueule','pd','pédé','négro','sale race','nazi','hitler','pédophile','idiot','imbécile','crétin','débile','abruti','con ','conne','bouffon','taré','demeuré','gogol','stupide','bête'];
const ALWAYS_FLAG = ['macron','melenchon','le pen','zemmour','sarkozy','putain','merde','connard','enculé','nique','fdp','ntm','nazi','hitler','pédophile','idiot','imbécile','crétin','débile','abruti','bouffon','taré','gogol','stupide'];
const SOFT_INSULTS = ['idiot','stupide','bête','nul','ridicule','minable','incompétent'];

function containsBadWords(text) {
  if (!text) return { found: false, words: [], severity: 'none' };
  var lower = text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-\.]/g, ' ').replace(/\s+/g, ' ');
  var found = [], severity = 'none';
  for (var i = 0; i < ALWAYS_FLAG.length; i++) {
    var nw = ALWAYS_FLAG[i].normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(nw)) {
      found.push(ALWAYS_FLAG[i]);
      if (SOFT_INSULTS.indexOf(ALWAYS_FLAG[i]) === -1) severity = 'hard';
      else if (severity !== 'hard') severity = 'soft';
    }
  }
  for (var j = 0; j < BAD_WORDS.length; j++) {
    if (found.indexOf(BAD_WORDS[j]) !== -1) continue;
    var nw2 = BAD_WORDS[j].normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (new RegExp('(?:^|\\W)' + nw2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|\\W)', 'i').test(' ' + lower + ' ')) {
      found.push(BAD_WORDS[j]);
      if (SOFT_INSULTS.indexOf(BAD_WORDS[j]) === -1) severity = 'hard';
      else if (severity !== 'hard') severity = 'soft';
    }
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
  if (d.delCount >= 5 && now - d.last < 600000) return { allowed: false, reason: 'Trop de suppressions' };
  if (now - d.last < 8000) return { allowed: false, reason: 'Attendez quelques secondes' };
  d.last = now;
  return { allowed: true };
}
function markDelete(userId) {
  var d = cooldowns.get(userId);
  if (d) d.delCount++;
  else cooldowns.set(userId, { last: Date.now(), delCount: 1, delReset: Date.now() });
}

// ═══════════════════════════════════════════════════════
// SECURITY MIDDLEWARE
// ═══════════════════════════════════════════════════════
app.use(function(req, res, next) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://i.ibb.co https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.tile.opentopomap.org https://server.arcgisonline.com; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.imgbb.com https://nominatim.openstreetmap.org https://api.groq.com https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://*.tile.opentopomap.org https://server.arcgisonline.com https://fonts.googleapis.com https://fonts.gstatic.com; " +
    "frame-src 'none'; object-src 'none'; base-uri 'self'"
  );
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

app.set('trust proxy', 1);
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '2mb' }));

// ═══════════════════════════════════════════════════════
// RATE LIMITER
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
setInterval(function() {
  var n = Date.now();
  for (var [k, v] of hits) { if (n - v.t > 60000) hits.delete(k); }
}, 30000);

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '30d', etag: true, dotfiles: 'deny' }));

// ═══════════════════════════════════════════════════════
// CATEGORY LIST FOR AI SEARCH
// ═══════════════════════════════════════════════════════
const CATEGORIES_TEXT = 'pothole=Nid de poule (trous dans la route), dangerous_road=Route dangereuse, damaged_sign=Signalisation abîmée, missing_marking=Marquage effacé, speed_bump_needed=Ralentisseur nécessaire, abandoned_vehicle=Véhicule abandonné, abandoned_boat=Bateau abandonné, illegal_dump=Dépôt sauvage (déchets abandonnés), beach_pollution=Pollution de plage, river_pollution=Pollution de rivière, overflowing_bin=Poubelle débordante, broken_light=Éclairage défaillant, exposed_cable=Câble électrique exposé, water_leak=Fuite d\'eau, flooding=Inondation, sewer_issue=Problème assainissement/égout, stagnant_water=Eau stagnante/moustiques, vegetation=Végétation envahissante, fallen_tree=Arbre tombé, invasive_species=Espèce invasive, damaged_building=Bâtiment endommagé, abandoned_building=Bâtiment abandonné, damaged_sidewalk=Trottoir abîmé, missing_railing=Garde-fou manquant, dangerous_area=Zone dangereuse, missing_crosswalk=Passage piéton manquant, school_zone_issue=Problème zone scolaire, noise=Nuisance sonore, stray_animals=Animaux errants, mosquito_breeding=Foyer à moustiques, other=Autre';

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

app.get('/api/health', function(req, res) {
  res.json({ ok: true, groq: GROQ_KEYS.length, uptime: Math.round(process.uptime()), live: analytics.liveVisitors.size });
});

// ═══════════════ MARKDOWN RENDER ═══════════════
app.post('/api/render-markdown', limit(60, 60000), function(req, res) {
  var md = req.body.md || '';
  if (!md || typeof md !== 'string') return res.status(400).json({ error: 'Missing md' });
  try {
    var html = marked(md);
    res.json({ html: html });
  } catch(e) {
    res.status(500).json({ error: 'Render error' });
  }
});

// ═══════════════ ANALYTICS ═══════════════
app.post('/api/analytics/track', limit(180, 60000), function(req, res) {
  var page = req.body.page || '/';
  if (page.startsWith('/api/') || page.startsWith('/js/') || page.startsWith('/css/')) return res.json({ ok: true });
  var td = parseTrackingData(req);
  td.page = page;
  td.isNew = true;
  analytics.track(td);
  res.json({ ok: true });
});

app.post('/api/analytics/event', limit(120, 60000), function(req, res) {
  if (req.body.event && typeof req.body.event === 'string' && req.body.event.length < 100)
    analytics.trackEvent(req.body.event, req.body.metadata || null);
  res.json({ ok: true });
});

app.get('/api/analytics', limit(30, 60000), async function(req, res) {
  var days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30));
  res.json(await analytics.getStats(days));
});

// ═══════════════ WIKI ═══════════════
app.get('/api/wiki-static', limit(30, 60000), function(req, res) {
  var dir = path.join(__dirname, 'wiki');
  if (!fs.existsSync(dir)) return res.json([]);
  res.json(
    fs.readdirSync(dir)
      .filter(function(f) { return f.endsWith('.md'); })
      .map(function(f) {
        return {
          slug: f.replace('.md', ''),
          title: f.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); })
        };
      })
  );
});

app.get('/api/wiki-static/:page', limit(60, 60000), function(req, res) {
  var p = req.params.page.replace(/[^a-zA-Z0-9-_]/g, '');
  var f = path.join(__dirname, 'wiki', p + '.md');
  if (p && fs.existsSync(f)) res.type('text/plain').send(fs.readFileSync(f, 'utf8'));
  else res.status(404).json({ error: 'Not found' });
});

// ═══════════════ MODERATION ROUTES ═══════════════
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
  var check = containsBadWords(title + ' ' + description);
  if (!check.found) return res.json({ flagged: false });
  var key = getGroqKey();
  if (!key) {
    var ct = title, cd = description;
    for (var i = 0; i < check.words.length; i++) {
      var w = check.words[i];
      var r = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      ct = ct.replace(r, '...');
      cd = cd.replace(r, '...');
    }
    return res.json({ flagged: true, reformulated: true, cleaned: { title: ct, description: cd } });
  }
  var mdNote = context === 'wiki' ? '\nCONSERVE le Markdown.' : '';
  try {
    var ctrl = new AbortController();
    var to = setTimeout(function() { ctrl.abort(); }, 12000);
    var resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Filtre modération Gwadloup Alert. Supprime politiciens→"personnalité publique", insultes→reformule. Ton naturel. JSON only: {"title":"...","description":"..."}' + mdNote },
          { role: 'user', content: 'Titre: ' + title.substring(0, 300) + '\nDescription: ' + description.substring(0, 5000) }
        ],
        temperature: 0.3,
        max_tokens: context === 'wiki' ? 2000 : 600
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
    var parsed = JSON.parse(txt);
    return res.json({
      flagged: true, reformulated: true,
      cleaned: {
        title: (parsed.title || 'Signalement').substring(0, 150),
        description: (parsed.description || 'Description').substring(0, 5000)
      }
    });
  } catch(err) {
    var ct2 = title, cd2 = description;
    for (var j = 0; j < check.words.length; j++) {
      var w2 = check.words[j];
      var r2 = new RegExp(w2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      ct2 = ct2.replace(r2, '...');
      cd2 = cd2.replace(r2, '...');
    }
    return res.json({ flagged: true, reformulated: true, cleaned: { title: ct2, description: cd2 } });
  }
});

// ═══════════════ AI CATEGORY SEARCH ═══════════════
app.post('/api/ai-category', limit(30, 60000), async function(req, res) {
  var query = req.body.query;
  if (!query || query.length < 3) return res.json({ category: null });
  var key = getGroqKey();
  if (!key) return res.json({ category: null });
  try {
    var ctrl = new AbortController();
    var to = setTimeout(function() { ctrl.abort(); }, 8000);
    var resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Tu es un assistant de catégorisation pour Gwadloup Alert (signalements Guadeloupe).\n\nCatégories disponibles:\n' + CATEGORIES_TEXT + '\n\nL\'utilisateur décrit un problème. Réponds UNIQUEMENT avec le code de la catégorie la plus pertinente. Exemple: "pothole" ou "illegal_dump". Si aucune ne correspond, réponds "other". UN SEUL MOT, pas de phrase.' },
          { role: 'user', content: query.substring(0, 200) }
        ],
        temperature: 0.1,
        max_tokens: 30
      }),
      signal: ctrl.signal
    });
    clearTimeout(to);
    if (!resp.ok) throw new Error();
    var data = await resp.json();
    var answer = data.choices[0].message.content.trim().toLowerCase().replace(/[^a-z_]/g, '');
    var validCats = CATEGORIES_TEXT.split(',').map(function(c) { return c.split('=')[0].trim(); });
    if (validCats.indexOf(answer) !== -1) return res.json({ category: answer });
    return res.json({ category: 'other' });
  } catch(e) {
    return res.json({ category: null });
  }
});

// ═══════════════ ANONYMOUS REPORT ═══════════════
app.post('/api/report-anonymous', limit(10, 60000), async function(req, res) {
  var body = req.body;
  if (!body.title || !body.description || !body.latitude || !body.longitude || !body.category)
    return res.status(400).json({ error: 'Champs manquants' });
  if (body.title.length < 5 || body.description.length < 10)
    return res.status(400).json({ error: 'Contenu trop court' });
  var check = containsBadWords(body.title + ' ' + body.description);
  if (check.found && check.severity === 'hard')
    return res.status(400).json({ error: 'Contenu inapproprié' });
  var title = body.title.substring(0, 150);
  var description = body.description.substring(0, 2000);
  if (check.found) {
    for (var i = 0; i < check.words.length; i++) {
      var r = new RegExp(check.words[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      title = title.replace(r, '...');
      description = description.replace(r, '...');
    }
  }
  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Database unavailable' });
    var result = await supabaseAdmin.from('reports').insert({
      category: body.category,
      title: title,
      description: description,
      latitude: body.latitude,
      longitude: body.longitude,
      address: body.address || null,
      commune: body.commune || null,
      images: [],
      priority: body.priority || 'medium',
      status: 'pending',
      upvotes: 0,
      user_id: null
    }).select().single();
    if (result.error) return res.status(400).json({ error: result.error.message });
    analytics.trackEvent('anonymous_report');
    res.json({ ok: true, id: result.data.id });
  } catch(e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════ NOTIFICATIONS ═══════════════
app.post('/api/notify', limit(20, 60000), async function(req, res) {
  var reportId = req.body.reportId;
  var type = req.body.type;
  if (!reportId || !type) return res.json({ ok: false });
  try {
    if (!supabaseAdmin) return res.json({ ok: false });
    var report = await supabaseAdmin.from('reports').select('title, user_id').eq('id', reportId).single();
    if (!report.data || !report.data.user_id) return res.json({ ok: false });
    analytics.trackEvent('notification_' + type, { reportId: reportId });
    res.json({ ok: true, tracked: true });
  } catch(e) {
    res.json({ ok: false });
  }
});

// ═══════════════ CATCH-ALL ═══════════════
app.all('/api/*', function(req, res) { res.status(404).json({ error: 'Route inconnue' }); });
app.get('*', function(req, res) { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.use(function(err, req, res, next) { console.error(err); res.status(500).json({ error: 'Erreur serveur' }); });

// ═══════════════ GRACEFUL SHUTDOWN ═══════════════
process.on('SIGTERM', function() { analytics.flush().then(function() { process.exit(0); }); });
process.on('SIGINT', function() { analytics.flush().then(function() { process.exit(0); }); });

analytics.init();
app.listen(PORT, function() {
  console.log('Gwadloup Alert v16 — port ' + PORT + ' — ' + GROQ_KEYS.length + ' Groq — Anonymous ON — AI Category ON');
});
