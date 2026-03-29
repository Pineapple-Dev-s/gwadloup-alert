const UI = {
  init() {
    this.bindNavigation();
    this.bindModals();
    this.bindFilters();
    this.bindReportForm();
    this.bindBurgerMenu();
    this.bindCursorGlow();
    this.buildCategoryGrid();
    this.bindPasswordToggle();
    ImageUpload.init();
  },

  // Cursor glow
  bindCursorGlow() {
    const glow = document.getElementById('cursor-glow');
    if (!glow) return;

    document.addEventListener('mousemove', (e) => {
      glow.style.left = e.clientX + 'px';
      glow.style.top = e.clientY + 'px';
    });
  },

  // Password toggle
  bindPasswordToggle() {
    const toggle = document.getElementById('toggle-login-pw');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const input = document.getElementById('login-password');
        const icon = toggle.querySelector('i');
        if (input.type === 'password') {
          input.type = 'text';
          icon.className = 'fas fa-eye-slash';
        } else {
          input.type = 'password';
          icon.className = 'fas fa-eye';
        }
      });
    }
  },

  // Build category grid dynamically
  buildCategoryGrid() {
    const grid = document.getElementById('category-grid');
    if (!grid) return;

    let html = '';
    const grouped = {};

    Object.entries(App.categories).forEach(([key, val]) => {
      if (!grouped[val.group]) grouped[val.group] = [];
      grouped[val.group].push({ key, ...val });
    });

    Object.entries(grouped).forEach(([group, cats]) => {
      cats.forEach(cat => {
        html += `
          <label class="category-card" data-category="${cat.key}">
            <input type="radio" name="category" value="${cat.key}">
            <div class="category-card__icon">${cat.emoji}</div>
            <div class="category-card__name">${cat.label}</div>
          </label>
        `;
      });
    });

    grid.innerHTML = html;
  },

  // Navigation
  bindNavigation() {
    document.querySelectorAll('.header__nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchView(link.dataset.view);
        document.getElementById('main-nav').classList.remove('open');
        document.getElementById('burger-menu').classList.remove('open');
      });
    });

    document.getElementById('logo-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.switchView('map');
    });
  },

  switchView(name) {
    document.querySelectorAll('.header__nav-link').forEach(l => {
      l.classList.toggle('active', l.dataset.view === name);
    });
    document.querySelectorAll('.view').forEach(v => {
      v.classList.toggle('active', v.id === `view-${name}`);
    });
    if (name === 'map' && MapManager.map) {
      setTimeout(() => MapManager.map.invalidateSize(), 100);
    }
    if (name === 'stats') Reports.updateStats();
    if (name === 'list') {
      document.getElementById('list-count').textContent = `${App.reports.length} résultat${App.reports.length > 1 ? 's' : ''}`;
    }
  },

  // Burger
  bindBurgerMenu() {
    const burger = document.getElementById('burger-menu');
    burger.addEventListener('click', () => {
      burger.classList.toggle('open');
      document.getElementById('main-nav').classList.toggle('open');
    });
  },

  // Modals
  bindModals() {
    document.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', () => {
        const modal = el.closest('.modal');
        if (modal) modal.classList.remove('open');
        document.body.style.overflow = '';
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
        document.body.style.overflow = '';
      }
    });

    document.getElementById('btn-new-report').addEventListener('click', () => {
      if (!App.currentUser) {
        this.toast('Connectez-vous pour signaler', 'warning');
        this.openModal('modal-login');
        return;
      }
      Reports.resetForm();
      this.openModal('modal-report');
      setTimeout(() => MapManager.initMiniMap(), 300);
    });
  },

  openModal(id) {
    document.getElementById(id).classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  closeModal(id) {
    document.getElementById(id).classList.remove('open');
    if (!document.querySelector('.modal.open')) {
      document.body.style.overflow = '';
    }
  },

  // Filters
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
    document.getElementById('sort-reports').addEventListener('change', (e) => {
      const sort = e.target.value;
      if (sort === 'newest') App.reports.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      else if (sort === 'oldest') App.reports.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      else if (sort === 'most-voted') App.reports.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
      Reports.renderList();
    });
  },

  // Report form
  bindReportForm() {
    document.getElementById('category-grid').addEventListener('change', () => {
      document.getElementById('btn-step1-next').disabled = false;
    });

    document.querySelectorAll('.btn--next').forEach(btn => {
      btn.addEventListener('click', () => this.goToStep(parseInt(btn.dataset.next)));
    });

    document.querySelectorAll('.btn--prev').forEach(btn => {
      btn.addEventListener('click', () => this.goToStep(parseInt(btn.dataset.prev)));
    });

    // Geolocation
    document.getElementById('btn-geolocate').addEventListener('click', () => {
      if (!navigator.geolocation) {
        this.toast('Géolocalisation non supportée', 'error');
        return;
      }

      const btn = document.getElementById('btn-geolocate');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-inline" style="border-color:rgba(0,0,0,0.15);border-top-color:var(--primary);width:14px;height:14px;"></span> Localisation...';

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          if (latitude < 15.8 || 
