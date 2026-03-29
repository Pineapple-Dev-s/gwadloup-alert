const UI = {
  init() {
    this.nav();
    this.modals();
    this.filters();
    this.form();
    this.burger();
    this.catGrid();
    ImageUpload.init();
  },

  catGrid() {
    const g = document.getElementById('category-grid');
    if (!g) return;
    g.innerHTML = Object.entries(App.categories).map(([k, v]) =>
      `<label class="catc"><input type="radio" name="category" value="${k}"><div class="catc__ico">${v.emoji}</div><div class="catc__name">${v.label}</div></label>`
    ).join('');
    g.addEventListener('change', () => {
      document.getElementById('btn-step1-next').disabled = false;
    });
  },

  nav() {
    // Tab buttons
    const tabs = document.querySelectorAll('.hdr__tab');
    tabs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const view = btn.getAttribute('data-view');
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        // Show view
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById('view-' + view);
        if (target) target.classList.add('active');
        // Side effects
        if (view === 'map' && MapManager.map) {
          setTimeout(() => MapManager.map.invalidateSize(), 150);
        }
        if (view === 'stats') Reports.updateStats();
        if (view === 'wiki') this.loadWiki();
        // Close mobile nav
        document.getElementById('main-nav').classList.remove('open');
        document.getElementById('burger-menu').classList.remove('open');
      });
    });

    // Logo click
    document.getElementById('logo-link').addEventListener('click', (e) => {
      e.preventDefault();
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelector('.hdr__tab[data-view="map"]').classList.add('active');
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById('view-map').classList.add('active');
      if (MapManager.map) setTimeout(() => MapManager.map.invalidateSize(), 150);
    });
  },

  burger() {
    document.getElementById('burger-menu').addEventListener('click', function () {
      this.classList.toggle('open');
      document.getElementById('main-nav').classList.toggle('open');
    });
  },

  modals() {
    // Close buttons — using data-close attribute
    document.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-close') || e.target.closest('[data-close]')) {
        const modal = e.target.closest('.modal');
        if (modal) {
          modal.classList.remove('open');
          document.body.style.overflow = '';
        }
      }
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
        document.body.style.overflow = '';
      }
    });

    // New report button
    document.getElementById('btn-new-report').addEventListener('click', () => {
      if (!App.currentUser) {
        this.toast('Connectez-vous d\'abord', 'warning');
        this.openModal('modal-login');
        return;
      }
      Reports.resetForm();
      this.openModal('modal-report');
      setTimeout(() => MapManager.initMiniMap(), 400);
    });
  },

  openModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  },

  closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('open');
    if (!document.querySelector('.modal.open')) document.body.style.overflow = '';
  },

  filters() {
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
      const s = e.target.value;
      if (s === 'newest') App.reports.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      else if (s === 'oldest') App.reports.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      else App.reports.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
      Reports.renderList();
    });
  },

  form() {
    // Step buttons
    document.getElementById('btn-step1-next').addEventListener('click', () => this.goStep(2));
    document.getElementById('btn-step2-next').addEventListener('click', () => this.goStep(3));

    // Prev buttons
    document.querySelectorAll('[data-prev]').forEach(btn => {
      btn.addEventListener('click', () => this.goStep(parseInt(btn.getAttribute('data-prev'))));
    });

    // Geolocate
    document.getElementById('btn-geolocate').addEventListener('click', () => {
      if (!navigator.geolocation) { this.toast('Non supporté', 'error'); return; }
      const btn = document.getElementById('btn-geolocate');
      btn.disabled = true;
      btn.textContent = 'Localisation...';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (lat < 15.8 || lat > 16.6 || lng < -61.9 || lng > -60.9) {
            this.toast('Hors Guadeloupe — placez le marqueur manuellement', 'warning');
          } else {
            MapManager.setPin(lat, lng);
            MapManager.reverseGeo(lat, lng);
          }
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-crosshairs"></i> Localiser';
        },
        () => {
          this.toast('Localisation impossible', 'warning');
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-crosshairs"></i> Localiser';
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

    // Address search
    let timer;
    const input = document.getElementById('address-search');
    const results = document.getElementById('search-results');

    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 3) { results.classList.remove('open'); return; }
      timer = setTimeout(async () => {
        const data = await MapManager.searchAddr(q);
        if (data.length > 0) {
          results.innerHTML = data.map(r =>
            `<div class="loc-r" data-lat="${r.lat}" data-lon="${r.lon}">${r.display_name}</div>`
          ).join('');
          results.classList.add('open');
        } else {
          results.classList.remove('open');
        }
      }, 400);
    });

    results.addEventListener('click', (e) => {
      const item = e.target.closest('.loc-r');
      if (item && item.dataset.lat) {
        const lat = parseFloat(item.dataset.lat);
        const lon = parseFloat(item.dataset.lon);
        MapManager.setPin(lat, lon);
        MapManager.reverseGeo(lat, lon);
        input.value = item.textContent;
        results.classList.remove('open');
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.loc-search')) results.classList.remove('open');
    });

    // Description counter
    document.getElementById('report-description').addEventListener('input', (e) => {
      document.getElementById('desc-count').textContent = e.target.value.length;
    });

    // Priority
    document.querySelectorAll('.prio').forEach(p => {
      p.addEventListener('click', () => {
        document.querySelectorAll('.prio').forEach(x => x.classList.remove('active'));
        p.classList.add('active');
      });
    });

    // Submit
    document.getElementById('report-form').addEventListener('submit', (e) => {
      e.preventDefault();
      Reports.submitReport();
    });
  },

  goStep(n) {
    document.querySelectorAll('.fstep').forEach(s => s.classList.remove('active'));
    const step = document.getElementById('step-' + n);
    if (step) step.classList.add('active');

    document.querySelectorAll('.steps__i').forEach(s => {
      const num = parseInt(s.getAttribute('data-step'));
      s.classList.remove('active', 'done');
      if (num < n) s.classList.add('done');
      if (num === n) s.classList.add('active');
    });

    if (n === 2 && MapManager.miniMap) {
      setTimeout(() => MapManager.miniMap.invalidateSize(), 150);
    }
  },

  // Wiki
  async loadWiki() {
    try {
      const r = await fetch('/api/wiki');
      const pages = await r.json();
      const nav = document.getElementById('wiki-nav');
      nav.innerHTML = pages.map((p, i) =>
        `<button class="wnav ${i === 0 ? 'active' : ''}" data-page="${p.slug}">${p.title}</button>`
      ).join('');

      nav.addEventListener('click', (e) => {
        const btn = e.target.closest('.wnav');
        if (!btn) return;
        nav.querySelectorAll('.wnav').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadWikiPage(btn.getAttribute('data-page'));
      });

      if (pages.length > 0) this.loadWikiPage(pages[0].slug);
      else document.getElementById('wiki-content').innerHTML = '<p>Aucune page</p>';
    } catch (e) {
      document.getElementById('wiki-content').innerHTML = '<p>Erreur</p>';
    }
  },

  async loadWikiPage(slug) {
    const el = document.getElementById('wiki-content');
    el.innerHTML = '<p class="wiki__load">Chargement...</p>';
    try {
      const r = await fetch('/api/wiki/' + slug);
      if (!r.ok) throw new Error();
      const md = await r.text();
      el.innerHTML = marked.parse(md);
    } catch (e) {
      el.innerHTML = '<p>Page introuvable</p>';
    }
  },

  toast(msg, type) {
    type = type || 'info';
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    const t = document.createElement('div');
    t.className = 'toast toast--' + type;
    t.innerHTML = '<i class="toast__ico fas ' + icons[type] + '"></i><span class="toast__msg">' + msg + '</span><button class="toast__x" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>';
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => {
      if (t.parentElement) {
        t.style.opacity = '0';
        t.style.transform = 'translateX(60px)';
        t.style.transition = '.2s';
        setTimeout(() => t.remove(), 200);
      }
    }, 4000);
  },

  showLoading() { document.getElementById('loading-overlay').classList.add('active'); },
  hideLoading() { document.getElementById('loading-overlay').classList.remove('active'); }
};
