const App = {
  config: null, supabase: null, currentUser: null, currentProfile: null,
  reports: [], filters: { category: '', status: '', commune: '' },
  categories: {
    pothole:{emoji:'🕳️',label:'Nid de poule'},dangerous_road:{emoji:'⚠️',label:'Route dangereuse'},damaged_sign:{emoji:'🚧',label:'Signalisation'},missing_marking:{emoji:'🚸',label:'Marquage'},speed_bump_needed:{emoji:'🔶',label:'Ralentisseur'},abandoned_vehicle:{emoji:'🚗',label:'Véhicule abandonné'},abandoned_boat:{emoji:'⛵',label:'Bateau abandonné'},illegal_dump:{emoji:'🗑️',label:'Dépôt sauvage'},beach_pollution:{emoji:'🏖️',label:'Pollution plage'},river_pollution:{emoji:'🏞️',label:'Pollution rivière'},overflowing_bin:{emoji:'🗑️',label:'Poubelle pleine'},broken_light:{emoji:'💡',label:'Éclairage'},exposed_cable:{emoji:'⚡',label:'Câble exposé'},water_leak:{emoji:'💧',label:'Fuite'},flooding:{emoji:'🌊',label:'Inondation'},sewer_issue:{emoji:'🚿',label:'Assainissement'},stagnant_water:{emoji:'🦟',label:'Eau stagnante'},vegetation:{emoji:'🌿',label:'Végétation'},fallen_tree:{emoji:'🌳',label:'Arbre tombé'},invasive_species:{emoji:'🌱',label:'Espèce invasive'},damaged_building:{emoji:'🏚️',label:'Bâtiment'},abandoned_building:{emoji:'🏗️',label:'Abandonné'},damaged_sidewalk:{emoji:'🚶',label:'Trottoir'},missing_railing:{emoji:'🚧',label:'Garde-fou'},dangerous_area:{emoji:'🛡️',label:'Zone dangereuse'},missing_crosswalk:{emoji:'🚶',label:'Passage piéton'},school_zone_issue:{emoji:'🏫',label:'Zone scolaire'},noise:{emoji:'🔊',label:'Bruit'},stray_animals:{emoji:'🐕',label:'Animaux errants'},mosquito_breeding:{emoji:'🦟',label:'Moustiques'},other:{emoji:'📌',label:'Autre'}
  },
  statuses: {pending:{label:'En attente',icon:'⏳'},acknowledged:{label:'Pris en compte',icon:'👁️'},in_progress:{label:'En cours',icon:'🔧'},resolved:{label:'Résolu',icon:'✅'},rejected:{label:'Rejeté',icon:'❌'}},
  priorities: {low:{label:'Faible',color:'#3fb950'},medium:{label:'Moyenne',color:'#d29922'},high:{label:'Haute',color:'#FF8B00'},critical:{label:'Critique',color:'#f85149'}},

  async init() {
    try {
      UI.showLoading();
      const r = await fetch('/api/config');
      if (!r.ok) throw new Error('Config fail');
      this.config = await r.json();
      if (!this.config.supabaseUrl) throw new Error('No supabase URL');

      // VERSION FIXE de Supabase — pas de lock issue
      this.supabase = window.supabase.createClient(this.config.supabaseUrl, this.config.supabaseAnonKey);

      // Handle email confirmation redirect
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        await new Promise(r => setTimeout(r, 1000));
        window.history.replaceState(null, '', window.location.pathname);
        setTimeout(() => UI.toast('Email confirmé !', 'success'), 1500);
      } else if (hash && hash.includes('error')) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      await Auth.init();
      MapManager.init();
      UI.init();
      await Reports.loadAll();

      // Realtime
      this.supabase.channel('rt').on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, (p) => {
        if (p.eventType === 'INSERT') Reports.handleNew(p.new);
        else if (p.eventType === 'UPDATE') Reports.handleUpdate(p.new);
        else if (p.eventType === 'DELETE') Reports.handleDelete(p.old);
      }).subscribe();

      UI.hideLoading();
    } catch (e) {
      console.error('Init:', e);
      UI.hideLoading();
      UI.toast('Erreur de chargement', 'error');
    }
  },

  ago(d) {
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return 'maintenant';
    if (s < 3600) return Math.floor(s / 60) + 'min';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 2592000) return Math.floor(s / 86400) + 'j';
    return new Date(d).toLocaleDateString('fr-FR');
  },
  esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
};

document.addEventListener('DOMContentLoaded', () => App.init());
