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
// ANALYTICS — In-memory cache + Supabase persistence
// ═══════════════════════════════════════════════════════
const { createClient } = require('@supabase/supabase-js');
let supabaseAdmin = null;

function initSupabaseAdmin() {
  var url = process.env.SUPABASE_URL;
  var key = process.env.SUPABASE_ANON_KEY;
  if (url && key) {
    supabaseAdmin = createClient(url, key);
    console.log('Supabase analytics connected');
  }
}

const analytics = {
  // In-memory buffer for batch inserts (performance)
  buffer: [],
  bufferEvents: [],
  flushInterval: null,
  liveVisitors: new Map(), // sessionId -> { lastSeen, page, device }
  peakConcurrent: 0,

  init: function() {
    initSupabaseAdmin();
    var self = this;

    // Flush buffer to Supabase every 15 seconds
    this.flushInterval = setInterval(function() { self.flush(); }, 15000);

    // Clean stale live visitors every 60s
    setInterval(function() {
      var now = Date.now();
      for (var [k, v] of self.liveVisitors) {
        if (now - v.lastSeen > 120000) self.liveVisitors.delete(k);
      }
    }, 60000);

    // Aggregate daily stats every 10 minutes
    setInterval(function() { self.aggregateDaily(); }, 600000);

    // Load peak from DB on startup
    this.loadPeak();
  },

  loadPeak: async function() {
    if (!supabaseAdmin) return;
    try {
      // We store peak in a simple way — check current daily record
      var today = new Date().toISOString().split('T')[0];
      var result = await supabaseAdmin.from('analytics_daily').select('*').eq('date', today).maybeSingle();
      // Peak is tracked in memory only, reset per server instance
    } catch(e) {}
  },

  track: function(data) {
    // data: { sessionId, page, referrer, device, browser, country, isNew }
    this.buffer.push({
      session_id: data.sessionId || 'unknown',
      page: data.page || '/',
      referrer: data.referrer || null,
      device: data.device || 'desktop',
      browser: data.browser || 'Autre',
      country: data.country || 'Inconnu',
      is_new_visitor: data.isNew !== false
    });

    // Update live visitors
    this.liveVisitors.set(data.sessionId, {
      lastSeen: Date.now(),
      page: data.page,
      device: data.device,
      browser: data.browser,
      country: data.country,
      referrer: data.referrer
    });

    var concurrent = this.liveVisitors.size;
    if (concurrent > this.peakConcurrent) this.peakConcurrent = concurrent;
  },

  trackEvent: function(name, metadata) {
    this.bufferEvents.push({
      event_name: name,
      metadata: metadata || null
    });
  },

  flush: async function() {
    if (!supabaseAdmin) return;

    // Flush pageview events
    if (this.buffer.length > 0) {
      var batch = this.buffer.splice(0, this.buffer.length);
      try {
        await supabaseAdmin.from('analytics_events').insert(batch);
      } catch(e) {
        console.warn('Analytics flush error:', e.message);
        // Put back in buffer if failed
        this.buffer = batch.concat(this.buffer);
      }
    }

    // Flush custom events
    if (this.bufferEvents.length > 0) {
      var batchE = this.bufferEvents.splice(0, this.bufferEvents.length);
      try {
        await supabaseAdmin.from('analytics_custom_events').insert(batchE);
      } catch(e) {
        console.warn('Events flush error:', e.message);
        this.bufferEvents = batchE.concat(this.bufferEvents);
      }
    }
  },

  aggregateDaily: async function() {
    if (!supabaseAdmin) return;
    var today = new Date().toISOString().split('T')[0];

    try {
      // Get today's raw events
      var result = await supabaseAdmin
        .from('analytics_events')
        .select('*')
        .gte('created_at', today + 'T00:00:00')
        .lt('created_at', today + 'T23:59:59.999');

      if (!result.data) return;
      var events = result.data;

      var sessions = new Set();
      var newSessions = new Set();
      var pages = {};
      var referrers = {};
      var browsers = {};
      var countries = {};
      var hourly = {};
      var mobile = 0, desktop = 0, tablet = 0;

      for (var i = 0; i < events.length; i++) {
        var ev = events[i];
        sessions.add(ev.session_id);
        if (ev.is_new_visitor) newSessions.add(ev.session_id);

        // Pages
        if (!pages[ev.page]) pages[ev.page] = 0;
        pages[ev.page]++;

        // Referrers
        if (ev.referrer) {
          if (!referrers[ev.referrer]) referrers[ev.referrer] = 0;
          referrers[ev.referrer]++;
        }

        // Browsers
        if (!browsers[ev.browser]) browsers[ev.browser] = 0;
        browsers[ev.browser]++;

        // Countries
        if (!countries[ev.country]) countries[ev.country] = 0;
        countries[ev.country]++;

        // Hourly
        var h = new Date(ev.created_at).getHours().toString();
        if (!hourly[h]) hourly[h] = 0;
        hourly[h]++;

        // Devices
        if (ev.device === 'mobile') mobile++;
        else if (ev.device === 'tablet') tablet++;
        else desktop++;
      }

      // Sort and limit top entries
      var topPages = this._topN(pages, 20);
      var topReferrers = this._topN(referrers, 15);
      var topBrowsers = this._topN(browsers, 10);
      var topCountries = this._topN(countries, 15);

      // Upsert daily record
      var dailyData = {
        date: today,
        pageviews: events.length,
        visitors: sessions.size,
        new_visitors: newSessions.size,
        mobile: mobile,
        desktop: desktop,
        tablet: tablet,
        top_pages: topPages,
        top_referrers: topReferrers,
        top_browsers: topBrowsers,
        top_countries: topCountries,
        hourly: hourly,
        updated_at: new Date().toISOString()
      };

      await supabaseAdmin.from('analytics_daily').upsert(dailyData, { onConflict: 'date' });
    } catch(e) {
      console.warn('Aggregate error:', e.message);
    }
  },

  _topN: function(obj, n) {
    return Object.entries(obj)
      .sort(function(a, b) { return b[1] - a[1]; })
      .slice(0, n)
      .reduce(function(acc, cur) { acc[cur[0]] = cur[1]; return acc; }, {});
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

      // Get daily aggregates
      var dailyResult = await supabaseAdmin
        .from('analytics_daily')
        .select('*')
        .gte('date', startStr)
        .order('date', { ascending: true });

      var daily = dailyResult.data || [];

      // Calculate totals
      var totalPageviews = 0, totalVisitors = 0, totalNewVisitors = 0;
      var totalMobile = 0, totalDesktop = 0, totalTablet = 0;
      var allPages = {}, allReferrers = {}, allBrowsers = {}, allCountries = {};
      var allHourly = {};

      for (var i = 0; i < daily.length; i++) {
        var d = daily[i];
        totalPageviews += d.pageviews || 0;
        totalVisitors += d.visitors || 0;
        totalNewVisitors += d.new_visitors || 0;
        totalMobile += d.mobile || 0;
        totalDesktop += d.desktop || 0;
        totalTablet += d.tablet || 0;

        this._mergeObj(allPages, d.top_pages || {});
        this._mergeObj(allReferrers, d.top_referrers || {});
        this._mergeObj(allBrowsers, d.top_browsers || {});
        this._mergeObj(allCountries, d.top_countries || {});
        this._mergeObj(allHourly, d.hourly || {});
      }

      // Today's live data (from buffer + recent DB)
      var todayData = daily.find(function(d) { return d.date === todayStr; });
      var todayPV = todayData ? todayData.pageviews : 0;
      var todayV = todayData ? todayData.visitors : 0;

      // Add buffered (not yet flushed) data for today
      todayPV += this.buffer.length;

      // Get recent custom events
      var eventsResult = await supabaseAdmin
        .from('analytics_custom_events')
        .select('event_name')
        .gte('created_at', startStr + 'T00:00:00');

      var eventCounts = {};
      if (eventsResult.data) {
        for (var i = 0; i < eventsResult.data.length; i++) {
          var name = eventsResult.data[i].event_name;
          if (!eventCounts[name]) eventCounts[name] = 0;
          eventCounts[name]++;
        }
      }

      // All-time totals
      var allTimeResult = await supabaseAdmin
        .from('analytics_daily')
        .select('pageviews, visitors, new_visitors')
        .order('date', { ascending: true });

      var allTimePV = 0, allTimeV = 0, allTimeNew = 0;
      if (allTimeResult.data) {
        for (var i = 0; i < allTimeResult.data.length; i++) {
          allTimePV += allTimeResult.data[i].pageviews || 0;
          allTimeV += allTimeResult.data[i].visitors || 0;
          allTimeNew += allTimeResult.data[i].new_visitors || 0;
        }
      }

      // Build live visitors list
      var liveList = [];
      for (var [sid, info] of this.liveVisitors) {
        liveList.push({
          time: new Date(info.lastSeen).toISOString(),
          page: info.page,
          device: info.device,
          browser: info.browser,
          country: info.country,
          ref: info.referrer || ''
        });
      }
      liveList.sort(function(a, b) { return new Date(b.time) - new Date(a.time); });

      // Calculate averages
      var avgDailyPV = daily.length > 0 ? Math.round(totalPageviews / daily.length) : 0;
      var avgDailyV = daily.length > 0 ? Math.round(totalVisitors / daily.length) : 0;
      var bounceEstimate = totalVisitors > 0 ? Math.round(Math.max(20, 100 - (totalPageviews / totalVisitors - 1) * 30)) : 0;
      var avgPagesPerVisit = totalVisitors > 0 ? (totalPageviews / totalVisitors).toFixed(1) : '0';

      // Best day
      var bestDay = null, bestDayPV = 0;
      for (var i = 0; i < daily.length; i++) {
        if (daily[i].pageviews > bestDayPV) {
          bestDayPV = daily[i].pageviews;
          bestDay = daily[i].date;
        }
      }

      // Growth (compare last 7 days vs previous 7 days)
      var last7pv = 0, prev7pv = 0;
      for (var i = 0; i < daily.length; i++) {
        var dayDiff = Math.floor((now - new Date(daily[i].date)) / 86400000);
        if (dayDiff < 7) last7pv += daily[i].pageviews || 0;
        else if (dayDiff < 14) prev7pv += daily[i].pageviews || 0;
      }
      var growthPct = prev7pv > 0 ? Math.round(((last7pv - prev7pv) / prev7pv) * 100) : (last7pv > 0 ? 100 : 0);

      return {
        period: days + ' jours',

        // Totals
        allTimePageviews: allTimePV + this.buffer.length,
        allTimeVisitors: allTimeV,
        allTimeNewVisitors: allTimeNew,
        periodPageviews: totalPageviews,
        periodVisitors: totalVisitors,

        // Today
        todayPageviews: todayPV,
        todayVisitors: todayV,

        // Live
        currentConcurrent: this.liveVisitors.size,
        peakConcurrent: this.peakConcurrent,

        // Averages
        avgDailyPageviews: avgDailyPV,
        avgDailyVisitors: avgDailyV,
        avgPagesPerVisit: avgPagesPerVisit,
        bounceRate: bounceEstimate + '%',

        // Growth
        growthPercent: growthPct,
        last7daysPageviews: last7pv,

        // Best
        bestDay: bestDay,
        bestDayPageviews: bestDayPV,

        // Daily breakdown
        daily: daily.map(function(d) {
          return { date: d.date, pageviews: d.pageviews, visitors: d.visitors, newVisitors: d.new_visitors || 0 };
        }),

        // Tops
        topPages: this._sortObj(allPages, 20),
        topReferrers: this._sortObj(allReferrers, 15),
        browsers: this._sortObj(allBrowsers, 10),
        countries: this._sortObj(allCountries, 15),
        hourly: allHourly,

        // Devices
        devices: { mobile: totalMobile, desktop: totalDesktop, tablet: totalTablet },

        // Events
        events: eventCounts,

        // Live
        live: liveList.slice(0, 30)
      };
    } catch(e) {
      console.error('getStats error:', e);
      return { error: e.message };
    }
  },

  _mergeObj: function(target, source) {
    for (var k in source) {
      if (!target[k]) target[k] = 0;
      target[k] += source[k];
    }
  },

  _sortObj: function(obj, limit) {
    return Object.entries(obj)
      .sort(function(a, b) { return b[1] - a[1]; })
      .slice(0, limit)
      .map(function(e) { return { name: e[0], count: e[1] }; });
  }
};

// ═══════════════════════════════════════════════════════
// TRACKING HELPERS
// ═══════════════════════════════════════════════════════
function parseTrackingData(req) {
  var ua = req.headers['user-agent'] || '';
  var ref = req.headers['referer'] || req.headers['referrer'] || '';
  var lang = req.headers['accept-language'] || '';
  var ip = req.ip || req.connection.remoteAddress || 'unknown';

  // Session ID: hash of IP + UA (privacy-friendly, no cookies)
  var sessionId = hashStr(ip + ua.substring(0, 80) + new Date().toISOString().split('T')[0]);

  // Clean referrer — remove self-referrals
  var referrer = null;
  if (ref) {
    try {
      var refUrl = new URL(ref);
      var refHost = refUrl.hostname.replace('www.', '');
      if (refHost && refHost !== 'gwadloup.onrender.com' && refHost !== 'localhost' && refHost !== req.hostname) {
        referrer = refHost;
      }
    } catch(e) {}
  }

  // Device
  var device = 'desktop';
  if (/iPad|tablet|Tab/i.test(ua)) device = 'tablet';
  else if (/Mobile|Android|iPhone|iPod/i.test(ua)) device = 'mobile';

  // Browser
  var browser = 'Autre';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR|Opera/i.test(ua)) browser = 'Opera';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Chrome/i.test(ua)) browser = 'Chrome';

  // Country from Accept-Language
  var country = 'Inconnu';
  if (lang) {
    var primary = lang.split(',')[0].trim();
    var parts = primary.split('-');
    var region = parts.length > 1 ? parts[1].toUpperCase() : '';
    var countryMap = {
      FR: 'France', GP: 'Guadeloupe', MQ: 'Martinique', GF: 'Guyane', RE: 'Réunion',
      US: 'États-Unis', GB: 'Royaume-Uni', CA: 'Canada', BE: 'Belgique', CH: 'Suisse',
      HT: 'Haïti', SN: 'Sénégal', CI: "Côte d'Ivoire", CM: 'Cameroun',
      DE: 'Allemagne', ES: 'Espagne', IT: 'Italie', BR: 'Brésil', PT: 'Portugal',
      NL: 'Pays-Bas', MA: 'Maroc', DZ: 'Algérie', TN: 'Tunisie'
    };
    country = countryMap[region] || (region || 'Inconnu');
  }

  return { sessionId: sessionId, referrer: referrer, device: device, browser: browser, country: country };
}

function hashStr(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash = hash & hash;
  }
  return 'v' + Math.abs(hash).toString(36);
}

// Pages to EXCLUDE from tracking
var EXCLUDED_PATHS = ['/api/', '/js/', '/css/', '/icons/', '/sw.js', '/manifest.json', '/favicon.ico'];

function shouldTrack(path) {
  for (var i = 0; i < EXCLUDED_PATHS.length; i++) {
    if (path.startsWith(EXCLUDED_PATHS[i]) || path === EXCLUDED_PATHS[i]) return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════
// MODERATION
// ═══════════════════════════════════════════════════════
const BAD_WORDS = ['putain','merde','connard','connasse','enculé','enculer','nique','niquer','salope','salaud','bordel','foutre','bite','couille','chier','pétasse','enfoiré','bâtard','batard','fils de pute','fdp','ntm','tg','ta gueule','pd','pédé','gouine','négro','negro','sale race','sous race','va mourir','je vais te tuer','nazi','hitler','terroriste','pédophile','pedophile','koukoune','manman ou','ti kal','idiot','idiote','imbécile','imbecile','crétin','cretin','débile','debile','abruti','abrutie','con ','conne','ducon','bouffon','bouffonne','taré','tare','tarée','demeuré','demeure','gogol','mongol','enflure','ordure','pourriture','raclure','morveux','branleur','trouduc','trou du cul','naze','nazes','tocard','tocarde','pov type','pauvre type','pauvre con','gros con','sale con','ferme ta gueule','ferme la','va te faire','casse toi','dégage','degage','la ferme','stupide','bête','bete'];
const ALWAYS_FLAG = ['macron','melenchon','mélenchon','le pen','zemmour','sarkozy','hollande','darmanin','borne','attal','bardella','putain','merde','connard','enculé','nique','fdp','ntm','nazi','hitler','pédophile','idiot','imbécile','crétin','débile','abruti','con ','bouffon','taré','demeuré','gogol','stupide'];
const SOFT_INSULTS = ['idiot','idiote','stupide','bête','bete','nul','nulle','nuls','ridicule','lamentable','pathétique','pathetique','minable','incapable','incompétent','incompetent'];

function containsBadWords(text) {
  if (!text) return { found: false, words: [], severity: 'none' };
  var lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_\-\.]/g, ' ').replace(/\s+/g, ' ').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/!/g, 'i').replace(/@/g, 'a').replace(/\$/g, 's');
  var found = [], severity = 'none';
  for (var i = 0; i < ALWAYS_FLAG.length; i++) {
    var w = ALWAYS_FLAG[i], nw = w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
  var patterns = [/\bt(?:u es|es|'es)\s+(?:un|une)?\s*(?:idiot|con|nul|bete|stupide|debile|cretin|abruti)/i, /(?:quel|quelle)\s+(?:idiot|con|nul|abruti|debile|cretin)/i, /(?:espece|espèce)\s+(?:de|d')\s*(?:idiot|con|nul|abruti|debile|cretin|imbecile)/i, /(?:gros|grosse|sale|petit|petite)\s+(?:idiot|con|nul|abruti|debile|cretin|merde)/i];
  for (var j = 0; j < patterns.length; j++) { if (patterns[j].test(lower)) { found.push('[insulte]'); if (severity !== 'hard') severity = 'soft'; } }
  var unique = []; for (var k = 0; k < found.length; k++) { if (unique.indexOf(found[k]) === -1) unique.push(found[k]); }
  return { found: unique.length > 0, words: unique, severity: severity };
}

var cooldowns = new Map();
function checkCooldown(userId) {
  var now = Date.now(), d = cooldowns.get(userId);
  if (!d) { cooldowns.set(userId, { last: now, delCount: 0, delReset: now }); return { allowed: true }; }
  if (now - d.delReset > 3600000) { d.delCount = 0; d.delReset = now; }
  if (d.delCount >= 5 && now - d.last < 600000) return { allowed: false, reason: 'Trop de suppressions. Attendez 10 min.' };
  if (now - d.last < 8000) return { allowed: false, reason: 'Attendez quelques secondes' };
  d.last = now; return { allowed: true };
}
function markDelete(userId) {
  var d = cooldowns.get(userId);
  if (d) d.delCount++; else cooldowns.set(userId, { last: Date.now(), delCount: 1, delReset: Date.now() });
}

// ═══════════════════════════════════════════════════════
// SECURITY
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
  if (req.body) { for (var k in req.body) { if (typeof req.body[k] === 'string') { req.body[k] = req.body[k].replace(/\0/g, ''); if (req.body[k].length > 50000) req.body[k] = req.body[k].substring(0, 50000); } } }
  next();
});

// Rate limiting
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

app.get('/api/health', function(req, res) {
  res.json({ ok: true, groq: GROQ_KEYS.length, uptime: Math.round(process.uptime()), live: analytics.liveVisitors.size });
});

// ═══════════════ ANALYTICS API ═══════════════
app.post('/api/analytics/track', limit(180, 60000), function(req, res) {
  var page = req.body.page || '/';

  // Filter out API calls and static assets from page tracking
  if (page.startsWith('/api/') || page.startsWith('/js/') || page.startsWith('/css/')) {
    return res.json({ ok: true });
  }

  var trackData = parseTrackingData(req);
  trackData.page = page;
  trackData.isNew = true; // Client-side tracking = always a real visit

  analytics.track(trackData);
  res.json({ ok: true });
});

app.post('/api/analytics/event', limit(120, 60000), function(req, res) {
  var event = req.body.event;
  var metadata = req.body.metadata;
  if (event && typeof event === 'string' && event.length < 100) {
    analytics.trackEvent(event, metadata || null);
  }
  res.json({ ok: true });
});

app.get('/api/analytics', limit(30, 60000), async function(req, res) {
  var days = parseInt(req.query.days) || 30;
  if (days > 365) days = 365;
  if (days < 1) days = 1;
  var stats = await analytics.getStats(days);
  res.json(stats);
});

// ═══════════════ WIKI ═══════════════
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

// ═══════════════ MODERATION ═══════════════
app.post('/api/check-farm', limit(60, 60000), function(req, res) {
  if (!req.body.userId) return res.status(400).json({ error: 'Missing' });
  res.json(checkCooldown(req.body.userId));
});
app.post('/api/mark-delete', limit(30, 60000), function(req, res) {
  if (req.body.userId) markDelete(req.body.userId);
  res.json({ ok: true });
});

app.post('/api/moderate', limit(60, 60000), async function(req, res) {
  var title = req.body.title || '', description = req.body.description || '', context = req.body.context || '';
  var isWiki = context === 'wiki';
  var check = containsBadWords(title + ' ' + description);
  if (!check.found) return res.json({ flagged: false });

  var key = getGroqKey();
  if (!key) {
    var ct = title, cd = description;
    for (var i = 0; i < check.words.length; i++) { var w = check.words[i]; if (w === '[insulte]') continue; var r = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); ct = ct.replace(r, '...'); cd = cd.replace(r, '...'); }
    return res.json({ flagged: true, reformulated: true, cleaned: { title: ct, description: cd } });
  }

  var mdNote = isWiki ? '\n\nIMPORTANT: CONSERVE tout le formatage Markdown existant (##, -, **, *, etc).' : '';
  try {
    var ctrl = new AbortController();
    var to = setTimeout(function() { ctrl.abort(); }, 12000);
    var resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [
        { role: 'system', content: 'Tu es un filtre de modération pour "Gwadloup Alert", plateforme citoyenne Guadeloupe.\n\nRÈGLES:\n1. SUPPRIME noms de politiciens → "une personnalité publique"\n2. SUPPRIME insultes → reformule poliment\n3. CONSERVE le sens utile\n4. Ton NATUREL\n\nINTERDIT:\n- JAMAIS d\'excuse/explication\n- JAMAIS de refus\n- PAS de [censuré] ni ***' + mdNote + '\n\nRéponds UNIQUEMENT en JSON: {"title":"...","description":"..."}' },
        { role: 'user', content: 'Titre: ' + title.substring(0, 300) + '\nDescription: ' + description.substring(0, 5000) }
      ], temperature: 0.3, max_tokens: isWiki ? 2000 : 600 }),
      signal: ctrl.signal
    });
    clearTimeout(to);
    if (!resp.ok) throw new Error();
    var data = await resp.json();
    var txt = data.choices[0].message.content.trim();
    if (txt.indexOf('```') !== -1) txt = txt.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    var s = txt.indexOf('{'), e = txt.lastIndexOf('}');
    if (s >= 0 && e > s) txt = txt.substring(s, e + 1);
    var parsed; try { parsed = JSON.parse(txt); } catch (pe) { throw pe; }
    var apology = ['je suis désolé','je ne peux pas','veuillez reformuler','je ne peux pas répondre','contenu inapproprié'];
    var combined = ((parsed.title || '') + ' ' + (parsed.description || '')).toLowerCase();
    for (var a = 0; a < apology.length; a++) { if (combined.indexOf(apology[a]) !== -1) throw new Error('apology'); }
    var recheck = containsBadWords((parsed.title || '') + ' ' + (parsed.description || ''));
    if (recheck.found) {
      var ct2 = parsed.title || '', cd2 = parsed.description || '';
      for (var i = 0; i < recheck.words.length; i++) { var w = recheck.words[i]; if (w === '[insulte]') continue; var r = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); ct2 = ct2.replace(r, '...'); cd2 = cd2.replace(r, '...'); }
      return res.json({ flagged: true, reformulated: true, cleaned: { title: ct2, description: cd2 } });
    }
    return res.json({ flagged: true, reformulated: true, cleaned: { title: (parsed.title || 'Signalement').substring(0, 150), description: (parsed.description || 'Description').substring(0, 5000) } });
  } catch (err) {
    var ct = title, cd = description;
    for (var i = 0; i < check.words.length; i++) { var w = check.words[i]; if (w === '[insulte]') continue; var r = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); ct = ct.replace(r, '...'); cd = cd.replace(r, '...'); }
    return res.json({ flagged: true, reformulated: true, cleaned: { title: ct, description: cd } });
  }
});

// Anonymous report endpoint
app.post('/api/report-anonymous', limit(10, 60000), async function(req, res) {
  var body = req.body;
  if (!body.title || !body.description || !body.latitude || !body.longitude || !body.category) {
    return res.status(400).json({ error: 'Champs manquants' });
  }
  if (body.title.length < 5 || body.description.length < 10) {
    return res.status(400).json({ error: 'Contenu trop court' });
  }

  // Moderation check
  var check = containsBadWords(body.title + ' ' + body.description);
  if (check.found && check.severity === 'hard') {
    return res.status(400).json({ error: 'Contenu inapproprié' });
  }

  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Database unavailable' });

    var result = await supabaseAdmin.from('reports').insert({
      category: body.category,
      title: body.title.substring(0, 150),
      description: body.description.substring(0, 2000),
      latitude: body.latitude,
      longitude: body.longitude,
      address: body.address || null,
      commune: body.commune || null,
      images: [],
      priority: body.priority || 'medium',
      status: 'pending',
      upvotes: 0,
      user_id: null // Anonymous — no user
    }).select().single();

    if (result.error) {
      // If user_id NOT NULL constraint, we need a system user
      // Try with a placeholder
      return res.status(400).json({ error: 'Signalement anonyme non supporté par la base. Contactez l\'admin pour ajouter le support.' });
    }

    analytics.trackEvent('anonymous_report');
    res.json({ ok: true, id: result.data.id });
  } catch(e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.all('/api/*', function(req, res) { res.status(404).json({ error: 'Route inconnue' }); });
app.get('*', function(req, res) { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.use(function(err, req, res, next) { console.error(err); res.status(500).json({ error: 'Erreur serveur' }); });

// Flush analytics before shutdown
process.on('SIGTERM', function() { analytics.flush().then(function() { process.exit(0); }); });
process.on('SIGINT', function() { analytics.flush().then(function() { process.exit(0); }); });

// Init analytics then start server
analytics.init();
app.listen(PORT, function() { console.log('Gwadloup Alert v14 — port ' + PORT + ' — ' + GROQ_KEYS.length + ' Groq — Analytics Supabase ON'); });
