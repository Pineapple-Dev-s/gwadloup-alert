var UI = {
  catIcons: {
    road: 'fa-road', warning: 'fa-exclamation-triangle', sign: 'fa-sign', marking: 'fa-grip-lines',
    bump: 'fa-minus', car: 'fa-car', boat: 'fa-ship', dump: 'fa-dumpster', beach: 'fa-umbrella-beach',
    river: 'fa-water', bin: 'fa-trash', light: 'fa-lightbulb', cable: 'fa-bolt',
    leak: 'fa-tint', flood: 'fa-house-flood-water', sewer: 'fa-toilet', stagnant: 'fa-droplet',
    plant: 'fa-leaf', tree: 'fa-tree', invasive: 'fa-seedling',
    building: 'fa-building', abandoned: 'fa-house-chimney-crack', sidewalk: 'fa-shoe-prints',
    railing: 'fa-bars', danger: 'fa-skull-crossbones', crosswalk: 'fa-person-walking',
    school: 'fa-school', noise: 'fa-volume-high', animals: 'fa-dog', mosquito: 'fa-mosquito',
    other: 'fa-map-pin'
  },

  init: function() {
    this.nav();
    this.modals();
    this.filters();
    this.form();
    this.burger();
    this.catGrid();
    this.community();
    this.wikiTabs();
    this.wikiWrite();
    this.contactEmail();
    this.listControls();
    this.networkStatus();
    this.createFAB();
    this.checkOnboarding();
  },

  // ═══════════════════════════════════════
  // FAB (Floating Action Button)
  // ═══════════════════════════════════════
  createFAB: function() {
    var fab = document.createElement('button');
    fab.id = 'fab-report';
    fab.className = 'fab-report';
    fab.innerHTML = '<i class="fas fa-plus"></i>';
    fab.title = 'Nouveau signalement';
    fab.addEventListener('click', function() {
      UI.openReportForm();
    });
    document.body.appendChild(fab);
  },

  // ═══════════════════════════════════════
  // ONBOARDING
  // ═══════════════════════════════════════
  checkOnboarding: function() {
    if (localStorage.getItem('gwad-onboarded')) return;
    setTimeout(function() { UI.showOnboarding(); }, 2000);
  },

  showOnboarding: function() {
    var overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.innerHTML =
      '<div class="onb">' +
        '<div class="onb__steps" id="onb-steps">' +
          '<div class="onb__step active" id="onb-step-1">' +
            '<div class="onb__icon">🗺️</div>' +
            '<h2>Bienvenue sur Gwadloup Alert !</h2>' +
            '<p>La carte interactive de la Guadeloupe affiche tous les signalements de la communauté en temps réel.</p>' +
            '<div class="onb__dots"><span class="active"></span><span></span><span></span></div>' +
            '<button class="btn btn--primary btn--lg onb__next" onclick="UI.onbNext(2)">Suivant</button>' +
          '</div>' +
          '<div class="onb__step" id="onb-step-2">' +
            '<div class="onb__icon">📍</div>' +
            '<h2>Signalez un problème</h2>' +
            '<p>Cliquez sur <strong style="color:var(--green)">+ Signaler</strong> pour créer un signalement. Vous pouvez signaler <strong>même sans compte</strong> (anonyme) !</p>' +
            '<div class="onb__dots"><span></span><span class="active"></span><span></span></div>' +
            '<div style="display:flex;gap:8px;justify-content:center"><button class="btn btn--ghost" onclick="UI.onbNext(1)">Retour</button><button class="btn btn--primary btn--lg onb__next" onclick="UI.onbNext(3)">Suivant</button></div>' +
          '</div>' +
          '<div class="onb__step" id="onb-step-3">' +
            '<div class="onb__icon">🤝</div>' +
            '<h2>Soutenez & participez</h2>' +
            '<p>Votez pour les signalements importants, commentez, contribuez au wiki. Inscrivez-vous pour gagner des <strong style="color:var(--yellow)">badges</strong> et de la <strong style="color:var(--green)">réputation</strong> !</p>' +
            '<div class="onb__dots"><span></span><span></span><span class="active"></span></div>' +
            '<button class="btn btn--primary btn--lg onb__next" onclick="UI.closeOnboarding()"><i class="fas fa-rocket"></i> C\'est parti !</button>' +
          '</div>' +
        '</div>' +
        '<button class="onb__skip" onclick="UI.closeOnboarding()">Passer</button>' +
      '</div>';
    document.body.appendChild(overlay);
  },

  onbNext: function(step) {
    var steps = document.querySelectorAll('.onb__step');
    for (var i = 0; i < steps.length; i++) steps[i].classList.remove('active');
    var target = document.getElementById('onb-step-' + step);
    if (target) target.classList.add('active');
  },

  closeOnboarding: function() {
    localStorage.setItem('gwad-onboarded', '1');
    var overlay = document.getElementById('onboarding-overlay');
    if (overlay) overlay.remove();
  },

  // ═══════════════════════════════════════
  // OPEN REPORT FORM
  // ═══════════════════════════════════════
  openReportForm: function() {
    // Update anon notice visibility
    var anonNotice = document.getElementById('anon-notice');
    if (anonNotice) anonNotice.style.display = App.currentUser ? 'none' : 'block';
    var photoField = document.getElementById('photo-field');
    if (photoField) photoField.style.display = App.currentUser ? '' : 'none';

    // Reset form to step 1
    this._goStep(1);

    // Reset fields
    var form = document.getElementById('report-form');
    if (form) form.reset();
    var locInfo = document.getElementById('location-info');
    if (locInfo) locInfo.style.display = 'none';
    document.getElementById('report-lat').value = '';
    document.getElementById('report-lng').value = '';
    var step2Next = document.getElementById('btn-step2-next');
    if (step2Next) step2Next.disabled = true;
    var step1Next = document.getElementById('btn-step1-next');
    if (step1Next) step1Next.disabled = true;

    // Reset selected categories
    var cats = document.querySelectorAll('.catc');
    for (var i = 0; i < cats.length; i++) cats[i].classList.remove('selected');

    if (typeof ImageUpload !== 'undefined') ImageUpload.reset();

    UI.openModal('modal-report');
  },

  // ═══════════════════════════════════════
  // BANNER
  // ═══════════════════════════════════════
  renderBanner: function(banner) {
    if (!banner) return;
    var old = document.getElementById('site-banner');
    if (old) old.remove();
    if (localStorage.getItem('banner-dismissed-' + banner.id)) return;

    var colors = { info: 'var(--blue)', warning: 'var(--orange)', error: 'var(--red)', success: 'var(--green)' };
    var color = colors[banner.type] || colors.info;
    var el = document.createElement('div');
    el.id = 'site-banner';
    el.style.cssText = 'background:' + color + '15;border-bottom:1px solid ' + color + '30;padding:10px 20px;text-align:center;font-size:.82rem;color:' + color + ';position:relative;z-index:999;display:flex;align-items:center;justify-content:center;gap:10px';
    el.innerHTML = '<span>' + App.esc(banner.message) + '</span>' +
      (banner.link ? '<a href="' + App.esc(banner.link) + '" style="color:' + color + ';font-weight:700">' + App.esc(banner.link_text || 'En savoir plus') + '</a>' : '') +
      '<button onclick="UI.dismissBanner(\'' + banner.id + '\')" style="background:none;border:none;color:' + color + ';cursor:pointer;font-size:1rem;padding:2px 6px;margin-left:auto"><i class="fas fa-times"></i></button>';

    var main = document.querySelector('.main');
    if (main) main.parentNode.insertBefore(el, main);
  },

  dismissBanner: function(id) {
    localStorage.setItem('banner-dismissed-' + id, '1');
    var el = document.getElementById('site-banner');
    if (el) el.remove();
  },

  showBannerAdmin: function() {
    return '<div style="margin-bottom:16px;padding:14px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r)">' +
      '<h4 style="font-size:.82rem;margin-bottom:8px"><i class="fas fa-bullhorn" style="color:var(--orange)"></i> Bannière du site</h4>' +
      '<div class="field"><input type="text" class="inp" id="admin-banner-msg" placeholder="Message de la bannière..." maxlength="300"></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
        '<select class="sel" id="admin-banner-type"><option value="info">Info</option><option value="warning">Attention</option><option value="success">Succès</option><option value="error">Erreur</option></select>' +
        '<button class="btn btn--primary" onclick="UI.publishBanner()"><i class="fas fa-paper-plane"></i> Publier</button>' +
      '</div></div>';
  },

  publishBanner: async function() {
    var msg = document.getElementById('admin-banner-msg');
    var type = document.getElementById('admin-banner-type');
    if (!msg || !msg.value.trim()) { UI.toast('Message requis', 'warning'); return; }
    try {
      await App.supabase.from('site_banners').update({ active: false }).eq('active', true);
      var result = await App.supabase.from('site_banners').insert({
        message: msg.value.trim(),
        type: type ? type.value : 'info',
        active: true,
        created_by: App.currentUser.id
      }).select().single();
      if (result.data) {
        App.banner = result.data;
        this.renderBanner(result.data);
        UI.toast('Bannière publiée', 'success');
        msg.value = '';
      }
    } catch(e) { UI.toast('Erreur', 'error'); }
  },

  // ═══════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════
  nav: function() {
    var tabs = document.querySelectorAll('.hdr__tab');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        var view = tab.getAttribute('data-view');

        tabs.forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');

        document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
        var target = document.getElementById('view-' + view);
        if (target) target.classList.add('active');

        // Close burger
        var nav = document.getElementById('main-nav');
        var burger = document.getElementById('burger-menu');
        if (nav) nav.classList.remove('open');
        if (burger) burger.classList.remove('open');

        // View-specific actions
        if (view === 'map' && typeof MapManager !== 'undefined' && MapManager.map) {
          setTimeout(function() { MapManager.map.invalidateSize(); }, 200);
        }
        if (view === 'stats' && typeof Reports !== 'undefined') {
          Reports.updateStats();
        }
        if (view === 'wiki') {
          UI.loadWikiStatic();
          UI.loadCommunityArticles();
        }

        // FAB visibility
        var fab = document.getElementById('fab-report');
        if (fab) fab.style.display = (view === 'map' || view === 'list') ? '' : 'none';
      });
    });

    // Logo link
    var logo = document.getElementById('logo-link');
    if (logo) {
      logo.addEventListener('click', function(e) {
        e.preventDefault();
        var mapTab = document.querySelector('[data-view="map"]');
        if (mapTab) mapTab.click();
      });
    }
  },

  // ═══════════════════════════════════════
  // MODALS
  // ═══════════════════════════════════════
  modals: function() {
    document.querySelectorAll('[data-close]').forEach(function(el) {
      el.addEventListener('click', function() {
        var modal = el.closest('.modal');
        if (modal) modal.classList.remove('open');
      });
    });
  },

  openModal: function(id) {
    var modal = document.getElementById(id);
    if (modal) modal.classList.add('open');
  },

  closeModal: function(id) {
    var modal = document.getElementById(id);
    if (modal) modal.classList.remove('open');
  },

  // ═══════════════════════════════════════
  // FILTERS
  // ═══════════════════════════════════════
  filters: function() {
    var catFilter = document.getElementById('filter-category');
    var statusFilter = document.getElementById('filter-status');
    var communeFilter = document.getElementById('filter-commune');
    var resetBtn = document.getElementById('btn-reset-filters');

    function applyFilters() {
      App.filters.category = catFilter ? catFilter.value : '';
      App.filters.status = statusFilter ? statusFilter.value : '';
      App.filters.commune = communeFilter ? communeFilter.value : '';
      if (typeof Reports !== 'undefined') Reports.loadAll();
    }

    if (catFilter) catFilter.addEventListener('change', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (communeFilter) communeFilter.addEventListener('change', applyFilters);
    if (resetBtn) {
      resetBtn.addEventListener('click', function() {
        if (catFilter) catFilter.value = '';
        if (statusFilter) statusFilter.value = '';
        if (communeFilter) communeFilter.value = '';
        applyFilters();
      });
    }
  },

  // ═══════════════════════════════════════
  // LIST CONTROLS
  // ═══════════════════════════════════════
  listControls: function() {
    var toggleBtn = document.getElementById('btn-toggle-view');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function() {
        if (typeof Reports === 'undefined') return;
        Reports.viewMode = Reports.viewMode === 'list' ? 'cards' : 'list';
        toggleBtn.innerHTML = Reports.viewMode === 'cards' ? '<i class="fas fa-list"></i>' : '<i class="fas fa-th-large"></i>';
        Reports.renderList();
      });
    }

    var sortSelect = document.getElementById('sort-reports');
    if (sortSelect) {
      sortSelect.addEventListener('change', function() {
        if (typeof Reports !== 'undefined') Reports.renderList();
      });
    }

    // List header tabs
    document.querySelectorAll('.list-header__tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.list-header__tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var filter = tab.getAttribute('data-filter');
        App.filters.status = filter;
        var statusFilter = document.getElementById('filter-status');
        if (statusFilter) statusFilter.value = filter;
        if (typeof Reports !== 'undefined') Reports.loadAll();
      });
    });
  },

  // ═══════════════════════════════════════
  // FORM (report creation)
  // ═══════════════════════════════════════
  form: function() {
    var self = this;

    // Header signaler button
    var btnNewReport = document.getElementById('btn-new-report');
    if (btnNewReport) {
      btnNewReport.addEventListener('click', function() {
        self.openReportForm();
      });
    }

    // Step navigation
    var step1Next = document.getElementById('btn-step1-next');
    if (step1Next) step1Next.addEventListener('click', function() { self._goStep(2); });

    var step2Next = document.getElementById('btn-step2-next');
    if (step2Next) step2Next.addEventListener('click', function() { self._goStep(3); });

    document.querySelectorAll('[data-prev]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self._goStep(parseInt(btn.getAttribute('data-prev')));
      });
    });

    // Geolocation
    var geoBtn = document.getElementById('btn-geolocate');
    if (geoBtn) {
      geoBtn.addEventListener('click', function() {
        if (!navigator.geolocation) { UI.toast('Géolocalisation non disponible', 'warning'); return; }
        geoBtn.disabled = true; geoBtn.innerHTML = '<span class="spinner"></span> Localisation...';
        navigator.geolocation.getCurrentPosition(function(pos) {
          var lat = pos.coords.latitude;
          var lng = pos.coords.longitude;
          if (typeof MapManager !== 'undefined' && MapManager.isInGuadeloupe(lat, lng)) {
            MapManager.setPin(lat, lng);
            MapManager.reverseGeo(lat, lng);
          } else {
            UI.toast('Vous n\'êtes pas en Guadeloupe', 'warning');
          }
          geoBtn.disabled = false; geoBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Localiser';
        }, function() {
          UI.toast('Impossible de vous localiser', 'error');
          geoBtn.disabled = false; geoBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Localiser';
        }, { enableHighAccuracy: true, timeout: 10000 });
      });
    }

    // Address search
    var searchInput = document.getElementById('address-search');
    var searchResults = document.getElementById('search-results');
    var searchTimeout = null;
    if (searchInput && searchResults) {
      searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        var q = searchInput.value.trim();
        if (q.length < 3) { searchResults.classList.remove('open'); return; }
        searchTimeout = setTimeout(function() {
          if (typeof MapManager !== 'undefined') {
            MapManager.searchAddr(q).then(function(results) {
              if (results.length === 0) { searchResults.classList.remove('open'); return; }
              var html = '';
              for (var i = 0; i < results.length; i++) {
                html += '<div class="loc-r" data-lat="' + results[i].lat + '" data-lng="' + results[i].lon + '">' + App.esc(results[i].display_name) + '</div>';
              }
              searchResults.innerHTML = html;
              searchResults.classList.add('open');
              searchResults.querySelectorAll('.loc-r').forEach(function(r) {
                r.addEventListener('click', function() {
                  var lat = parseFloat(r.getAttribute('data-lat'));
                  var lng = parseFloat(r.getAttribute('data-lng'));
                  MapManager.setPin(lat, lng);
                  MapManager.reverseGeo(lat, lng);
                  searchResults.classList.remove('open');
                  searchInput.value = r.textContent;
                });
              });
            });
          }
        }, 400);
      });
    }

    // Description char count
    var descInput = document.getElementById('report-description');
    var descCount = document.getElementById('desc-count');
    if (descInput && descCount) {
      descInput.addEventListener('input', function() {
        descCount.textContent = descInput.value.length;
      });
    }

    // Priority selection
    document.querySelectorAll('.prio').forEach(function(prio) {
      prio.addEventListener('click', function() {
        document.querySelectorAll('.prio').forEach(function(p) { p.classList.remove('selected'); });
        prio.classList.add('selected');
        var input = prio.querySelector('input');
        if (input) input.checked = true;
      });
    });

    // Form submit
    var reportForm = document.getElementById('report-form');
    if (reportForm) {
      reportForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (typeof Reports !== 'undefined') Reports.submitReport();
      });
    }
  },

  _goStep: function(step) {
    // Update step indicators
    document.querySelectorAll('.steps__i').forEach(function(s) {
      var sNum = parseInt(s.getAttribute('data-step'));
      s.classList.remove('active', 'done');
      if (sNum < step) s.classList.add('done');
      else if (sNum === step) s.classList.add('active');
    });

    // Show/hide step content
    document.querySelectorAll('.fstep').forEach(function(s) { s.classList.remove('active'); });
    var target = document.getElementById('step-' + step);
    if (target) target.classList.add('active');

    // Init minimap on step 2
    if (step === 2 && typeof MapManager !== 'undefined') {
      MapManager.initMiniMap();
    }
  },

  // ═══════════════════════════════════════
  // CATEGORY GRID
  // ═══════════════════════════════════════
  catGrid: function() {
    var grid = document.getElementById('category-grid');
    if (!grid) return;

    var html = '';
    var keys = Object.keys(App.categories);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var cat = App.categories[key];
      var fa = this.catIcons[cat.icon] || 'fa-map-pin';
      html += '<label class="catc" data-cat="' + key + '">' +
        '<input type="radio" name="category" value="' + key + '">' +
        '<span class="catc__ico"><i class="fas ' + fa + '"></i></span>' +
        '<span class="catc__name">' + cat.label + '</span></label>';
    }
    grid.innerHTML = html;

    // Selection handling (no :has() needed)
    grid.querySelectorAll('.catc').forEach(function(catEl) {
      catEl.addEventListener('click', function() {
        grid.querySelectorAll('.catc').forEach(function(c) { c.classList.remove('selected'); });
        catEl.classList.add('selected');
        var step1Next = document.getElementById('btn-step1-next');
        if (step1Next) step1Next.disabled = false;
      });
    });
  },

  // ═══════════════════════════════════════
  // BURGER (mobile menu)
  // ═══════════════════════════════════════
  burger: function() {
    var burgerBtn = document.getElementById('burger-menu');
    var nav = document.getElementById('main-nav');
    if (burgerBtn && nav) {
      burgerBtn.addEventListener('click', function() {
        burgerBtn.classList.toggle('open');
        nav.classList.toggle('open');
      });
    }
  },

  // ═══════════════════════════════════════
  // COMMUNITY (tags)
  // ═══════════════════════════════════════
  community: function() {
    var proposeBtn = document.getElementById('btn-propose-tag');
    var formContainer = document.getElementById('tag-proposal-form-container');
    var cancelBtn = document.getElementById('tp-cancel');
    var form = document.getElementById('tag-proposal-form');

    if (proposeBtn && formContainer) {
      proposeBtn.addEventListener('click', function() {
        if (!App.currentUser) { UI.toast('Connectez-vous pour proposer', 'warning'); return; }
        formContainer.style.display = formContainer.style.display === 'none' ? 'block' : 'none';
      });
    }
    if (cancelBtn && formContainer) {
      cancelBtn.addEventListener('click', function() { formContainer.style.display = 'none'; });
    }
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        UI.submitTagProposal();
      });
    }

    this.loadTagProposals();
  },

  submitTagProposal: async function() {
    if (!App.currentUser || !App.currentProfile) return;
    var name = document.getElementById('tp-name').value.trim();
    var icon = document.getElementById('tp-icon').value.trim() || 'fa-tag';
    var desc = document.getElementById('tp-description').value.trim();
    if (!name || !desc) { UI.toast('Remplissez tous les champs', 'warning'); return; }
    try {
      var result = await App.supabase.from('tag_proposals').insert({
        name: name, icon: icon, description: desc,
        author_id: App.currentUser.id,
        author_name: App.currentProfile.username || 'Anonyme'
      });
      if (result.error) throw result.error;
      UI.toast('Proposition envoyée !', 'success');
      document.getElementById('tag-proposal-form').reset();
      document.getElementById('tag-proposal-form-container').style.display = 'none';
      this.loadTagProposals();
    } catch(e) { UI.toast('Erreur: ' + (e.message || 'Échec'), 'error'); }
  },

  loadTagProposals: async function() {
    var el = document.getElementById('tag-proposals-list');
    if (!el || !App.supabase) return;
    try {
      var result = await App.supabase.from('tag_proposals').select('*').order('upvotes', { ascending: false }).limit(20);
      if (!result.data || result.data.length === 0) { el.innerHTML = '<p style="color:var(--text3);font-size:.8rem">Aucune proposition pour le moment</p>'; return; }
      var html = '';
      for (var i = 0; i < result.data.length; i++) {
        var t = result.data[i];
        html += '<div style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--bg3);border-radius:var(--r);margin-bottom:6px">' +
          '<i class="fas ' + App.esc(t.icon || 'fa-tag') + '" style="font-size:1rem;color:var(--green);width:20px;text-align:center"></i>' +
          '<div style="flex:1"><div style="font-weight:600;font-size:.82rem">' + App.esc(t.name) + '</div><div style="font-size:.72rem;color:var(--text2)">' + App.esc(t.description) + '</div><div style="font-size:.65rem;color:var(--text3)">par ' + App.esc(t.author_name) + '</div></div>' +
          '<button class="btn btn--outline" onclick="UI.voteTagProposal(\'' + t.id + '\')" style="font-size:.7rem"><i class="fas fa-arrow-up"></i> ' + (t.upvotes || 0) + '</button></div>';
      }
      el.innerHTML = html;
    } catch(e) { el.innerHTML = '<p style="color:var(--text3);font-size:.8rem">Erreur</p>'; }
  },

  voteTagProposal: async function(id) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    try {
      var existing = await App.supabase.from('tag_votes').select('id').eq('user_id', App.currentUser.id).eq('proposal_id', id).maybeSingle();
      if (existing.data) { UI.toast('Déjà voté', 'info'); return; }
      await App.supabase.from('tag_votes').insert({ user_id: App.currentUser.id, proposal_id: id });
      var allVotes = await App.supabase.from('tag_votes').select('id').eq('proposal_id', id);
      var count = (allVotes.data && allVotes.data.length) || 0;
      await App.supabase.from('tag_proposals').update({ upvotes: count }).eq('id', id);
      UI.toast('Vote enregistré !', 'success');
      this.loadTagProposals();
    } catch(e) { UI.toast('Erreur', 'error'); }
  },

  // ═══════════════════════════════════════
  // WIKI
  // ═══════════════════════════════════════
  wikiTabs: function() {
    document.querySelectorAll('.wiki-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.wiki-tab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.wiki-panel').forEach(function(p) { p.classList.remove('active'); });
        tab.classList.add('active');
        var panel = document.getElementById('wpanel-' + tab.getAttribute('data-wtab'));
        if (panel) panel.classList.add('active');
      });
    });

    // Wiki filters
    var catFilter = document.getElementById('wiki-cat-filter');
    var sortFilter = document.getElementById('wiki-sort');
    if (catFilter) catFilter.addEventListener('change', function() { UI.loadCommunityArticles(); });
    if (sortFilter) sortFilter.addEventListener('change', function() { UI.loadCommunityArticles(); });
  },

  loadWikiStatic: async function() {
    var nav = document.getElementById('wiki-nav');
    var content = document.getElementById('wiki-content');
    if (!nav) return;
    try {
      var resp = await fetch('/api/wiki-static');
      var pages = await resp.json();
      if (pages.length === 0) { nav.innerHTML = '<p style="font-size:.8rem;color:var(--text3)">Aucune page</p>'; return; }
      var html = '';
      for (var i = 0; i < pages.length; i++) {
        html += '<button class="wnav' + (i === 0 ? ' active' : '') + '" data-slug="' + pages[i].slug + '">' + App.esc(pages[i].title) + '</button>';
      }
      nav.innerHTML = html;
      // Load first page
      if (pages.length > 0) this._loadWikiPage(pages[0].slug);
      // Click handlers
      nav.querySelectorAll('.wnav').forEach(function(btn) {
        btn.addEventListener('click', function() {
          nav.querySelectorAll('.wnav').forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
          UI._loadWikiPage(btn.getAttribute('data-slug'));
        });
      });
    } catch(e) {}
  },

  _loadWikiPage: async function(slug) {
    var content = document.getElementById('wiki-content');
    if (!content) return;
    try {
      var resp = await fetch('/api/wiki-static/' + slug);
      var md = await resp.text();
      if (typeof marked !== 'undefined') {
        content.innerHTML = marked.parse(md);
      } else {
        content.innerHTML = '<pre>' + App.esc(md) + '</pre>';
      }
    } catch(e) {
      content.innerHTML = '<p style="color:var(--text3)">Erreur de chargement</p>';
    }
  },

  loadCommunityArticles: async function() {
    var el = document.getElementById('community-articles-list');
    if (!el || !App.supabase) return;
    try {
      var catFilter = document.getElementById('wiki-cat-filter');
      var sortFilter = document.getElementById('wiki-sort');
      var cat = catFilter ? catFilter.value : '';
      var sort = sortFilter ? sortFilter.value : 'newest';

      var query = App.supabase.from('wiki_articles').select('*');
      if (cat) query = query.eq('category', cat);
      if (sort === 'popular') query = query.order('upvotes', { ascending: false });
      else query = query.order('created_at', { ascending: false });
      query = query.limit(30);

      var result = await query;
      if (!result.data || result.data.length === 0) {
        el.innerHTML = '<div class="empty"><i class="fas fa-pen-fancy"></i><h3>Aucun article</h3><p>Soyez le premier à écrire !</p></div>';
        return;
      }
      var catLabels = { general: '📌 Général', guide: '📖 Guide', info: 'ℹ️ Info', discussion: '💬 Discussion', proposition: '💡 Proposition' };
      var html = '';
      for (var i = 0; i < result.data.length; i++) {
        var a = result.data[i];
        var preview = (a.content || '').replace(/[#*\-\[\]()>`]/g, '').substring(0, 120);
        html += '<div class="wcard" onclick="UI.openArticle(\'' + a.id + '\')">' +
          '<div class="wcard__head"><span class="wcard__cat">' + (catLabels[a.category] || '📌 Général') + '</span><span class="wcard__date">' + App.ago(a.created_at) + '</span></div>' +
          '<div class="wcard__title">' + App.esc(a.title) + '</div>' +
          '<div class="wcard__preview">' + App.esc(preview) + '</div>' +
          '<div class="wcard__foot"><span class="wcard__author"><i class="fas fa-user"></i> ' + App.esc(a.author_name) + '</span><span class="wcard__votes"><i class="fas fa-arrow-up"></i> ' + (a.upvotes || 0) + '</span></div></div>';
      }
      el.innerHTML = html;
    } catch(e) { el.innerHTML = '<p style="color:var(--text3)">Erreur</p>'; }
  },

  openArticle: async function(id) {
    var container = document.getElementById('wiki-article-detail');
    if (!container || !App.supabase) return;

    try {
      // Increment views
      await App.supabase.rpc('increment_wiki_views', { article_id: id }).catch(function() {
        // If RPC doesn't exist, manual update
        App.supabase.from('wiki_articles').select('views').eq('id', id).single().then(function(r) {
          if (r.data) App.supabase.from('wiki_articles').update({ views: (r.data.views || 0) + 1 }).eq('id', id);
        });
      });

      var result = await App.supabase.from('wiki_articles').select('*').eq('id', id).single();
      if (!result.data) { UI.toast('Article introuvable', 'error'); return; }
      var a = result.data;

      var isAuthor = App.currentUser && a.author_id === App.currentUser.id;
      var isAdmin = App.currentProfile && App.currentProfile.role === 'admin';

      // Check if voted
      var hasVoted = false;
      if (App.currentUser) {
        var voteCheck = await App.supabase.from('wiki_votes').select('id').eq('article_id', id).eq('user_id', App.currentUser.id).maybeSingle();
        if (voteCheck.data) hasVoted = true;
      }

      // Get vote count
      var voteCount = await App.supabase.from('wiki_votes').select('id').eq('article_id', id);
      var votes = (voteCount.data && voteCount.data.length) || 0;

      var contentHtml = '';
      if (typeof marked !== 'undefined') {
        contentHtml = marked.parse(a.content || '');
      } else {
        contentHtml = '<pre>' + App.esc(a.content) + '</pre>';
      }

      var pollHtml = '';
      if (typeof Polls !== 'undefined' && a.poll_data) {
        pollHtml = Polls.renderPoll(a.poll_data, id);
      }

      var html = '<div style="padding:24px">' +
        '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">' +
          '<span class="badge badge--cat">' + App.esc(a.category || 'general') + '</span>' +
          '<span style="font-size:.72rem;color:var(--text3)"><i class="fas fa-eye"></i> ' + (a.views || 0) + ' vues</span>' +
          '<span style="font-size:.72rem;color:var(--text3)"><i class="fas fa-clock"></i> ' + App.ago(a.created_at) + '</span>' +
        '</div>' +
        '<h1 style="font-size:1.4rem;font-weight:700;margin-bottom:16px">' + App.esc(a.title) + '</h1>' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;font-size:.82rem;color:var(--text2)">' +
          '<span onclick="UI.openPublicProfile(\'' + a.author_id + '\')" style="cursor:pointer;text-decoration:underline dotted"><i class="fas fa-user" style="color:var(--green)"></i> ' + App.esc(a.author_name) + '</span>' +
        '</div>' +
        '<div class="wiki__body" style="border:none;padding:0">' + contentHtml + '</div>' +
        pollHtml +
        '<div style="display:flex;gap:8px;margin-top:20px;padding-top:14px;border-top:1px solid var(--border)">' +
          '<button class="vote-btn' + (hasVoted ? ' voted' : '') + '" onclick="UI.voteArticle(\'' + id + '\')"><i class="fas fa-arrow-up"></i> ' + votes + '</button>' +
          '<button class="btn btn--outline" onclick="Share.shareArticle(\'' + id + '\',\'' + App.esc(a.title).replace(/'/g, "\\'") + '\')"><i class="fas fa-share-alt"></i> Partager</button>' +
          ((isAuthor || isAdmin) ? '<button class="btn btn--danger" onclick="UI.deleteArticle(\'' + id + '\')"><i class="fas fa-trash"></i></button>' : '') +
        '</div>';

      // Comments
      html += '<div class="comments" style="margin-top:20px"><div class="comments__title"><i class="fas fa-comments"></i> Commentaires</div>';
      if (App.currentUser) {
        html += '<div class="cmtform"><textarea id="wiki-comment-' + id + '" placeholder="Votre commentaire..." rows="2"></textarea><button class="btn btn--primary" onclick="UI.addWikiComment(\'' + id + '\')"><i class="fas fa-paper-plane"></i></button></div>';
      }
      html += '<div id="wiki-comments-' + id + '"></div></div></div>';

      container.innerHTML = html;
      UI.openModal('modal-wiki-article');
      this.loadWikiComments(id);
    } catch(e) { console.error('Open article error:', e); UI.toast('Erreur', 'error'); }
  },

  voteArticle: async function(id) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    try {
      var existing = await App.supabase.from('wiki_votes').select('id').eq('article_id', id).eq('user_id', App.currentUser.id).maybeSingle();
      if (existing.data) {
        await App.supabase.from('wiki_votes').delete().eq('id', existing.data.id);
        UI.toast('Vote retiré', 'info');
      } else {
        await App.supabase.from('wiki_votes').insert({ article_id: id, user_id: App.currentUser.id });
        UI.toast('Merci !', 'success');
      }
      var allVotes = await App.supabase.from('wiki_votes').select('id').eq('article_id', id);
      var count = (allVotes.data && allVotes.data.length) || 0;
      await App.supabase.from('wiki_articles').update({ upvotes: count }).eq('id', id);
      this.openArticle(id);
    } catch(e) { UI.toast('Erreur', 'error'); }
  },

  deleteArticle: async function(id) {
    if (!confirm('Supprimer cet article ?')) return;
    try {
      await App.supabase.from('wiki_comments').delete().eq('article_id', id);
      await App.supabase.from('wiki_votes').delete().eq('article_id', id);
      await App.supabase.from('wiki_articles').delete().eq('id', id);
      UI.toast('Article supprimé', 'success');
      UI.closeModal('modal-wiki-article');
      this.loadCommunityArticles();
    } catch(e) { UI.toast('Erreur', 'error'); }
  },

  loadWikiComments: async function(articleId) {
    var el = document.getElementById('wiki-comments-' + articleId);
    if (!el) return;
    try {
      var result = await App.supabase.from('wiki_comments').select('*, profiles(username)').eq('article_id', articleId).order('created_at', { ascending: true });
      if (!result.data || result.data.length === 0) { el.innerHTML = '<p style="color:var(--text3);font-size:.8rem;padding:10px">Aucun commentaire</p>'; return; }

      // Build tree
      var roots = [];
      var childMap = {};
      for (var i = 0; i < result.data.length; i++) {
        var c = result.data[i];
        if (!c.reply_to) { roots.push(c); }
        else {
          if (!childMap[c.reply_to]) childMap[c.reply_to] = [];
          childMap[c.reply_to].push(c);
        }
      }

      var self = this;
      function renderComment(c, depth) {
        if (depth > 4) return '';
        var name = (c.profiles && c.profiles.username) || 'Anonyme';
        var html = '<div class="cmt" style="margin-left:' + (depth * 20) + 'px">' +
          '<div class="cmt__av">' + name.charAt(0).toUpperCase() + '</div>' +
          '<div class="cmt__body"><div class="cmt__head"><span class="cmt__author" onclick="UI.openPublicProfile(\'' + c.user_id + '\')">' + App.esc(name) + '</span><span class="cmt__date">' + App.ago(c.created_at) + '</span></div>' +
          '<div class="cmt__text">' + App.esc(c.content) + '</div>';
        if (App.currentUser && depth < 4) {
          html += '<button style="font-size:.65rem;color:var(--text3);background:none;border:none;cursor:pointer;margin-top:2px" onclick="UI.replyWikiComment(\'' + articleId + '\',\'' + c.id + '\')"><i class="fas fa-reply"></i> Répondre</button>';
        }
        html += '</div></div>';
        // Children
        var children = childMap[c.id] || [];
        for (var j = 0; j < children.length; j++) {
          html += renderComment(children[j], depth + 1);
        }
        return html;
      }

      var html = '';
      for (var i = 0; i < roots.length; i++) {
        html += renderComment(roots[i], 0);
      }
      el.innerHTML = html;
    } catch(e) { el.innerHTML = '<p style="color:var(--text3)">Erreur</p>'; }
  },

  addWikiComment: async function(articleId, replyTo) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    var inputId = replyTo ? 'wiki-reply-' + replyTo : 'wiki-comment-' + articleId;
    var input = document.getElementById(inputId);
    if (!input) return;
    var content = input.value.trim();
    if (!content || content.length < 2) { UI.toast('Trop court', 'warning'); return; }
    try {
      var data = { article_id: articleId, user_id: App.currentUser.id, content: content };
      if (replyTo) data.reply_to = replyTo;
      var result = await App.supabase.from('wiki_comments').insert(data);
      if (result.error) throw result.error;
      input.value = '';
      UI.toast('Commentaire ajouté', 'success');
      this.loadWikiComments(articleId);
    } catch(e) { UI.toast('Erreur', 'error'); }
  },

  replyWikiComment: function(articleId, commentId) {
    var existing = document.getElementById('wiki-reply-' + commentId);
    if (existing) { existing.parentElement.remove(); return; }
    var cmtEl = document.querySelector('.cmt [onclick*="' + commentId + '"]');
    if (!cmtEl) return;
    var parent = cmtEl.closest('.cmt');
    var replyDiv = document.createElement('div');
    replyDiv.style.cssText = 'display:flex;gap:6px;margin-top:6px;margin-left:38px';
    replyDiv.innerHTML = '<textarea id="wiki-reply-' + commentId + '" class="inp" placeholder="Répondre..." rows="1" style="flex:1;font-size:.78rem"></textarea>' +
      '<button class="btn btn--primary" onclick="UI.addWikiComment(\'' + articleId + '\',\'' + commentId + '\')" style="font-size:.7rem"><i class="fas fa-reply"></i></button>';
    parent.parentNode.insertBefore(replyDiv, parent.nextSibling);
  },

  // ═══════════════════════════════════════
  // WIKI WRITE
  // ═══════════════════════════════════════
  wikiWrite: function() {
    var btnNew = document.getElementById('btn-new-article');
    if (btnNew) {
      btnNew.addEventListener('click', function() {
        if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
        UI.openModal('modal-wiki-write');
      });
    }

    // Char count
    var waContent = document.getElementById('wa-content');
    var waCount = document.getElementById('wa-char-count');
    if (waContent && waCount) {
      waContent.addEventListener('input', function() {
        waCount.textContent = waContent.value.length;
        // Live preview
        var preview = document.getElementById('wa-preview');
        if (preview && typeof marked !== 'undefined' && waContent.value.length > 0) {
          preview.style.display = 'block';
          preview.innerHTML = marked.parse(waContent.value);
        } else if (preview) {
          preview.style.display = 'none';
        }
      });
    }

    // Submit
    var form = document.getElementById('wiki-write-form');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        UI.publishArticle();
      });
    }
  },

  publishArticle: async function() {
    if (!App.currentUser || !App.currentProfile) return;
    var title = document.getElementById('wa-title').value.trim();
    var content = document.getElementById('wa-content').value.trim();
    var category = document.getElementById('wa-category').value;

    if (!title || title.length < 3) { UI.toast('Titre trop court', 'warning'); return; }
    if (!content || content.length < 10) { UI.toast('Contenu trop court', 'warning'); return; }

    var btn = document.getElementById('btn-wiki-publish');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Publication...';

    try {
      // Moderation
      var modResp = await fetch('/api/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title, description: content, context: 'wiki' }) });
      var modData = await modResp.json();
      if (modData.flagged && modData.reformulated && modData.cleaned) {
        title = modData.cleaned.title;
        content = modData.cleaned.description;
        UI.toast('Contenu reformulé', 'info');
      }

      // Generate slug
      var slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

      // Poll data
      var pollData = null;
      if (typeof Polls !== 'undefined') {
        pollData = Polls.getData();
      }

      var result = await App.supabase.from('wiki_articles').insert({
        slug: slug,
        title: title,
        content: content,
        category: category,
        author_id: App.currentUser.id,
        author_name: App.currentProfile.username || 'Anonyme',
        poll_data: pollData
      }).select().single();

      if (result.error) throw result.error;

      // +15 reputation
      if (App.currentProfile) {
        await App.supabase.from('profiles').update({
          reputation: (App.currentProfile.reputation || 0) + 15
        }).eq('id', App.currentUser.id);
        App.currentProfile.reputation = (App.currentProfile.reputation || 0) + 15;
      }

      UI.closeModal('modal-wiki-write');
      UI.toast('Article publié ! +15 pts 🎉', 'success');
      App.trackEvent('article_published');
      document.getElementById('wiki-write-form').reset();
      var preview = document.getElementById('wa-preview');
      if (preview) preview.style.display = 'none';
      this.loadCommunityArticles();
    } catch(e) {
      console.error('Publish error:', e);
      UI.toast('Erreur: ' + (e.message || 'Échec'), 'error');
    }
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publier';
  },

  // ═══════════════════════════════════════
  // CONTACT
  // ═══════════════════════════════════════
  contactEmail: function() {
    var link = document.getElementById('contact-email-link');
    var display = document.getElementById('contact-email-display');
    var email = (App.config && App.config.contactEmail) || 'maxenceponche971@gmail.com';
    if (link) link.href = 'mailto:' + email;
    if (display) display.textContent = email;
  },

  // ═══════════════════════════════════════
  // PUBLIC PROFILE
  // ═══════════════════════════════════════
  openPublicProfile: async function(userId) {
    if (!userId || !App.supabase) return;
    try {
      var result = await App.supabase.from('profiles').select('*').eq('id', userId).single();
      if (!result.data) return;
      var p = result.data;
      var initial = p.username ? p.username.charAt(0).toUpperCase() : '?';
      var level = (typeof Auth !== 'undefined') ? Auth._getLevel(p.reputation || 0) : { name: '?', num: 1 };

      // Calculate stats from reports
      var userReports = App.reports.filter(function(r) { return r.user_id === userId; });
      var resolved = 0;
      for (var i = 0; i < userReports.length; i++) { if (userReports[i].status === 'resolved') resolved++; }

      var container = document.getElementById('report-detail') || document.getElementById('wiki-article-detail');
      if (!container) return;

      container.innerHTML = '<div class="pub-profile">' +
        '<div class="pub-profile__avatar">' + initial + '</div>' +
        '<div class="pub-profile__name">' + App.esc(p.username || 'Anonyme') + '</div>' +
        '<div class="pub-profile__meta">' +
          (p.commune ? '<span><i class="fas fa-map-marker-alt"></i> ' + App.esc(p.commune) + '</span> · ' : '') +
          '<span>Niv. ' + level.num + ' ' + level.name + '</span></div>' +
        '<div class="pub-profile__stats">' +
          '<div class="profile__stat"><div class="profile__stat-value">' + (p.reports_count || 0) + '</div><div class="profile__stat-label">Signalements</div></div>' +
          '<div class="profile__stat profile__stat--green"><div class="profile__stat-value">' + resolved + '</div><div class="profile__stat-label">Résolus</div></div>' +
          '<div class="profile__stat profile__stat--yellow"><div class="profile__stat-value">' + (p.reputation || 0) + '</div><div class="profile__stat-label">Réputation</div></div>' +
        '</div></div>';

      // Open in detail modal
      UI.openModal('modal-detail');
    } catch(e) {}
  },

  // ═══════════════════════════════════════
  // NETWORK STATUS
  // ═══════════════════════════════════════
  networkStatus: function() {
    window.addEventListener('offline', function() { UI.toast('Vous êtes hors ligne', 'warning'); });
    window.addEventListener('online', function() {
      UI.toast('Connexion rétablie', 'success');
      if (typeof Reports !== 'undefined') Reports.loadAll();
    });
  },

  // ═══════════════════════════════════════
  // TOAST
  // ═══════════════════════════════════════
  toast: function(msg, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    if (!container) return;
    var icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    var toast = document.createElement('div');
    toast.className = 'toast toast--' + type;
    toast.innerHTML = '<i class="toast__ico fas ' + (icons[type] || icons.info) + '"></i><span class="toast__msg">' + App.esc(msg) + '</span><button class="toast__x" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>';
    container.appendChild(toast);
    setTimeout(function() { if (toast.parentElement) toast.remove(); }, 4000);
  }
};
