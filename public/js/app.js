const App = {
  config: null,
  supabase: null,
  currentUser: null,
  currentProfile: null,
  reports: [],
  filters: { category: '', status: '', commune: '' },

  categories: {
    // Routes & Voirie
    pothole: { emoji: '🕳️', label: 'Nid de poule', group: 'Routes & Voirie' },
    dangerous_road: { emoji: '⚠️', label: 'Route dangereuse', group: 'Routes & Voirie' },
    damaged_sign: { emoji: '🚧', label: 'Signalisation abîmée', group: 'Routes & Voirie' },
    missing_marking: { emoji: '🚸', label: 'Marquage effacé', group: 'Routes & Voirie' },
    speed_bump_needed: { emoji: '🔶', label: 'Ralentisseur nécessaire', group: 'Routes & Voirie' },
    // Véhicules
    abandoned_vehicle: { emoji: '🚗', label: 'Véhicule abandonné', group: 'Véhicules' },
    abandoned_boat: { emoji: '⛵', label: 'Bateau abandonné', group: 'Véhicules' },
    // Déchets
    illegal_dump: { emoji: '🗑️', label: 'Dépôt sauvage', group: 'Déchets & Pollution' },
    beach_pollution: { emoji: '🏖️', label: 'Pollution de plage', group: 'Déchets & Pollution' },
    river_pollution: { emoji: '🏞️', label: 'Pollution de rivière', group: 'Déchets & Pollution' },
    overflowing_bin: { emoji: '🗑️', label: 'Poubelle débordante', group: 'Déchets & Pollution' },
    // Éclairage
    broken_light: { emoji: '💡', label: 'Éclairage défaillant', group: 'Éclairage' },
    exposed_cable: { emoji: '⚡', label: 'Câble exposé', group: 'Éclairage' },
    // Eau
    water_leak: { emoji: '💧', label: 'Fuite d\'eau', group: 'Eau' },
    flooding: { emoji: '🌊', label: 'Inondation', group: 'Eau' },
    sewer_issue: { emoji: '🚿', label: 'Problème assainissement', group: 'Eau' },
    stagnant_water: { emoji: '🦟', label: 'Eau stagnante', group: 'Eau' },
    // Végétation
    vegetation: { emoji: '🌿', label: 'Végétation envahissante', group: 'Végétation' },
    fallen_tree: { emoji: '🌳', label: 'Arbre tombé', group: 'Végétation' },
    invasive_species: { emoji: '🌱', label: 'Espèce invasive', group: 'Végétation' },
    // Infrastructures
    damaged_building: { emoji: '🏚️', label: 'Bâtiment endommagé', group: 'Infrastructures' },
    abandoned_building: { emoji: '🏗️', label: 'Bâtiment abandonné', group: 'Infrastructures' },
    damaged_sidewalk: { emoji: '🚶', label: 'Trottoir abîmé', group: 'Infrastructures' },
    missing_railing: { emoji: '🚧', label: 'Garde-fou manquant', group: 'Infrastructures' },
    // Sécurité
    dangerous_area: { emoji: '🛡️', label: 'Zone dangereuse', group: 'Sécurité' },
    missing_crosswalk: { emoji: '🚶', label: 'Passage piéton manquant', group: 'Sécurité' },
    school_zone_issue: { emoji: '🏫', label: 'Problème zone scolaire', group: 'Sécurité' },
    // Nuisances
    noise: { emoji: '🔊', label: 'Nuisance sonore', group: 'Nuisances' },
    stray_animals: { emoji: '🐕', label: 'Animaux errants', group: 'Nuisances' },
    mosquito_breeding: { emoji: '🦟', label: 'Foyer à moustiques', group: 'Nuisances' },
    // Autre
    other: { emoji: '📌', label: 'Autre', group: 'Autre' }
  },

  statuses: {
    pending: { label: 'En attente', icon: '⏳' },
    acknowledged: { label: 'Pris en compte', icon: '👁️' },
    in_progress: { label: 'En cours', icon: '🔧' },
    resolved: { label: 'Résolu', icon: '✅' },
    rejected: { label: 'Rejeté', icon: '❌' }
  },

  priorities: {
    low: { label: 'Faible', color: '#00875A' },
    medium: { label: 'Moyenne', color: '#FFAB00' },
    high: { label: 'Haute', color: '#FF8B00' },
    critical: { label: 'Critique', color: '#DE350B' }
  },

  async init() {
    try {
      UI.showLoading();

      const resp = await fetch('/api/config');
      this.config = await resp.json();

      this.supabase = window.supabase.createClient(
        this.config.supabaseUrl,
        this.config.supabaseAnonKey
      );

      await Auth.init();
      MapManager.init();
      UI.init();
      await Reports.loadAll();
      this.subscribeRealtime();

      UI.hideLoading();
      console.log('✅ Gwadloup Alèrt v2.0');
    } catch (err) {
      console.error('Init error:', err);
      UI.hideLoading();
      UI.toast('Erreur de chargement', 'error');
    }
  },

  subscribeRealtime() {
    this.supabase
      .channel('reports-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, (payload) => {
        if (payload.eventType === 'INSERT') Reports.handleNewReport(payload.new);
        else if (payload.eventType === 'UPDATE') Reports.handleUpdatedReport(payload.new);
        else if (payload.eventType === 'DELETE') Reports.handleDeletedReport(payload.old);
      })
      .subscribe();
  },

  timeAgo(d) {
    const s = Math.floor((new Date() - new Date(d)) / 1000);
    if (s < 60) return 'À l\'instant';
    if (s < 3600) return `Il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `Il y a ${Math.floor(s / 3600)}h`;
    if (s < 2592000) return `Il y a ${Math.floor(s / 86400)}j`;
    return new Date(d).toLocaleDateString('fr-FR');
  },

  escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
