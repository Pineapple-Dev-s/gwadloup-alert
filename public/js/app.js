var App = {
  config: null,
  supabase: null,
  currentUser: null,
  currentProfile: null,
  reports: [],
  filters: { category: '', status: '', commune: '' },

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
    try {
      UI.showLoading();

      // Load config
      var configResp = await fetch('/api/config');
      this.config = await configResp.json();

      // Init Supabase
      this.supabase = window.supabase.createClient(this.config.supabaseUrl, this.config.supabaseAnonKey);

      // Handle auth URL fragments
      var hash = window.location.hash;
      if (hash && hash.indexOf('access_token') !== -1) {
        await new Promise(function(r) { setTimeout(r, 1000); });
        history.replaceState(null, '', window.location.pathname);
        UI.toast('Email confirmé !', 'success');
      } else if (hash && hash.indexOf('error') !== -1) {
        history.replaceState(null, '', window.location.pathname);
      }

      // Init modules
      await Auth.init();
      MapManager.init();
      UI.init();
      await Reports.loadAll();

      // Realtime
      this.supabase.channel('rt')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, function(p) { Reports.handleNew(p.new); })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reports' }, function(p) { Reports.handleUpdate(p.new); })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reports' }, function(p) { Reports.handleDelete(p.old); })
        .subscribe();

      // Auto refresh every 60s
      setInterval(function() {
        if (document.visibilityState === 'visible') Reports.loadAll();
      }, 60000);

      // Optional modules
      if (typeof Share !== 'undefined' && Share.init) Share.init();
      if (typeof PWA !== 'undefined' && PWA.init) PWA.init();

    } catch(e) {
      console.error('App init error:', e);
      UI.toast('Erreur de chargement', 'error');
    }
    UI.hideLoading();
  },

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

document.addEventListener('DOMContentLoaded', function() { App.init(); });
