var App = {
  config: {},
  supabase: null,
  currentUser: null,
  currentProfile: null,
  reports: [],
  banner: null,
  theme: 'dark',
  filters: { category: '', status: '', commune: '' },
  pagination: { page: 0, limit: 50, hasMore: true, total: 0, loading: false },

  categories: {
    pothole: { icon: 'road', label: 'Nid de poule' },
    dangerous_road: { icon: 'warning', label: 'Route dangereuse' },
    damaged_sign: { icon: 'sign', label: 'Signalisation' },
    missing_marking: { icon: 'marking', label: 'Marquage' },
    speed_bump_needed: { icon: 'bump', label: 'Ralentisseur' },
    abandoned_vehicle: { icon: 'car', label: 'Véhicule abandonné' },
    abandoned_boat: { icon: 'boat', label: 'Bateau abandonné' },
    illegal_dump: { icon: 'dump', label: 'Dépôt sauvage' },
    beach_pollution: { icon: 'beach', label: 'Pollution plage' },
    river_pollution: { icon: 'river', label: 'Pollution rivière' },
    overflowing_bin: { icon: 'bin', label: 'Poubelle pleine' },
    broken_light: { icon: 'light', label: 'Éclairage' },
    exposed_cable: { icon: 'cable', label: 'Câble exposé' },
    water_leak: { icon: 'leak', label: 'Fuite' },
    flooding: { icon: 'flood', label: 'Inondation' },
    sewer_issue: { icon: 'sewer', label: 'Assainissement' },
    stagnant_water: { icon: 'stagnant', label: 'Eau stagnante' },
    vegetation: { icon: 'plant', label: 'Végétation' },
    fallen_tree: { icon: 'tree', label: 'Arbre tombé' },
    invasive_species: { icon: 'invasive', label: 'Espèce invasive' },
    damaged_building: { icon: 'building', label: 'Bâtiment' },
    abandoned_building: { icon: 'abandoned', label: 'Abandonné' },
    damaged_sidewalk: { icon: 'sidewalk', label: 'Trottoir' },
    missing_railing: { icon: 'railing', label: 'Garde-fou' },
    dangerous_area: { icon: 'danger', label: 'Zone dangereuse' },
    missing_crosswalk: { icon: 'crosswalk', label: 'Passage piéton' },
    school_zone_issue: { icon: 'school', label: 'Zone scolaire' },
    noise: { icon: 'noise', label: 'Bruit' },
    stray_animals: { icon: 'animals', label: 'Animaux errants' },
    mosquito_breeding: { icon: 'mosquito', label: 'Moustiques' },
    other: { icon: 'other', label: 'Autre' }
  },

  statuses: {
    pending: { label: 'En attente' },
    acknowledged: { label: 'Pris en compte' },
    in_progress: { label: 'En cours' },
    resolved: { label: 'Résolu' },
    rejected: { label: 'Rejeté' }
  },

  priorities: {
    low: { label: 'Faible', color: '#3fb950' },
    medium: { label: 'Moyenne', color: '#d29922' },
    high: { label: 'Haute', color: '#FF8B00' },
    critical: { label: 'Critique', color: '#f85149' }
  },

  init: async function() {
    var loader = document.getElementById('loading-overlay');
    if (loader) loader.classList.add('active');

    // Theme
    var saved = localStorage.getItem('gwad-theme');
    if (saved) { this.theme = saved; document.documentElement.setAttribute('data-theme', saved); }

    try {
      var resp = await fetch('/api/config');
      this.config = await resp.json();
    } catch(e) {
      console.error('Config load error:', e);
      this.config = {};
    }

    if (this.config.supabaseUrl && this.config.supabaseAnonKey) {
      this.supabase = supabase.createClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
    }

    // Handle auth redirect fragments
    this._handleAuthFragments();

    // Init modules
    if (typeof Auth !== 'undefined') Auth.init();
    if (typeof MapManager !== 'undefined') MapManager.init();
    if (typeof UI !== 'undefined') UI.init();
    if (typeof ImageUpload !== 'undefined') ImageUpload.init();

    // Load data
    if (typeof Reports !== 'undefined') {
      try { await Reports.loadAll(); } catch(e) { console.error('Reports load error:', e); }
    }

    // Banner
    this.loadBanner();

    // Realtime
    this._initRealtime();

    // Auto refresh
    this._initAutoRefresh();

    // Optional modules
    if (typeof Share !== 'undefined') Share.init();
    if (typeof PWA !== 'undefined') PWA.init();

    // Client tracking
    this._initClientTracking();

    // Hide loader
    if (loader) { loader.classList.remove('active'); }
  },

  _handleAuthFragments: function() {
    if (window.location.hash && window.location.hash.indexOf('access_token') !== -1) {
      var clean = window.location.href.split('#')[0];
      history.replaceState(null, '', clean);
    }
  },

  _initRealtime: function() {
    if (!this.supabase) return;
    try {
      this.supabase.channel('reports-changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, function(payload) {
          if (typeof Reports !== 'undefined') Reports.handleNew(payload.new);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reports' }, function(payload) {
          if (typeof Reports !== 'undefined') Reports.handleUpdate(payload.new);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reports' }, function(payload) {
          if (typeof Reports !== 'undefined') Reports.handleDelete(payload.old);
        })
        .subscribe();
    } catch(e) { console.warn('Realtime error:', e); }
  },

  _initAutoRefresh: function() {
    setInterval(function() {
      if (!document.hidden && typeof Reports !== 'undefined') {
        Reports.loadAll();
      }
    }, 120000);
  },

  _initClientTracking: function() {
    try {
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: window.location.pathname + window.location.hash })
      }).catch(function() {});
    } catch(e) {}
  },

  trackEvent: function(event, metadata) {
    try {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: event, metadata: metadata || null })
      }).catch(function() {});
    } catch(e) {}
  },

  loadBanner: async function() {
    if (!this.supabase) return;
    try {
      var result = await this.supabase.from('site_banners').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (result.data) {
        this.banner = result.data;
        if (typeof UI !== 'undefined' && UI.renderBanner) UI.renderBanner(result.data);
      }
    } catch(e) {}
  },

  toggleTheme: function() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.theme);
    localStorage.setItem('gwad-theme', this.theme);
  },

  esc: function(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  ago: function(dateStr) {
    if (!dateStr) return '';
    var now = Date.now();
    var then = new Date(dateStr).getTime();
    var diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'maintenant';
    if (diff < 3600) return Math.floor(diff / 60) + 'min';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    if (diff < 2592000) return Math.floor(diff / 86400) + 'j';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
};

// Boot
document.addEventListener('DOMContentLoaded', function() {
  App.init();
});
