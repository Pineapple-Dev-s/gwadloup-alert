var App = {
  config: {},
  supabase: null,
  currentUser: null,
  currentProfile: null,
  reports: [],
  banner: null,
  theme: 'light',
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
    low: { label: 'Faible', color: '#16a34a' },
    medium: { label: 'Moyenne', color: '#d97706' },
    high: { label: 'Haute', color: '#ea580c' },
    critical: { label: 'Critique', color: '#dc2626' }
  },

  init: async function() {
    var loader = document.getElementById('loading-overlay');
    if (loader) loader.classList.add('active');

    this._applyTheme();

    try {
      var resp = await fetch('/api/config');
      if (!resp.ok) throw new Error('Config fetch failed: ' + resp.status);
      this.config = await resp.json();
    } catch(e) {
      console.error('Config load error:', e);
      this.config = {};
    }

    if (this.config.supabaseUrl && this.config.supabaseAnonKey) {
      try {
        this.supabase = supabase.createClient(
          this.config.supabaseUrl,
          this.config.supabaseAnonKey
        );
      } catch(e) {
        console.error('Supabase init error:', e);
      }
    }

    this._handleAuthFragments();

    this._initModules([
      'Auth',
      'MapManager',
      'UI',
      'ImageUpload'
    ]);

    if (typeof Reports !== 'undefined') {
      try {
        await Reports.loadAll();
      } catch(e) {
        console.error('Reports load error:', e);
      }
    }

    await this.loadBanner();

    this._initRealtime();
    this._initAutoRefresh();
    this._initVisibilityHandler();

    this._initModules(['Share', 'PWA']);

    this._initClientTracking();

    if (loader) loader.classList.remove('active');
  },

  _applyTheme: function() {
    var saved = localStorage.getItem('gwad-theme');
    if (saved && (saved === 'light' || saved === 'dark')) {
      this.theme = saved;
    } else {
      this.theme = 'light';
    }
    document.documentElement.setAttribute('data-theme', this.theme);
  },

  _initModules: function(names) {
    names.forEach(function(name) {
      try {
        if (typeof window[name] !== 'undefined' && typeof window[name].init === 'function') {
          window[name].init();
        }
      } catch(e) {
        console.warn('Module init error [' + name + ']:', e);
      }
    });
  },

  _handleAuthFragments: function() {
    try {
      if (window.location.hash && window.location.hash.indexOf('access_token') !== -1) {
        var clean = window.location.href.split('#')[0];
        history.replaceState(null, '', clean);
      }
    } catch(e) {
      console.warn('Auth fragment handling error:', e);
    }
  },

  _initRealtime: function() {
    if (!this.supabase) return;
    try {
      this.supabase
        .channel('reports-changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, function(payload) {
          if (typeof Reports !== 'undefined') Reports.handleNew(payload.new);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reports' }, function(payload) {
          if (typeof Reports !== 'undefined') Reports.handleUpdate(payload.new);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reports' }, function(payload) {
          if (typeof Reports !== 'undefined') Reports.handleDelete(payload.old);
        })
        .subscribe(function(status) {
          if (status === 'SUBSCRIBED') {
            console.info('Realtime connected');
          }
        });
    } catch(e) {
      console.warn('Realtime init error:', e);
    }
  },

  _autoRefreshTimer: null,

  _initAutoRefresh: function() {
    var self = this;
    if (self._autoRefreshTimer) clearInterval(self._autoRefreshTimer);
    self._autoRefreshTimer = setInterval(function() {
      if (!document.hidden && typeof Reports !== 'undefined') {
        Reports.loadAll().catch(function(e) {
          console.warn('Auto-refresh error:', e);
        });
      }
    }, 120000);
  },

  _initVisibilityHandler: function() {
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden && typeof Reports !== 'undefined') {
        var lastRefresh = App._lastRefresh || 0;
        var now = Date.now();
        if (now - lastRefresh > 60000) {
          Reports.loadAll().catch(function() {});
          App._lastRefresh = now;
        }
      }
    });
  },

  _lastRefresh: 0,

  _initClientTracking: function() {
    try {
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: window.location.pathname + window.location.hash,
          theme: this.theme,
          ts: Date.now()
        })
      }).catch(function() {});
    } catch(e) {}
  },

  trackEvent: function(event, metadata) {
    if (!event) return;
    try {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: String(event),
          metadata: metadata || null,
          ts: Date.now()
        })
      }).catch(function() {});
    } catch(e) {}
  },

  loadBanner: async function() {
    if (!this.supabase) return;
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
        if (typeof UI !== 'undefined' && typeof UI.renderBanner === 'function') {
          UI.renderBanner(result.data);
        }
      }
    } catch(e) {
      console.warn('Banner load error:', e);
    }
  },

  toggleTheme: function() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.theme);
    localStorage.setItem('gwad-theme', this.theme);
    this.trackEvent('theme_toggle', { theme: this.theme });
  },

  setFilter: function(key, value) {
    if (!Object.prototype.hasOwnProperty.call(this.filters, key)) return;
    this.filters[key] = value || '';
    this.pagination.page = 0;
    this.pagination.hasMore = true;
    if (typeof Reports !== 'undefined') Reports.applyFilters();
  },

  resetFilters: function() {
    this.filters = { category: '', status: '', commune: '' };
    this.pagination.page = 0;
    this.pagination.hasMore = true;
    if (typeof Reports !== 'undefined') Reports.applyFilters();
  },

  getCategoryLabel: function(key) {
    return (this.categories[key] && this.categories[key].label) || key || '';
  },

  getStatusLabel: function(key) {
    return (this.statuses[key] && this.statuses[key].label) || key || '';
  },

  getPriorityLabel: function(key) {
    return (this.priorities[key] && this.priorities[key].label) || key || '';
  },

  getPriorityColor: function(key) {
    return (this.priorities[key] && this.priorities[key].color) || 'var(--text3)';
  },

  esc: function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  ago: function(dateStr) {
    if (!dateStr) return '';
    var now = Date.now();
    var then = new Date(dateStr).getTime();
    if (isNaN(then)) return '';
    var diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'maintenant';
    if (diff < 3600) return Math.floor(diff / 60) + 'min';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    if (diff < 2592000) return Math.floor(diff / 86400) + 'j';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  },

  formatDate: function(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  },

  truncate: function(str, max) {
    if (!str) return '';
    max = max || 80;
    var s = String(str);
    return s.length > max ? s.slice(0, max) + '…' : s;
  },

  debounce: function(fn, delay) {
    var timer;
    return function() {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function() {
        fn.apply(ctx, args);
      }, delay || 300);
    };
  },

  isLoggedIn: function() {
    return !!this.currentUser;
  },

  isAdmin: function() {
    return !!(this.currentProfile && this.currentProfile.role === 'admin');
  },

  isMairie: function() {
    return !!(this.currentProfile && (
      this.currentProfile.role === 'mairie' ||
      this.currentProfile.role === 'admin'
    ));
  }
};

document.addEventListener('DOMContentLoaded', function() {
  var splash = document.getElementById('app-splash');
  var loader = document.getElementById('loading-overlay');

  App.init()
    .then(function() {
      // Succès → on cache le splash proprement
      if (splash) {
        splash.classList.add('hide');
        setTimeout(function() { splash.remove(); }, 500);
      }

      // Fallback ancien loader
      if (loader) loader.classList.remove('active');
    })
    .catch(function(e) {
      console.error('App init failed:', e);

      // Même en cas d'erreur → on libère l’écran
      if (splash) {
        splash.classList.add('hide');
        setTimeout(function() { splash.remove(); }, 500);
      }

      if (loader) loader.classList.remove('active');

      // Optionnel : message utilisateur
      if (typeof UI !== 'undefined' && typeof UI.toast === 'function') {
        UI.toast('Erreur au chargement de l’application', 'error');
      }
    });
});
