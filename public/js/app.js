const App = {
  config: null, supabase: null, currentUser: null, currentProfile: null,
  reports: [], filters: { category: '', status: '', commune: '' },
  categories: {
    pothole:{icon:'road',label:'Nid de poule'},
    dangerous_road:{icon:'warning',label:'Route dangereuse'},
    damaged_sign:{icon:'sign',label:'Signalisation'},
    missing_marking:{icon:'marking',label:'Marquage'},
    speed_bump_needed:{icon:'bump',label:'Ralentisseur'},
    abandoned_vehicle:{icon:'car',label:'Véhicule abandonné'},
    abandoned_boat:{icon:'boat',label:'Bateau abandonné'},
    illegal_dump:{icon:'dump',label:'Dépôt sauvage'},
    beach_pollution:{icon:'beach',label:'Pollution plage'},
    river_pollution:{icon:'river',label:'Pollution rivière'},
    overflowing_bin:{icon:'bin',label:'Poubelle pleine'},
    broken_light:{icon:'light',label:'Éclairage'},
    exposed_cable:{icon:'cable',label:'Câble exposé'},
    water_leak:{icon:'leak',label:'Fuite'},
    flooding:{icon:'flood',label:'Inondation'},
    sewer_issue:{icon:'sewer',label:'Assainissement'},
    stagnant_water:{icon:'stagnant',label:'Eau stagnante'},
    vegetation:{icon:'plant',label:'Végétation'},
    fallen_tree:{icon:'tree',label:'Arbre tombé'},
    invasive_species:{icon:'invasive',label:'Espèce invasive'},
    damaged_building:{icon:'building',label:'Bâtiment'},
    abandoned_building:{icon:'abandoned',label:'Abandonné'},
    damaged_sidewalk:{icon:'sidewalk',label:'Trottoir'},
    missing_railing:{icon:'railing',label:'Garde-fou'},
    dangerous_area:{icon:'danger',label:'Zone dangereuse'},
    missing_crosswalk:{icon:'crosswalk',label:'Passage piéton'},
    school_zone_issue:{icon:'school',label:'Zone scolaire'},
    noise:{icon:'noise',label:'Bruit'},
    stray_animals:{icon:'animals',label:'Animaux errants'},
    mosquito_breeding:{icon:'mosquito',label:'Moustiques'},
    other:{icon:'other',label:'Autre'}
  },
  statuses: {
    pending:{label:'En attente',icon:'clock'},
    acknowledged:{label:'Pris en compte',icon:'eye'},
    in_progress:{label:'En cours',icon:'spinner'},
    resolved:{label:'Résolu',icon:'check'},
    rejected:{label:'Rejeté',icon:'times'}
  },
  priorities: {
    low:{label:'Faible',color:'#3fb950'},
    medium:{label:'Moyenne',color:'#d29922'},
    high:{label:'Haute',color:'#FF8B00'},
    critical:{label:'Critique',color:'#f85149'}
  },

  async init() {
    try {
      UI.showLoading();
      var r = await fetch('/api/config');
      if (!r.ok) throw new Error('Config fail');
      this.config = await r.json();
      if (!this.config.supabaseUrl) throw new Error('No supabase URL');

      this.supabase = window.supabase.createClient(this.config.supabaseUrl, this.config.supabaseAnonKey);

      var hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        await new Promise(function(resolve) { setTimeout(resolve, 1000); });
        window.history.replaceState(null, '', window.location.pathname);
        setTimeout(function() { UI.toast('Email confirmé !', 'success'); }, 1500);
      } else if (hash && hash.includes('error')) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      await Auth.init();
      MapManager.init();
      UI.init();
      await Reports.loadAll();

      // Realtime - wrapped in try/catch to not crash if CSP blocks websocket
      try {
        this.supabase.channel('rt').on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, function(p) {
          if (p.eventType === 'INSERT') Reports.handleNew(p.new);
          else if (p.eventType === 'UPDATE') Reports.handleUpdate(p.new);
          else if (p.eventType === 'DELETE') Reports.handleDelete(p.old);
        }).subscribe();
      } catch (rtErr) {
        console.warn('Realtime unavailable:', rtErr.message);
      }

      // Auto-refresh fallback if realtime fails
      setInterval(function() {
        if (document.visibilityState === 'visible') Reports.loadAll();
      }, 60000);

      UI.hideLoading();
    } catch (e) {
      console.error('Init:', e);
      UI.hideLoading();
      UI.toast('Erreur de chargement — rechargez la page', 'error');
    }
  },

  ago: function(d) {
    if (!d) return '';
    var s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return 'maintenant';
    if (s < 3600) return Math.floor(s / 60) + 'min';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 2592000) return Math.floor(s / 86400) + 'j';
    return new Date(d).toLocaleDateString('fr-FR');
  },

  esc: function(t) {
    if (!t) return '';
    var d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  },

  // Utility: debounce
  debounce: function(fn, ms) {
    var timer;
    return function() {
      var args = arguments, ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function() { fn.apply(ctx, args); }, ms);
    };
  }
};

document.addEventListener('DOMContentLoaded', function() { App.init(); });
