var App = {
  config: null,
  supabase: null,
  currentUser: null,
  currentProfile: null,
  reports: [],
  filters: { category: '', status: '', commune: '' },
  banner: null,

  categories: {
    pothole:           { icon: 'road',      label: 'Nid de poule' },
    dangerous_road:    { icon: 'warning',   label: 'Route dangereuse' },
    damaged_sign:      { icon: 'sign',      label: 'Signalisation' },
    missing_marking:   { icon: 'marking',   label: 'Marquage' },
    speed_bump_needed: { icon: 'bump',      label: 'Ralentisseur' },
    abandoned_vehicle: { icon: 'car',       label: 'Véhicule abandonné' },
    abandoned_boat:    { icon: 'boat',      label: 'Bateau abandonné' },
    illegal_dump:      { icon: 'dump',      label: 'Dépôt sauvage' },
    beach_pollution:   { icon: 'beach',     label: 'Pollution plage' },
    river_pollution:   { icon: 'river',     label: 'Pollution rivière' },
    overflowing_bin:   { icon: 'bin',       label: 'Poubelle pleine' },
    broken_light:      { icon: 'light',     label: 'Éclairage' },
    exposed_cable:     { icon: 'cable',     label: 'Câble exposé' },
    water_leak:        { icon: 'leak',      label: 'Fuite' },
    flooding:          { icon: 'flood',     label: 'Inondation' },
    sewer_issue:       { icon: 'sewer',     label: 'Assainissement' },
    stagnant_water:    { icon: 'stagnant',  label: 'Eau stagnante' },
    vegetation:        { icon: 'plant',     label: 'Végétation' },
    fallen_tree:       { icon: 'tree',      label: 'Arbre tombé' },
    invasive_species:  { icon: 'invasive',  label: 'Espèce invasive' },
    damaged_building:  { icon: 'building',  label: 'Bâtiment' },
    abandoned_building:{ icon: 'abandoned', label: 'Abandonné' },
    damaged_sidewalk:  { icon: 'sidewalk',  label: 'Trottoir' },
    missing_railing:   { icon: 'railing',   label: 'Garde-fou' },
    dangerous_area:    { icon: 'danger',    label: 'Zone dangereuse' },
    missing_crosswalk: { icon: 'crosswalk', label: 'Passage piéton' },
    school_zone_issue: { icon: 'school',    label: 'Zone scolaire' },
    noise:             { icon: 'noise',     label: 'Bruit' },
    stray_animals:     { icon: 'animals',   label: 'Animaux errants' },
    mosquito_breeding: { icon: 'mosquito',  label: 'Moustiques' },
    other:             { icon: 'other',     label: 'Autre' }
  },

  statuses: {
    pending:      { label: 'En attente' },
    acknowledged: { label: 'Pris en compte' },
    in_progress:  { label: 'En cours' },
    resolved:     { label: 'Résolu' },
    rejected:     { label: 'Rejeté' }
  },

  priorities: {
    low:      { label: 'Faible',   color: '#3fb950' },
    medium:   { label: 'Moyenne',  color: '#d29922' },
    high:     { label: 'Haute',    color: '#FF8B00' },
    critical: { label: 'Critique', color: '#f85149' }
  },

  init: async function() {
    var loader = document.getElementById('loading-overlay');
    if (loader) loader.classList.add('active');

    try {
      // 1. Load config from server
      var configResp = await fetch('/api/config');
      this.config = await configResp.json();

      // 2. Init Supabase client
      this.supabase = window.supabase.createClient(
        this.config.supabaseUrl,
        this.config.supabaseAnonKey
      );

      // 3. Handle auth URL fragments (email confirm, errors)
      this._handleAuthFragments();

      // 4. Init modules in order (auth first, then UI, then data)
      if (typeof Auth !== 'undefined') await Auth.init();
      if (typeof MapManager !== 'undefined') MapManager.init();
      if (typeof UI !== 'undefined') UI.init();
      if (typeof Reports !== 'undefined') await Reports.loadAll();

      // 5. Load site banner
      this.loadBanner();

      // 6. Setup realtime subscriptions
      this._initRealtime();

      // 7. Auto refresh (every 120s when tab visible)
      this._initAutoRefresh();

      // 8. Optional modules
      if (typeof Share !== 'undefined' && Share.init) Share.init();
      if (typeof PWA !== 'undefined' && PWA.init) PWA.init();

      // 9. Client-side analytics tracking
      this._initClientTracking();

    } catch(e) {
      console.error('App init error:', e);
      if (typeof UI !== 'undefined') UI.toast('Erreur de chargement', 'error');
    }

    // Always hide loader
    if (loader) loader.classList.remove('active');
  },

  // ═══════════════ AUTH FRAGMENTS ═══════════════
  _handleAuthFragments: function() {
    var hash = window.location.hash;
    if (!hash) return;

    if (hash.indexOf('access_token') !== -1) {
      // Email confirmed — wait for Supabase to process, then clean URL
      setTimeout(function() {
        history.replaceState(null, '', window.location.pathname);
        if (typeof UI !== 'undefined') UI.toast('Email confirmé !', 'success');
      }, 1000);
    } else if (hash.indexOf('error') !== -1) {
      // Auth error — clean URL silently
      history.replaceState(null, '', window.location.pathname);
    }
    // Note: deep link hashes (#report/xxx, #article/xxx) are handled by Share.init()
  },

  // ═══════════════ REALTIME ═══════════════
  _initRealtime: function() {
    var self = this;

    this.supabase.channel('rt-reports')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'reports'
      }, function(payload) {
        if (typeof Reports !== 'undefined') Reports.handleNew(payload.new);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'reports'
      }, function(payload) {
        if (typeof Reports !== 'undefined') Reports.handleUpdate(payload.new);
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'reports'
      }, function(payload) {
        if (typeof Reports !== 'undefined') Reports.handleDelete(payload.old);
      })
      .subscribe();
  },

  // ═══════════════ AUTO REFRESH ═══════════════
  _initAutoRefresh: function() {
    setInterval(function() {
      if (document.visibilityState === 'visible' && typeof Reports !== 'undefined') {
        Reports.loadAll();
      }
    }, 120000);
  },

  // ═══════════════ CLIENT TRACKING ═══════════════
  _initClientTracking: function() {
    var lastTracked = '';

    function trackPage() {
      var page = window.location.pathname + window.location.hash;
      if (page === lastTracked) return;
      lastTracked = page;
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: page })
      }).catch(function() {});
    }

    // Track initial page load
    trackPage();

    // Track SPA hash navigation
    window.addEventListener('hashchange', trackPage);
  },

  // ═══════════════ TRACK EVENT ═══════════════
  trackEvent: function(name) {
    if (!name || typeof name !== 'string') return;
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: name })
    }).catch(function() {});
  },

  // ═══════════════ BANNER ═══════════════
  loadBanner: async function() {
    try {
      var result = await this.supabase
        .from('site_banners')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (result.data) {
        this.banner = result.data;
        if (typeof UI !== 'undefined') UI.renderBanner(result.data);
      }
    } catch(e) {
      // Table might not exist yet — silently ignore
    }
  },

  // ═══════════════ UTILITIES ═══════════════
  ago: function(d) {
    if (!d) return '';
    var now = Date.now();
    var then = new Date(d).getTime();
    var diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'maintenant';
    if (diff < 3600) return Math.floor(diff / 60) + 'min';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    if (diff < 2592000) return Math.floor(diff / 86400) + 'j';
    return new Date(d).toLocaleDateString('fr-FR');
  },

  esc: function(t) {
    if (!t) return '';
    var d = document.createElement('div');
    d.textContent = String(t);
    return d.innerHTML;
  }
};

// ═══════════════ BOOTSTRAP ═══════════════
document.addEventListener('DOMContentLoaded', function() {
  App.init();
});
