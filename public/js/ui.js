// ============================================
// GWADLOUP ALÈRT — Interface utilisateur
// ============================================

const UI = {
  init() {
    this.bindNavigation();
    this.bindModals();
    this.bindFilters();
    this.bindReportForm();
    this.bindBurgerMenu();
    ImageUpload.init();
  },

  // --- Navigation ---
  bindNavigation() {
    document.querySelectorAll('.header__nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        this.switchView(view);

        // Fermer le menu mobile
        document.getElementById('main-nav').classList.remove('open');
      });
    });

    // Logo → retour carte
    document.getElementById('logo-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.switchView('map');
    });
  },

  switchView(viewName) {
    // Mettre à jour la navigation
    document.querySelectorAll('.header__nav-link').forEach(l => {
      l.classList.toggle('active', l.dataset.view === viewName);
    });

    // Afficher la vue
    document.querySelectorAll('.view').forEach(v => {
      v.classList.toggle('active', v.id === `view-${viewName}`);
    });

    // Redimensionner la carte si nécessaire
    if (viewName === 'map' && MapManager.map) {
      setTimeout(() => MapManager.map.invalidateSize(), 100);
    }

    // Recharger les stats si nécessaire
    if (viewName === 'stats') {
      Reports.updateStats();
    }
  },

  // --- Burger menu ---
  bindBurgerMenu() {
    document.getElementById('burger-menu').addEventListener('click', () => {
      document.getElementById('main-nav').classList.toggle('open');
    });
  },

  // --- Modals ---
  bindModals() {
    // Fermer les modales
    document.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', () => {
        const modal = el.closest('.modal');
        if (modal) modal.classList.remove('open');
      });
    });

    // Touche Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
      }
    });

    // Bouton nouveau signalement
    document.getElementById('btn-new-report').addEventListener('click', () => {
      if (!App.currentUser) {
        this.toast('Connectez-vous pour signaler un problème', 'warning');
        this.openModal('modal-login');
        return;
      }
      Reports.resetForm();
      this.openModal('modal-report');

      // Initialiser la mini carte après un délai (la modale doit être visible)
      setTimeout(() => {
        MapManager.initMiniMap();
      }, 300);
    });
  },

  openModal(id) {
    document.getElementById(id).classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  closeModal(id) {
    document.getElementById(id).classList.remove('open');
    // Vérifier s'il reste des modales ouvertes
    if (!document.querySelector('.modal.open')) {
      document.body.style.overflow = '';
    }
  },

  // --- Filtres ---
  bindFilters() {
    document.getElementById('filter-category').addEventListener('change', (e) => {
      App.filters.category = e.target.value;
      Reports.loadAll();
    });

    document.getElementById('filter-status').addEventListener('change', (e) => {
      App.filters.status = e.target.value;
      Reports.loadAll();
    });

    document.getElementById('filter-commune').addEventListener('change', (e) => {
      App.filters.commune = e.target.value;
      Reports.loadAll();
    });

    document.getElementById('btn-reset-filters').addEventListener('click', () => {
      App.filters = { category: '', status: '', commune: '' };
      document.getElementById('filter-category').value = '';
      document.getElementById('filter-status').value = '';
      document.getElementById('filter-commune').value = '';
      Reports.loadAll();
    });

    // Tri dans la vue liste
    document.getElementById('sort-reports').addEventListener('change', (e) => {
      const sort = e.target.value;
      if (sort === 'newest') {
        App.reports.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      } else if (sort === 'oldest') {
        App.reports.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      } else if (sort === 'most-voted') {
        App.reports.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
      }
      Reports.renderList();
    });
  },

  // --- Formulaire de signalement ---
  bindReportForm() {
    // Sélection de catégorie
    document.querySelectorAll('.category-card').forEach(card => {
      card.addEventListener('click', () => {
        document.getElementById('btn-step1-next').disabled = false;
      });
    });

    // Navigation entre étapes
    document.querySelectorAll('.btn--next').forEach(btn => {
      btn.addEventListener('click', () => {
        const nextStep = parseInt(btn.dataset.next);
        this.goToStep(nextStep);
      });
    });

    document.querySelectorAll('.btn--prev').forEach(btn => {
      btn.addEventListener('click', () => {
        const prevStep = parseInt(btn.dataset.prev);
        this.goToStep(prevStep);
      });
    });

    // Géolocalisation
    document.getElementById('btn-geolocate').addEventListener('click', () => {
      if (!navigator.geolocation) {
        this.toast('La géolocalisation n\'est pas supportée par votre navigateur', 'error');
        return;
      }

      const btn = document.getElementById('btn-geolocate');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-inline" style="border-color:rgba(0,0,0,0.2);border-top-color:var(--primary);"></span> Localisation...';

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;

          // Vérifier que c'est en Guadeloupe
          if (latitude < 15.8 || latitude > 16.6 || longitude < -61.9 || longitude > -60.9) {
            this.toast('Vous ne semblez pas être en Guadeloupe. Placez manuellement le marqueur.', 'warning');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-crosshairs"></i> Me géolocaliser';
            return;
          }

          MapManager.setMiniMapMarker(latitude, longitude);
          MapManager.reverseGeocode(latitude, longitude);

          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-crosshairs"></i> Me géolocaliser';
        },
        (error) => {
          console.error('Erreur géolocalisation:', error);
          this.toast('Impossible de vous géolocaliser. Placez le marqueur manuellement.', 'warning');
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-crosshairs"></i> Me géolocaliser';
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

    // Recherche d'adresse
    let searchTimeout;
    document.getElementById('address-search').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();
      if (query.length < 3) return;

      searchTimeout = setTimeout(async () => {
        const results = await MapManager.searchAddress(query);
        if (results.length > 0) {
          const first = results[0];
          const lat = parseFloat(first.lat);
          const lon = parseFloat(first.lon);
          MapManager.setMiniMapMarker(lat, lon);
          MapManager.reverseGeocode(lat, lon);
        }
      }, 500);
    });

    // Compteur de caractères pour la description
    document.getElementById('report-description').addEventListener('input', (e) => {
      document.getElementById('desc-count').textContent = e.target.value.length;
    });

    // Soumission du formulaire
    document.getElementById('report-form').addEventListener('submit', (e) => {
      e.preventDefault();
      Reports.submitReport();
    });
  },

  goToStep(stepNum) {
    // Masquer toutes les étapes
    document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step-${stepNum}`).classList.add('active');

    // Mettre à jour l'indicateur
    document.querySelectorAll('.step-indicator .step').forEach(s => {
      const num = parseInt(s.dataset.step);
      s.classList.remove('active', 'completed');
      if (num < stepNum) s.classList.add('completed');
      if (num === stepNum) s.classList.add('active');
    });

    // Si on arrive à l'étape 2, redimensionner la mini carte
    if (stepNum === 2 && MapManager.miniMap) {
      setTimeout(() => MapManager.miniMap.invalidateSize(), 100);
    }
  },

  // --- Toast notifications ---
  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');

    const icons = {
      success: 'fas fa-check-circle',
      error: 'fas fa-exclamation-circle',
      warning: 'fas fa-exclamation-triangle',
      info: 'fas fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <i class="toast__icon ${icons[type]}"></i>
      <span class="toast__message">${message}</span>
      <button class="toast__close" onclick="this.closest('.toast').remove()">
        <i class="fas fa-times"></i>
      </button>
    `;

    container.appendChild(toast);

    // Auto-dismiss après 5 secondes
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  },

  // --- Loading ---
  showLoading() {
    document.getElementById('loading-overlay').classList.add('active');
  },

  hideLoading() {
    document.getElementById('loading-overlay').classList.remove('active');
  }
};
