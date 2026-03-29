// ============================================
// GWADLOUP ALÈRT — Application principale
// ============================================

const App = {
  config: null,
  supabase: null,
  currentUser: null,
  currentProfile: null,
  reports: [],
  currentPage: 0,
  pageSize: 20,
  filters: {
    category: '',
    status: '',
    commune: ''
  },

  // Catégories avec labels et emojis
  categories: {
    pothole: { emoji: '🕳️', label: 'Nid de poule' },
    abandoned_vehicle: { emoji: '🚗', label: 'Véhicule abandonné' },
    illegal_dump: { emoji: '🗑️', label: 'Dépôt sauvage' },
    broken_light: { emoji: '💡', label: 'Éclairage défaillant' },
    flooding: { emoji: '🌊', label: 'Inondation' },
    vegetation: { emoji: '🌿', label: 'Végétation envahissante' },
    damaged_sign: { emoji: '🚧', label: 'Signalisation abîmée' },
    dangerous_road: { emoji: '⚠️', label: 'Route dangereuse' },
    noise: { emoji: '🔊', label: 'Nuisance sonore' },
    water_leak: { emoji: '💧', label: 'Fuite d\'eau' },
    other: { emoji: '📌', label: 'Autre' }
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

      // Charger la configuration
      const configResp = await fetch('/api/config');
      this.config = await configResp.json();

      // Initialiser Supabase
      this.supabase = window.supabase.createClient(
        this.config.supabaseUrl,
        this.config.supabaseAnonKey
      );

      // Initialiser l'authentification
      await Auth.init();

      // Initialiser la carte
      MapManager.init();

      // Initialiser l'UI
      UI.init();

      // Charger les signalements
      await Reports.loadAll();

      // Écouter les changements en temps réel
      this.subscribeRealtime();

      UI.hideLoading();

      console.log('✅ Gwadloup Alèrt initialisé');
    } catch (error) {
      console.error('Erreur d\'initialisation:', error);
      UI.hideLoading();
      UI.toast('Erreur lors du chargement de l\'application', 'error');
    }
  },

  subscribeRealtime() {
    this.supabase
      .channel('public:reports')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reports'
      }, (payload) => {
        console.log('Realtime:', payload.eventType);
        if (payload.eventType === 'INSERT') {
          Reports.handleNewReport(payload.new);
        } else if (payload.eventType === 'UPDATE') {
          Reports.handleUpdatedReport(payload.new);
        } else if (payload.eventType === 'DELETE') {
          Reports.handleDeletedReport(payload.old);
        }
      })
      .subscribe();
  },

  // Utilitaires
  timeAgo(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'À l\'instant';
    if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)}h`;
    if (seconds < 2592000) return `Il y a ${Math.floor(seconds / 86400)}j`;
    return date.toLocaleDateString('fr-FR');
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Lancer l'app au chargement
document.addEventListener('DOMContentLoaded', () => App.init());
