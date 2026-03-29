const UI = {
  init() {
    this.bindNav();
    this.bindModals();
    this.bindFilters();
    this.bindForm();
    this.bindBurger();
    this.buildCatGrid();
    ImageUpload.init();
  },

  buildCatGrid() {
    const grid = document.getElementById('category-grid');
    if (!grid) return;
    grid.innerHTML = Object.entries(App.categories).map(([k, v]) =>
      `<label class="cat-card"><input type="radio" name="category" value="${k}"><div class="cat-card__icon">${v.emoji}</div><div class="cat-card__name">${v.label}</div></label>`
    ).join('');
  },

  bindNav() {
    document.querySelectorAll('.nav__btn').forEach(b => {
      b.addEventListener('click', () => {
        this.switchView(b.dataset.view);
        document.getElementById('main-nav').classList.remove('open');
        document.getElementById('burger-menu').classList.remove('open');
      });
    });
    document.getElementById('logo-link').addEventListener('click', (e) => { e.preventDefault(); this.switchView('map'); });
  },

  switchView(name) {
    document.querySelectorAll('.nav__btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    if (name === 'map' && MapManager.map) setTimeout(() => MapManager.map.invalidateSize(), 100);
    if (name === 'stats') Reports.updateStats();
  },

  bindBurger() {
    const b = document.getElementById('burger-menu');
    b.addEventListener('click', () => { b.classList.toggle('open'); document.getElementById('main-nav').classList.toggle('open'); });
  },

  bindModals() {
    document.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', () => { el.closest('.modal').classList.remove('open'); document.body.style.overflow = ''; });
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open')); document.body.style.overflow = ''; } });
    document.getElementById('btn-new-report').addEventListener('click', () => {
      if (!App.currentUser) { this.toast('Connectez-vous', 'warning'); this.openModal('modal-login'); return; }
      Reports.resetForm();
      this.openModal('modal-report');
      setTimeout(() => MapManager.initMiniMap(), 300);
    });
  },

  openModal(id) { document.getElementById(id).classList.add('open'); document.body.style.overflow = 'hidden'; },
  closeModal(id) { document.getElementById(id).classList.remove('open'); if (!document.querySelector('.modal.open')) document.body.style.overflow = ''; },

  bindFilters() {
    document.getElementById('filter-category').addEventListener('change', (e) => { App.filters.category = e.target.value; Reports.loadAll(); });
    document.getElementById('filter-status').addEventListener('change', (e) => { App.filters.status = e.target.value; Reports.loadAll(); });
    document.getElementById('filter-commune').addEventListener('change', (e) => { App.filters.commune = e.target.value; Reports.loadAll(); });
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
      else if (s === 'most-voted') App.reports.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
      Reports.renderList();
    });
  },

  bindForm() {
    // Category selection
    document.getElementById('category-grid').addEventListener('change', () => {
      document.getElementById('btn-step1-next').disabled = false;
    });

    // Step navigation
    document.getElementById('btn-step1-next').addEventListener('click', () => this.goStep(2));
    document.getElementById('btn-step2-next').addEventListener('click', () => this.goStep(3));
    document.querySelectorAll('[data-prev]').forEach(b => {
      b.addEventListener('click', () => this.goStep(parseInt(b.dataset.prev)));
    });

    // Geolocation
    document.getElementById('btn-geolocate').addEventListener('click', () => {
      if (!navigator.geolocation) { this.toast('Géolocalisation non supportée', 'error'); return; }
      const btn = document.getElementById('btn-geolocate');
      btn.disabled = true; btn.innerHTML = '<span class="spinner" style="border-color:rgba(0,0,0,.15);border-top-color:var(--primary);width:12px;height:12px"></span> Localisation...';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          if (lat < 15.8 || lat > 16.6 || lng < -61.9 || lng > -60.9) this.toast('Vous n\'êtes pas en Guadeloupe', 'warning');
          else { MapManager.setPin(lat, lng); MapManager.reverseGeo(lat, lng); }
          btn.disabled = false; btn.innerHTML = '<i class="fas fa-crosshairs"></i> Me localiser';
        },
        () => { this.toast('Impossible de vous localiser', 'warning'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-crosshairs"></i> Me localiser'; },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

    // Address search
    let st;
    const si = document.getElementById('address-search');
    const sr = document.getElementById('search-results');
    si.addEventListener('input', (e) => {
      clearTimeout(st);
      const q = e.target.value.trim();
      if (q.length < 3) { sr.classList.remove('open'); return; }
      st = setTimeout(async () => {
        const results = await MapManager.searchAddr(q);
        if (results.length > 0) {
          sr.innerHTML = results.map(r => `<div class="loc-result" data-lat="${r.lat}" data-lon="${r.lon}">${r.display_name}</div>`).join('');
          sr.classList.add('open');
        } else { sr.innerHTML = '<div class="loc-result" style="color:var(--text3);cursor:default">Aucun résultat</div>'; sr.classList.add('open'); }
      }, 400);
    });
    sr.addEventListener('click', (e) => {
      const item = e.target.closest('.loc-result');
      if (item?.dataset.lat) {
        MapManager.setPin(parseFloat(item.dataset.lat), parseFloat(item.dataset.lon));
        MapManager.reverseGeo(parseFloat(item.dataset.lat), parseFloat(item.dataset.lon));
        si.value = item.textContent;
        sr.classList.remove('open');
      }
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.loc-search')) sr.classList.remove('open'); });

    // Char count
    document.getElementById('report-description').addEventListener('input', (e) => {
      document.getElementById('desc-count').textContent = e.target.value.length;
    });

    // Priority
    document.querySelectorAll('.prio').forEach(p => {
      p.addEventListener('click', () => { document.querySelectorAll('.prio').forEach(x => x.classList.remove('active')); p.classList.add('active'); });
    });

    // Submit
    document.getElementById('report-form').addEventListener('submit', (e) => { e.preventDefault(); Reports.submitReport(); });
  },

  goStep(n) {
    document.querySelectorAll('.fstep').forEach(s => s.classList.remove('active'));
    document.getElementById(`step-${n}`).classList.add('active');
    document.querySelectorAll('.steps__item').forEach(s => {
      const num = parseInt(s.dataset.step);
      s.classList.remove('active', 'done');
      if (num < n) s.classList.add('done');
      if (num === n) s.classList.add('active');
    });
    if (n === 2 && MapManager.miniMap) setTimeout(() => MapManager.miniMap.invalidateSize(), 100);
  },

  toast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const icons = { success: 'fas fa-check-circle', error: 'fas fa-exclamation-circle', warning: 'fas fa-exclamation-triangle', info: 'fas fa-info-circle' };
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.innerHTML = `<i class="toast__icon ${icons[type]}"></i><span class="toast__msg">${msg}</span><button class="toast__x" onclick="this.closest('.toast').remove()"><i class="fas fa-times"></i></button>`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(80px)'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 300); }, 5000);
  },

  showLoading() { document.getElementById('loading-overlay').classList.add('active'); },
  hideLoading() { document.getElementById('loading-overlay').classList.remove('active'); }
};
