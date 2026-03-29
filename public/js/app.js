const App = {
  config: null, supabase: null, currentUser: null, currentProfile: null,
  reports: [], filters: { category: '', status: '', commune: '' },

  categories: {
    pothole:{emoji:'🕳️',label:'Nid de poule'},dangerous_road:{emoji:'⚠️',label:'Route dangereuse'},
    damaged_sign:{emoji:'🚧',label:'Signalisation'},missing_marking:{emoji:'🚸',label:'Marquage effacé'},
    speed_bump_needed:{emoji:'🔶',label:'Ralentisseur'},abandoned_vehicle:{emoji:'🚗',label:'Véhicule abandonné'},
    abandoned_boat:{emoji:'⛵',label:'Bateau abandonné'},illegal_dump:{emoji:'🗑️',label:'Dépôt sauvage'},
    beach_pollution:{emoji:'🏖️',label:'Pollution plage'},river_pollution:{emoji:'🏞️',label:'Pollution rivière'},
    overflowing_bin:{emoji:'🗑️',label:'Poubelle pleine'},broken_light:{emoji:'💡',label:'Éclairage'},
    exposed_cable:{emoji:'⚡',label:'Câble exposé'},water_leak:{emoji:'💧',label:'Fuite d\'eau'},
    flooding:{emoji:'🌊',label:'Inondation'},sewer_issue:{emoji:'🚿',label:'Assainissement'},
    stagnant_water:{emoji:'🦟',label:'Eau stagnante'},vegetation:{emoji:'🌿',label:'Végétation'},
    fallen_tree:{emoji:'🌳',label:'Arbre tombé'},invasive_species:{emoji:'🌱',label:'Espèce invasive'},
    damaged_building:{emoji:'🏚️',label:'Bâtiment'},abandoned_building:{emoji:'🏗️',label:'Bâtiment abandonné'},
    damaged_sidewalk:{emoji:'🚶',label:'Trottoir'},missing_railing:{emoji:'🚧',label:'Garde-fou'},
    dangerous_area:{emoji:'🛡️',label:'Zone dangereuse'},missing_crosswalk:{emoji:'🚶',label:'Passage piéton'},
    school_zone_issue:{emoji:'🏫',label:'Zone scolaire'},noise:{emoji:'🔊',label:'Bruit'},
    stray_animals:{emoji:'🐕',label:'Animaux errants'},mosquito_breeding:{emoji:'🦟',label:'Moustiques'},
    other:{emoji:'📌',label:'Autre'}
  },

  statuses: {
    pending:{label:'En attente',icon:'⏳'},acknowledged:{label:'Pris en compte',icon:'👁️'},
    in_progress:{label:'En cours',icon:'🔧'},resolved:{label:'Résolu',icon:'✅'},
    rejected:{label:'Rejeté',icon:'❌'}
  },

  priorities: {
    low:{label:'Faible',color:'#00875A'},medium:{label:'Moyenne',color:'#FFAB00'},
    high:{label:'Haute',color:'#FF8B00'},critical:{label:'Critique',color:'#DE350B'}
  },

  async init() {
    try {
      UI.showLoading();
      const r = await fetch('/api/config');
      if (!r.ok) throw new Error('Config error');
      this.config = await r.json();

      // Init Supabase avec options pour éviter le lock timeout
      this.supabase = window.supabase.createClient(this.config.supabaseUrl, this.config.supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: 'implicit',
          lock: {
            // Disable lock to avoid timeout issues on free tier
            enabled: false
          }
        }
      });

      // Gérer le retour après confirmation email
      await this.handleAuthRedirect();

      await Auth.init();
      MapManager.init();
      UI.init();
      await Reports.loadAll();
      this.subscribeRealtime();
      UI.hideLoading();
    } catch (err) {
      console.error('Init:', err);
      UI.hideLoading();
      UI.toast('Erreur de chargement', 'error');
    }
  },

  async handleAuthRedirect() {
    const hash = window.location.hash;
    if (hash && (hash.includes('access_token') || hash.includes('error'))) {
      // Supabase va automatiquement parser le hash avec detectSessionInUrl
      // On attend un peu que la session soit établie
      await new Promise(resolve => setTimeout(resolve, 500));
      // Nettoyer l'URL
      window.history.replaceState(null, '', window.location.pathname);
      // Si c'est une confirmation réussie
      if (hash.includes('access_token')) {
        setTimeout(() => UI.toast('Email confirmé ! Vous êtes connecté 🎉', 'success'), 1000);
      }
    }
  },

  subscribeRealtime() {
    this.supabase.channel('reports-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, (p) => {
        if (p.eventType === 'INSERT') Reports.handleNewReport(p.new);
        else if (p.eventType === 'UPDATE') Reports.handleUpdatedReport(p.new);
        else if (p.eventType === 'DELETE') Reports.handleDeletedReport(p.old);
      }).subscribe();
  },

  timeAgo(d) {
    const s = Math.floor((new Date() - new Date(d)) / 1000);
    if (s < 60) return 'À l\'instant';
    if (s < 3600) return `Il y a ${Math.floor(s/60)}min`;
    if (s < 86400) return `Il y a ${Math.floor(s/3600)}h`;
    if (s < 2592000) return `Il y a ${Math.floor(s/86400)}j`;
    return new Date(d).toLocaleDateString('fr-FR');
  },

  esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
};

document.addEventListener('DOMContentLoaded', () => App.init());
