var UI = {
  catIcons: {
    road: 'fa-road', warning: 'fa-exclamation-triangle', sign: 'fa-sign',
    marking: 'fa-grip-lines', bump: 'fa-minus', car: 'fa-car', boat: 'fa-ship',
    dump: 'fa-dumpster', beach: 'fa-umbrella-beach', river: 'fa-water',
    bin: 'fa-trash', light: 'fa-lightbulb', cable: 'fa-bolt', leak: 'fa-tint',
    flood: 'fa-house-flood-water', sewer: 'fa-toilet', stagnant: 'fa-droplet',
    plant: 'fa-leaf', tree: 'fa-tree', invasive: 'fa-seedling',
    building: 'fa-building', abandoned: 'fa-house-chimney-crack',
    sidewalk: 'fa-shoe-prints', railing: 'fa-bars',
    danger: 'fa-skull-crossbones', crosswalk: 'fa-person-walking',
    school: 'fa-school', noise: 'fa-volume-high', animals: 'fa-dog',
    mosquito: 'fa-mosquito', other: 'fa-map-pin'
  },

  _categoryGroups: [
    { label: 'Routes & Signalisation', icon: 'fa-road', items: ['pothole','dangerous_road','damaged_sign','missing_marking','speed_bump_needed'] },
    { label: 'Véhicules', icon: 'fa-car', items: ['abandoned_vehicle','abandoned_boat'] },
    { label: 'Déchets & Pollution', icon: 'fa-dumpster', items: ['illegal_dump','beach_pollution','river_pollution','overflowing_bin'] },
    { label: 'Éclairage & Câbles', icon: 'fa-lightbulb', items: ['broken_light','exposed_cable'] },
    { label: 'Eau & Assainissement', icon: 'fa-tint', items: ['water_leak','flooding','sewer_issue','stagnant_water'] },
    { label: 'Végétation', icon: 'fa-leaf', items: ['vegetation','fallen_tree','invasive_species'] },
    { label: 'Infrastructure', icon: 'fa-building', items: ['damaged_building','abandoned_building','damaged_sidewalk','missing_railing'] },
    { label: 'Sécurité', icon: 'fa-shield-alt', items: ['dangerous_area','missing_crosswalk','school_zone_issue'] },
    { label: 'Nuisances', icon: 'fa-volume-high', items: ['noise','stray_animals','mosquito_breeding'] },
    { label: 'Autre', icon: 'fa-map-pin', items: ['other'] }
  ],

  _miniMap: null,
  _miniMarker: null,

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

  createFAB: function() {
    if (document.getElementById('fab-report')) return;
    var btn = document.createElement('button');
    btn.id = 'fab-report';
    btn.className = 'fab-report';
    btn.title = 'Nouveau signalement';
    btn.innerHTML = '<i class="fas fa-plus"></i>';
    btn.addEventListener('click', function() { UI.openReportForm(); });
    document.body.appendChild(btn);
  },

  checkOnboarding: function() {
    if (localStorage.getItem('gwad-onboarded')) return;
    setTimeout(function() { UI.showOnboarding(); }, 2000);
  },

  showOnboarding: function() {
    if (document.getElementById('onboarding-overlay')) return;
    var steps = [
      { icon: '🗺️', title: 'Carte interactive', text: 'Explorez tous les signalements citoyens de Guadeloupe en temps réel sur la carte interactive.' },
      { icon: '📍', title: 'Signalez un problème', text: 'Appuyez sur + pour signaler un problème : nid-de-poule, dépôt sauvage, inondation... en quelques secondes.' },
      { icon: '🤝', title: 'Participez ensemble', text: 'Votez pour les signalements importants, gagnez des badges et montez dans le classement citoyen !' }
    ];
    var overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    var stepsHtml = '';
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      var isLast = i === steps.length - 1;
      var dotsHtml = '';
      for (var d = 0; d < steps.length; d++) {
        dotsHtml += '<span' + (d === i ? ' class="active"' : '') + '></span>';
      }
      stepsHtml += '<div class="onb__step' + (i === 0 ? ' active' : '') + '" data-step="' + i + '">' +
        '<div class="onb__icon">' + s.icon + '</div>' +
        '<h2>' + s.title + '</h2>' +
        '<p>' + s.text + '</p>' +
        '<div class="onb__dots">' + dotsHtml + '</div>' +
        '<div style="display:flex;gap:8px;justify-content:center">' +
        (i > 0 ? '<button class="btn btn--ghost" onclick="UI.onbNext(' + (i - 1) + ')"><i class="fas fa-chevron-left"></i> Retour</button>' : '') +
        (isLast
          ? '<button class="btn btn--primary" onclick="UI.closeOnboarding()"><i class="fas fa-check"></i> Commencer</button>'
          : '<button class="btn btn--primary" onclick="UI.onbNext(' + (i + 1) + ')">Suivant <i class="fas fa-chevron-right"></i></button>') +
        '</div></div>';
    }
    overlay.innerHTML = '<div class="onb"><button class="onb__skip" onclick="UI.closeOnboarding()">Passer</button>' + stepsHtml + '</div>';
    document.body.appendChild(overlay);
  },

  onbNext: function(step) {
    document.querySelectorAll('.onb__step').forEach(function(s, i) { s.classList.toggle('active', i === step); });
    document.querySelectorAll('.onb__dots span').forEach(function(d, i) { d.classList.toggle('active', i === step); });
  },

  closeOnboarding: function() {
    localStorage.setItem('gwad-onboarded', '1');
    var o = document.getElementById('onboarding-overlay');
    if (o) o.remove();
  },

  nav: function() {
    var tabs = document.querySelectorAll('.hdr__tab[data-view]');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        var target = tab.getAttribute('data-view');
        if (!target) return;
        tabs.forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
        var view = document.getElementById('view-' + target);
        if (view) view.classList.add('active');
        if (target === 'map') {
          setTimeout(function() {
            if (typeof MapManager !== 'undefined' && MapManager.map) MapManager.map.invalidateSize();
          }, 150);
        }
        if (target === 'stats') { if (typeof Reports !== 'undefined') Reports.updateStats(); }
        if (target === 'wiki') { UI.loadWikiStatic(); UI.loadCommunityArticles(); }
        App.trackEvent('nav_' + target);
      });
    });
  },

  modals: function() {
    document.querySelectorAll('.modal').forEach(function(modal) {
      var bg = modal.querySelector('.modal__bg');
      if (bg) bg.addEventListener('click', function() { UI.closeModal(modal.id); });
      var x = modal.querySelector('.modal__x');
      if (x) x.addEventListener('click', function() { UI.closeModal(modal.id); });
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.open').forEach(function(m) { UI.closeModal(m.id); });
      }
    });
  },

  openModal: function(id) {
    var modal = document.getElementById(id);
    if (modal) { modal.classList.add('open'); document.body.style.overflow = 'hidden'; }
  },

  closeModal: function(id) {
    var modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('open');
      if (!document.querySelectorAll('.modal.open').length) document.body.style.overflow = '';
    }
  },

  burger: function() {
    var btn = document.getElementById('burger-btn');
    var nav = document.querySelector('.hdr__nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function() { btn.classList.toggle('open'); nav.classList.toggle('open'); });
    nav.querySelectorAll('.hdr__tab').forEach(function(tab) {
      tab.addEventListener('click', function() { btn.classList.remove('open'); nav.classList.remove('open'); });
    });
    document.addEventListener('click', function(e) {
      if (!btn.contains(e.target) && !nav.contains(e.target)) { btn.classList.remove('open'); nav.classList.remove('open'); }
    });
  },

  filters: function() {
    ['filter-category', 'filter-status', 'filter-commune'].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', function() {
        if (id === 'filter-category') App.filters.category = el.value;
        else if (id === 'filter-status') App.filters.status = el.value;
        else if (id === 'filter-commune') App.filters.commune = el.value;
        App.pagination.page = 0;
        App.pagination.hasMore = true;
        if (typeof Reports !== 'undefined') Reports.loadAll();
      });
    });
    var resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', function() {
        App.filters = { category: '', status: '', commune: '' };
        ['filter-category', 'filter-status', 'filter-commune'].forEach(function(id) {
          var el = document.getElementById(id); if (el) el.value = '';
        });
        App.pagination.page = 0; App.pagination.hasMore = true;
        if (typeof Reports !== 'undefined') Reports.loadAll();
      });
    }
  },

  form: function() {
    var step1Next = document.getElementById('step1-next');
    var step2Next = document.getElementById('step2-next');
    var step2Back = document.getElementById('step2-back');
    var step3Back = document.getElementById('step3-back');
    var submitBtn = document.getElementById('btn-submit-report');
    var submitAnonBtn = document.getElementById('btn-submit-anon');

    if (step1Next) {
      step1Next.addEventListener('click', function() {
        var cat = document.querySelector('input[name="category"]:checked');
        if (!cat) { UI.toast('Choisissez une catégorie', 'warning'); return; }
        UI._goStep(2);
      });
    }
    if (step2Next) {
      step2Next.addEventListener('click', function() {
        var latEl = document.getElementById('report-lat');
        var lngEl = document.getElementById('report-lng');
        if (!latEl || !latEl.value || !lngEl || !lngEl.value) {
          UI.toast('Sélectionnez un emplacement sur la carte', 'warning'); return;
        }
        UI._goStep(3);
      });
    }
    if (step2Back) step2Back.addEventListener('click', function() { UI._goStep(1); });
    if (step3Back) step3Back.addEventListener('click', function() { UI._goStep(2); });
    if (submitBtn) submitBtn.addEventListener('click', function() { if (typeof Reports !== 'undefined') Reports.submitReport(false); });
    if (submitAnonBtn) submitAnonBtn.addEventListener('click', function() { if (typeof Reports !== 'undefined') Reports.submitReport(true); });

    // Recherche adresse étape 2
    this._initLocSearch();
  },

  _initLocSearch: function() {
    var input = document.getElementById('loc-search-input');
    var results = document.getElementById('loc-results');
    if (!input || !results) return;

    var timeout = null;
    input.addEventListener('input', function() {
      clearTimeout(timeout);
      var val = input.value.trim();
      if (val.length < 3) { results.classList.remove('open'); results.innerHTML = ''; return; }
      timeout = setTimeout(function() {
        fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(val + ' Guadeloupe') + '&limit=5&countrycodes=gp&accept-language=fr')
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (!data || !data.length) { results.classList.remove('open'); return; }
            results.innerHTML = '';
            data.forEach(function(item) {
              var div = document.createElement('div');
              div.className = 'loc-r';
              div.textContent = item.display_name;
              div.addEventListener('click', function() {
                var lat = parseFloat(item.lat);
                var lng = parseFloat(item.lon);
                input.value = item.display_name;
                results.classList.remove('open');
                results.innerHTML = '';
                UI._setMiniMapLocation(lat, lng, item.display_name);
              });
              results.appendChild(div);
            });
            results.classList.add('open');
          })
          .catch(function() { results.classList.remove('open'); });
      }, 500);
    });

    document.addEventListener('click', function(e) {
      if (!input.contains(e.target) && !results.contains(e.target)) {
        results.classList.remove('open');
      }
    });
  },

  _initMiniMap: function() {
    var container = document.getElementById('mini-map');
    if (!container) return;
    if (this._miniMap) {
      this._miniMap.invalidateSize();
      return;
    }
    // Centre Guadeloupe
    this._miniMap = L.map('mini-map', { zoomControl: true, attributionControl: false }).setView([16.265, -61.551], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this._miniMap);

    var self = this;
    this._miniMap.on('click', function(e) {
      var lat = e.latlng.lat;
      var lng = e.latlng.lng;
      self._setMiniMapLocation(lat, lng, null);
      // Reverse geocode
      fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&accept-language=fr')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var addr = data.display_name || (lat.toFixed(5) + ', ' + lng.toFixed(5));
          var commune = '';
          if (data.address) {
            commune = data.address.city || data.address.town || data.address.village || data.address.municipality || '';
          }
          self._setMiniMapLocation(lat, lng, addr, commune);
        })
        .catch(function() {});
    });

    setTimeout(function() { if (self._miniMap) self._miniMap.invalidateSize(); }, 200);
  },

  _setMiniMapLocation: function(lat, lng, address, commune) {
    if (!this._miniMap) this._initMiniMap();
    if (!this._miniMap) return;

    // Vérif Guadeloupe bounds
    if (lat < 15.65 || lat > 16.75 || lng < -62.05 || lng > -60.75) {
      UI.toast('Emplacement hors Guadeloupe', 'error');
      return;
    }

    var latEl = document.getElementById('report-lat');
    var lngEl = document.getElementById('report-lng');
    var addrEl = document.getElementById('report-address');
    var comEl = document.getElementById('report-commune');
    var infoEl = document.getElementById('loc-info');
    var infoText = document.getElementById('loc-info-text');

    if (latEl) latEl.value = lat;
    if (lngEl) lngEl.value = lng;
    if (addrEl && address) addrEl.value = address;
    if (comEl && commune) comEl.value = commune;

    if (this._miniMarker) {
      this._miniMarker.setLatLng([lat, lng]);
    } else {
      this._miniMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: '<div style="width:16px;height:16px;background:#16a34a;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px #16a34a,0 2px 8px rgba(0,0,0,.3)"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        })
      }).addTo(this._miniMap);
    }

    this._miniMap.setView([lat, lng], 15);

    if (infoEl) infoEl.style.display = 'flex';
    if (infoText) infoText.textContent = address ? address.substring(0, 60) + (address.length > 60 ? '...' : '') : lat.toFixed(5) + ', ' + lng.toFixed(5);
  },

  _goStep: function(step) {
    [1, 2, 3].forEach(function(s) {
      var el = document.getElementById('fstep-' + s);
      var dot = document.getElementById('step-dot-' + s);
      if (el) el.classList.toggle('active', s === step);
      if (dot) {
        dot.classList.remove('active', 'done');
        if (s === step) dot.classList.add('active');
        else if (s < step) dot.classList.add('done');
      }
    });
    if (step === 2) {
      setTimeout(function() {
        UI._initMiniMap();
      }, 200);
    }
  },

  openReportForm: function() {
    var anonRow = document.getElementById('anon-submit-row');
    var submitRow = document.getElementById('submit-row');
    if (anonRow) anonRow.style.display = 'flex';
    if (submitRow) submitRow.style.display = App.currentUser ? 'flex' : 'none';

    var form = document.getElementById('report-form');
    if (form) {
      // Reset sans déclencher la validation HTML5
      var inputs = form.querySelectorAll('input:not([type=hidden]):not([type=radio]), textarea, select');
      inputs.forEach(function(el) { el.value = ''; });
    }

    ['report-lat','report-lng','report-address','report-commune'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });

    document.querySelectorAll('.catc').forEach(function(c) { c.classList.remove('selected'); });
    document.querySelectorAll('#category-grid .catc').forEach(function(c) { c.style.display = ''; });
    document.querySelectorAll('input[name="category"]').forEach(function(r) { r.checked = false; });

    var catSearch = document.getElementById('cat-search');
    if (catSearch) catSearch.value = '';

    document.querySelectorAll('.prio').forEach(function(p) { p.classList.remove('selected'); });
    var medPrio = document.querySelector('.prio[data-priority="medium"]');
    if (medPrio) { medPrio.classList.add('selected'); var r = medPrio.querySelector('input'); if (r) r.checked = true; }

    var step1Next = document.getElementById('step1-next');
    if (step1Next) step1Next.disabled = true;

    var infoEl = document.getElementById('loc-info');
    if (infoEl) infoEl.style.display = 'none';

    // Reset mini map
    if (this._miniMarker && this._miniMap) {
      this._miniMap.removeLayer(this._miniMarker);
      this._miniMarker = null;
    }

    if (typeof ImageUpload !== 'undefined') ImageUpload.reset();
    this._goStep(1);
    this.openModal('modal-report');
    App.trackEvent('open_report_form');
  },

  buildCategoryGrid: function(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var html = '';
    this._categoryGroups.forEach(function(group) {
      var validItems = group.items.filter(function(key) { return App.categories[key]; });
      if (!validItems.length) return;
      html += '<div style="margin-bottom:16px">' +
        '<div style="font-size:.65rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:7px;display:flex;align-items:center;gap:5px;padding:0 2px">' +
          '<i class="fas ' + group.icon + '" style="font-size:.6rem"></i> ' + group.label +
        '</div><div class="catgrid">';
      validItems.forEach(function(key) {
        var cat = App.categories[key];
        var fa = (typeof MapManager !== 'undefined' && MapManager.getFaForCat) ? MapManager.getFaForCat(key) : 'fa-map-pin';
        html += '<label class="catc" data-key="' + key + '" title="' + cat.label + '">' +
          '<input type="radio" name="category" value="' + key + '" style="position:absolute;opacity:0;pointer-events:none">' +
          '<span class="catc__ico"><i class="fas ' + fa + '"></i></span>' +
          '<span class="catc__name">' + cat.label + '</span>' +
        '</label>';
      });
      html += '</div></div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('.catc').forEach(function(el) {
      el.addEventListener('click', function() {
        container.querySelectorAll('.catc').forEach(function(c) { c.classList.remove('selected'); });
        el.classList.add('selected');
        var input = el.querySelector('input[type="radio"]');
        if (input) input.checked = true;
        var nextBtn = document.getElementById('step1-next');
        if (nextBtn) nextBtn.disabled = false;
        App.trackEvent('category_selected', { category: el.getAttribute('data-key') });
      });
    });
  },

  catGrid: function() {
    this.buildCategoryGrid('category-grid');
    var searchInput = document.getElementById('cat-search');
    if (!searchInput) return;
    var aiTimeout = null;
    searchInput.addEventListener('input', function() {
      var val = searchInput.value.toLowerCase().trim();
      document.querySelectorAll('#category-grid .catc').forEach(function(el) {
        var name = el.querySelector('.catc__name');
        var text = name ? name.textContent.toLowerCase() : '';
        var key = el.getAttribute('data-key') || '';
        el.style.display = (!val || text.indexOf(val) !== -1 || key.indexOf(val) !== -1) ? '' : 'none';
      });
      // Masquer les groupes entiers si vides
      document.querySelectorAll('#category-grid > div').forEach(function(group) {
        var visible = group.querySelectorAll('.catc:not([style*="display: none"]):not([style*="display:none"])');
        group.style.display = (!val || visible.length > 0) ? '' : 'none';
      });
      clearTimeout(aiTimeout);
      if (val.length >= 3) {
        aiTimeout = setTimeout(function() {
          fetch('/api/ai-category', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: val }) })
            .then(function(r) { return r.json(); })
            .then(function(data) { if (data && data.category) UI.selectCategory(data.category, true); })
            .catch(function() {});
        }, 600);
      }
    });
  },

  selectCategory: function(catKey, fromAI) {
    var el = document.querySelector('#category-grid .catc[data-key="' + catKey + '"]');
    if (!el) return;
    document.querySelectorAll('#category-grid .catc').forEach(function(c) { c.classList.remove('selected'); c.style.display = ''; });
    document.querySelectorAll('#category-grid > div').forEach(function(g) { g.style.display = ''; });
    el.classList.add('selected');
    var input = el.querySelector('input[type="radio"]');
    if (input) input.checked = true;
    var nextBtn = document.getElementById('step1-next');
    if (nextBtn) nextBtn.disabled = false;
    var searchInput = document.getElementById('cat-search');
    if (searchInput) searchInput.value = '';
    if (fromAI) {
      var cat = App.categories[catKey];
      UI.toast('💡 Suggestion IA : ' + (cat ? cat.label : catKey), 'info');
    }
  },

  listControls: function() {
    var viewListBtn = document.getElementById('view-list-btn');
    var viewCardsBtn = document.getElementById('view-cards-btn');
    if (viewListBtn) {
      viewListBtn.addEventListener('click', function() {
        if (typeof Reports === 'undefined') return;
        Reports.viewMode = 'list';
        viewListBtn.classList.add('active');
        if (viewCardsBtn) viewCardsBtn.classList.remove('active');
        Reports.renderList();
      });
    }
    if (viewCardsBtn) {
      viewCardsBtn.addEventListener('click', function() {
        if (typeof Reports === 'undefined') return;
        Reports.viewMode = 'cards';
        viewCardsBtn.classList.add('active');
        if (viewListBtn) viewListBtn.classList.remove('active');
        Reports.renderList();
      });
    }
    var sortEl = document.getElementById('sort-reports');
    if (sortEl) sortEl.addEventListener('change', function() { if (typeof Reports !== 'undefined') Reports.renderList(); });

    var tabAll = document.getElementById('tab-all');
    var tabPending = document.getElementById('tab-pending');
    var tabResolved = document.getElementById('tab-resolved');
    var allTabs = [tabAll, tabPending, tabResolved];
    function activateTab(tab, status) {
      allTabs.forEach(function(t) { if (t) t.classList.remove('active'); });
      if (tab) tab.classList.add('active');
      App.filters.status = status;
      App.pagination.page = 0; App.pagination.hasMore = true;
      if (typeof Reports !== 'undefined') Reports.loadAll();
    }
    if (tabAll) { tabAll.classList.add('active'); tabAll.addEventListener('click', function() { activateTab(tabAll, ''); }); }
    if (tabPending) tabPending.addEventListener('click', function() { activateTab(tabPending, 'pending'); });
    if (tabResolved) tabResolved.addEventListener('click', function() { activateTab(tabResolved, 'resolved'); });
  },

  renderBanner: function(banner) {
    if (!banner) return;
    var typeMap = {
      info: { bg: 'var(--blue-bg)', border: 'rgba(59,130,246,.3)', color: 'var(--blue2)', icon: 'fa-info-circle' },
      warning: { bg: 'var(--orange-bg)', border: 'rgba(245,158,11,.3)', color: 'var(--orange2)', icon: 'fa-exclamation-triangle' },
      success: { bg: 'var(--green-bg)', border: 'rgba(22,163,74,.3)', color: 'var(--green2)', icon: 'fa-check-circle' },
      error: { bg: 'var(--red-bg)', border: 'rgba(239,68,68,.3)', color: 'var(--red2)', icon: 'fa-times-circle' }
    };
    var t = typeMap[banner.type] || typeMap.info;
    var el = document.getElementById('site-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'site-banner';
      el.style.cssText = 'position:fixed;top:var(--hh);left:0;right:0;z-index:999;padding:9px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:.8rem;font-weight:500';
      document.body.appendChild(el);
    }
    el.style.background = t.bg;
    el.style.borderBottom = '1px solid ' + t.border;
    el.style.color = t.color;
    el.innerHTML = '<span><i class="fas ' + t.icon + '"></i> ' + App.esc(banner.message) + '</span>' +
      '<button onclick="document.getElementById(\'site-banner\').remove()" style="background:none;border:none;cursor:pointer;color:inherit;font-size:.85rem;padding:4px"><i class="fas fa-times"></i></button>';
  },

  // ─── COMMUNAUTÉ ─────────────────────────────────────────
  // Schéma réel : tag_proposals(id, name, description, author_id, author_name, upvotes, status, icon)
  // tag_votes(id, user_id, proposal_id)

  community: function() {
    var propBtn = document.getElementById('btn-propose-tag');
    var propInput = document.getElementById('tag-proposal-input');
    var propDesc = document.getElementById('tag-proposal-desc');
    if (propBtn && propInput) {
      propBtn.addEventListener('click', function() { UI.submitTagProposal(); });
    }
    this.loadTagProposals();
  },

  submitTagProposal: async function() {
    if (!App.currentUser) { UI.toast('Connectez-vous pour proposer', 'warning'); return; }
    var nameInput = document.getElementById('tag-proposal-input');
    var descInput = document.getElementById('tag-proposal-desc');
    var name = nameInput ? nameInput.value.trim() : '';
    var desc = descInput ? descInput.value.trim() : 'Proposition de catégorie';
    if (!name || name.length < 2) { UI.toast('Nom trop court (min 2 caractères)', 'warning'); return; }
    if (!desc || desc.length < 5) desc = 'Proposition de la communauté';
    try {
      var result = await App.supabase.from('tag_proposals').insert({
        name: name,
        description: desc,
        author_id: App.currentUser.id,
        author_name: (App.currentProfile && App.currentProfile.username) || 'Citoyen',
        upvotes: 0,
        status: 'pending',
        icon: 'fa-tag'
      });
      if (result.error) throw result.error;
      if (nameInput) nameInput.value = '';
      if (descInput) descInput.value = '';
      UI.toast('Proposition envoyée ! 🎉', 'success');
      this.loadTagProposals();
    } catch(e) {
      var msg = e.message || '';
      if (msg.indexOf('unique') !== -1 || msg.indexOf('duplicate') !== -1) {
        UI.toast('Cette catégorie existe déjà', 'warning');
      } else {
        UI.toast('Erreur : ' + msg, 'error');
      }
    }
  },

  loadTagProposals: async function() {
    var el = document.getElementById('tag-proposals-list');
    if (!el || !App.supabase) return;
    el.innerHTML = '<p style="color:var(--text3);font-size:.78rem;padding:8px"><i class="fas fa-spinner fa-spin"></i> Chargement...</p>';
    try {
      var result = await App.supabase
        .from('tag_proposals')
        .select('id,name,description,author_name,upvotes,status,icon')
        .order('upvotes', { ascending: false })
        .limit(20);
      if (result.error) throw result.error;
      if (!result.data || !result.data.length) {
        el.innerHTML = '<p style="color:var(--text3);font-size:.8rem;padding:8px">Aucune proposition pour le moment</p>';
        return;
      }
      var html = '';
      result.data.forEach(function(tag) {
        var statusColor = tag.status === 'approved' ? 'var(--green2)' : tag.status === 'rejected' ? 'var(--red2)' : 'var(--orange2)';
        var statusLabel = tag.status === 'approved' ? 'Approuvé' : tag.status === 'rejected' ? 'Rejeté' : 'En attente';
        html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:10px 12px;background:var(--bg3);border-radius:var(--r);margin-bottom:6px;border:1px solid var(--border)">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:.82rem;font-weight:700;display:flex;align-items:center;gap:6px;margin-bottom:2px">' +
              '<i class="fas ' + (tag.icon || 'fa-tag') + '" style="color:var(--green2);font-size:.7rem"></i>' +
              App.esc(tag.name) +
              '<span style="font-size:.62rem;padding:1px 6px;background:' + statusColor + '18;color:' + statusColor + ';border-radius:3px;font-weight:600">' + statusLabel + '</span>' +
            '</div>' +
            '<div style="font-size:.72rem;color:var(--text2);margin-bottom:3px">' + App.esc(tag.description || '') + '</div>' +
            '<div style="font-size:.65rem;color:var(--text3)">Par ' + App.esc(tag.author_name || 'Citoyen') + '</div>' +
          '</div>' +
          '<button onclick="UI.voteTag(\'' + tag.id + '\')" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 10px;background:var(--orange-bg);border:1px solid rgba(245,158,11,.2);border-radius:var(--r);cursor:pointer;font-family:inherit;min-width:44px;flex-shrink:0" title="Voter">' +
            '<i class="fas fa-arrow-up" style="color:var(--orange2);font-size:.72rem"></i>' +
            '<span style="font-size:.72rem;font-weight:700;color:var(--orange2)">' + (tag.upvotes || 0) + '</span>' +
          '</button>' +
        '</div>';
      });
      el.innerHTML = html;
    } catch(e) {
      el.innerHTML = '<p style="color:var(--text3);font-size:.78rem;padding:8px">Erreur : ' + App.esc(e.message || 'Chargement impossible') + '</p>';
    }
  },

  voteTag: async function(tagId) {
    if (!App.currentUser) { UI.toast('Connectez-vous pour voter', 'warning'); return; }
    try {
      // Vérifie si déjà voté (proposal_id dans tag_votes)
      var check = await App.supabase
        .from('tag_votes')
        .select('id')
        .eq('proposal_id', tagId)
        .eq('user_id', App.currentUser.id)
        .maybeSingle();
      if (check.data) { UI.toast('Vous avez déjà voté pour cette proposition', 'info'); return; }

      await App.supabase.from('tag_votes').insert({ proposal_id: tagId, user_id: App.currentUser.id });

      var tag = await App.supabase.from('tag_proposals').select('upvotes').eq('id', tagId).single();
      var newVotes = ((tag.data && tag.data.upvotes) || 0) + 1;
      await App.supabase.from('tag_proposals').update({ upvotes: newVotes }).eq('id', tagId);

      UI.toast('Vote enregistré !', 'success');
      this.loadTagProposals();
    } catch(e) { UI.toast('Erreur', 'error'); }
  },

  // ─── WIKI ────────────────────────────────────────────────
  // Schéma réel : wiki_articles(id, slug, title, content, category, author_id, author_name, upvotes, views, pinned)
  // wiki_comments(id, article_id, user_id, content, reply_to)
  // wiki_votes(id, user_id, article_id)
  // category ENUM : general, guide, info, discussion, proposition

  wikiTabs: function() {
    var tabs = document.querySelectorAll('.wiki-tab');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        tabs.forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var target = tab.getAttribute('data-panel');
        document.querySelectorAll('.wiki-panel').forEach(function(p) { p.classList.remove('active'); });
        var panel = document.getElementById('wiki-panel-' + target);
        if (panel) panel.classList.add('active');
        if (target === 'guide') UI.loadWikiStatic();
        if (target === 'articles') UI.loadCommunityArticles();
      });
    });
    document.querySelectorAll('.wnav').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.wnav').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var page = btn.getAttribute('data-page');
        if (page) UI.loadWikiStatic(page);
      });
    });
  },

  loadWikiStatic: async function(page) {
    var body = document.getElementById('wiki-body');
    if (!body) return;
    page = page || 'intro';
    body.innerHTML = '<div class="wiki__load" style="text-align:center;padding:40px"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem;display:block;margin-bottom:12px;color:var(--green2)"></i><p style="font-size:.8rem;color:var(--text3)">Chargement...</p></div>';
    try {
      var resp = await fetch('/api/wiki-static?page=' + encodeURIComponent(page));
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var data = await resp.json();
      body.innerHTML = data.html || '<div style="text-align:center;padding:40px;color:var(--text3)"><i class="fas fa-book" style="font-size:2rem;display:block;margin-bottom:12px"></i><p>Contenu non disponible</p></div>';
    } catch(e) {
      body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">' +
        '<i class="fas fa-exclamation-circle" style="font-size:2rem;display:block;margin-bottom:12px;color:var(--orange2)"></i>' +
        '<p style="font-weight:600;margin-bottom:6px">Impossible de charger le contenu</p>' +
        '<p style="font-size:.78rem;margin-bottom:14px">Vérifiez votre connexion ou réessayez.</p>' +
        '<button class="btn btn--outline" onclick="UI.loadWikiStatic(\'' + page + '\')"><i class="fas fa-redo"></i> Réessayer</button>' +
      '</div>';
    }
  },

  loadCommunityArticles: async function() {
    var el = document.getElementById('community-articles');
    if (!el || !App.supabase) return;
    el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text3)"><i class="fas fa-spinner fa-spin" style="color:var(--green2)"></i> Chargement...</div>';
    try {
      var result = await App.supabase
        .from('wiki_articles')
        .select('id,title,content,category,author_name,upvotes,views,pinned,created_at')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30);
      if (result.error) throw result.error;
      if (!result.data || !result.data.length) {
        el.innerHTML = '<div class="empty"><i class="fas fa-book-open"></i><h3>Pas encore d\'articles</h3><p>Soyez le premier à contribuer !</p></div>';
        return;
      }
      var catLabels = { general: 'Général', guide: 'Guide', info: 'Info', discussion: 'Discussion', proposition: 'Proposition' };
      var html = '';
      result.data.forEach(function(art) {
        var preview = art.content ? art.content.substring(0, 140) : '';
        var catLabel = catLabels[art.category] || art.category || 'Général';
        html += '<div class="wcard" onclick="UI.openArticle(\'' + art.id + '\')">' +
          '<div class="wcard__head">' +
            '<span class="wcard__cat">' +
              (art.pinned ? '<i class="fas fa-thumbtack" style="color:var(--orange2);margin-right:3px"></i>' : '') +
              App.esc(catLabel) +
            '</span>' +
            '<span class="wcard__date">' + App.ago(art.created_at) + '</span>' +
          '</div>' +
          '<div class="wcard__title">' + App.esc(art.title) + '</div>' +
          '<div class="wcard__preview">' + App.esc(preview) + (art.content && art.content.length > 140 ? '...' : '') + '</div>' +
          '<div class="wcard__foot">' +
            '<span class="wcard__author"><i class="fas fa-user"></i> ' + App.esc(art.author_name || 'Citoyen') + '</span>' +
            '<div style="display:flex;gap:10px">' +
              '<span class="wcard__votes"><i class="fas fa-arrow-up"></i> ' + (art.upvotes || 0) + '</span>' +
              '<span style="font-size:.72rem;color:var(--text3)"><i class="fas fa-eye"></i> ' + (art.views || 0) + '</span>' +
            '</div>' +
          '</div></div>';
      });
      el.innerHTML = html;
    } catch(e) {
      el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text3)">' +
        '<i class="fas fa-exclamation-circle" style="display:block;font-size:1.5rem;margin-bottom:10px;color:var(--orange2)"></i>' +
        '<p>Erreur de chargement</p>' +
        '<button class="btn btn--outline" style="margin-top:10px" onclick="UI.loadCommunityArticles()"><i class="fas fa-redo"></i> Réessayer</button>' +
      '</div>';
    }
  },

  openArticle: async function(id) {
    if (!App.supabase) return;
    var container = document.getElementById('article-detail');
    if (!container) return;
    container.innerHTML = '<div style="padding:40px;text-align:center"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem;color:var(--green2)"></i></div>';
    this.openModal('modal-article');

    // Incrémenter les vues
    App.supabase.from('wiki_articles').select('views').eq('id', id).single().then(function(r) {
      if (r.data) App.supabase.from('wiki_articles').update({ views: (r.data.views || 0) + 1 }).eq('id', id).then(function() {});
    });

    try {
      var result = await App.supabase
        .from('wiki_articles')
        .select('id,title,content,category,author_id,author_name,upvotes,views,pinned,created_at')
        .eq('id', id)
        .single();
      if (result.error) throw result.error;
      var art = result.data;
      var isAuthor = App.currentUser && art.author_id === App.currentUser.id;
      var isAdmin = App.isAdmin();
      var catLabels = { general: 'Général', guide: 'Guide', info: 'Info', discussion: 'Discussion', proposition: 'Proposition' };
      var catLabel = catLabels[art.category] || art.category || 'Général';

      // Vérifie si l'utilisateur a déjà voté
      var hasVoted = false;
      if (App.currentUser) {
        try {
          var vcheck = await App.supabase.from('wiki_votes').select('id').eq('article_id', id).eq('user_id', App.currentUser.id).maybeSingle();
          if (vcheck.data) hasVoted = true;
        } catch(e) {}
      }

      var html = '<div style="padding:22px">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">' +
          '<span style="font-size:.68rem;font-weight:700;color:var(--text3);background:var(--bg3);padding:2px 8px;border-radius:3px;text-transform:uppercase;border:1px solid var(--border)">' +
            (art.pinned ? '<i class="fas fa-thumbtack" style="color:var(--orange2);margin-right:3px"></i>' : '') + App.esc(catLabel) +
          '</span>' +
          '<span style="font-size:.68rem;color:var(--text3)">' + App.ago(art.created_at) + '</span>' +
        '</div>' +
        '<h1 style="font-size:1.35rem;font-weight:700;margin-bottom:10px;line-height:1.3">' + App.esc(art.title) + '</h1>' +
        '<div style="display:flex;align-items:center;gap:14px;font-size:.78rem;color:var(--text2);margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--border);flex-wrap:wrap">' +
          '<span><i class="fas fa-user" style="color:var(--green2)"></i> ' + App.esc(art.author_name || 'Citoyen') + '</span>' +
          '<span><i class="fas fa-arrow-up" style="color:var(--orange2)"></i> ' + (art.upvotes || 0) + ' votes</span>' +
          '<span><i class="fas fa-eye" style="color:var(--blue2)"></i> ' + (art.views || 0) + ' vues</span>' +
        '</div>' +
        '<div style="line-height:1.85;font-size:.88rem;white-space:pre-wrap;margin-bottom:22px;color:var(--text)">' + App.esc(art.content) + '</div>' +
        '<div style="display:flex;gap:7px;flex-wrap:wrap;padding-top:14px;border-top:1px solid var(--border)">';

      if (App.currentUser) {
        html += '<button class="btn ' + (hasVoted ? 'btn--primary' : 'btn--outline') + '" onclick="UI.voteArticle(\'' + id + '\')" ' + (hasVoted ? 'disabled' : '') + '>' +
          '<i class="fas fa-arrow-up"></i> ' + (hasVoted ? 'Voté' : 'Voter') +
        '</button>';
      }
      if (isAuthor || isAdmin) {
        html += '<button class="btn btn--danger" onclick="UI.deleteArticle(\'' + id + '\')"><i class="fas fa-trash"></i> Supprimer</button>';
      }
      html += '</div>';

      // Commentaires
      html += '<div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">' +
        '<div style="font-size:.88rem;font-weight:700;margin-bottom:12px"><i class="fas fa-comments" style="color:var(--green2)"></i> Commentaires</div>';
      if (App.currentUser) {
        html += '<div class="cmtform">' +
          '<textarea id="article-cmt-' + id + '" placeholder="Votre commentaire..." rows="2" style="resize:none"></textarea>' +
          '<button class="btn btn--primary" onclick="UI.addArticleComment(\'' + id + '\')"><i class="fas fa-paper-plane"></i></button>' +
        '</div>';
      } else {
        html += '<p style="font-size:.78rem;color:var(--text3);margin-bottom:10px"><i class="fas fa-lock"></i> Connectez-vous pour commenter</p>';
      }
      html += '<div id="article-cmts-' + id + '"></div></div></div>';

      container.innerHTML = html;
      this.loadArticleComments(id);
    } catch(e) {
      container.innerHTML = '<p style="padding:20px;text-align:center;color:var(--text3)">Erreur de chargement</p>';
    }
  },

  voteArticle: async function(id) {
    if (!App.currentUser || !App.supabase) { UI.toast('Connectez-vous', 'warning'); return; }
    try {
      var check = await App.supabase.from('wiki_votes').select('id').eq('article_id', id).eq('user_id', App.currentUser.id).maybeSingle();
      if (check.data) { UI.toast('Vous avez déjà voté', 'info'); return; }
      await App.supabase.from('wiki_votes').insert({ article_id: id, user_id: App.currentUser.id });
      var art = await App.supabase.from('wiki_articles').select('upvotes').eq('id', id).single();
      await App.supabase.from('wiki_articles').update({ upvotes: ((art.data && art.data.upvotes) || 0) + 1 }).eq('id', id);
      UI.toast('Vote enregistré !', 'success');
      this.openArticle(id);
    } catch(e) { UI.toast('Erreur', 'error'); }
  },

  deleteArticle: async function(id) {
    if (!confirm('Supprimer cet article définitivement ?')) return;
    try {
      await App.supabase.from('wiki_comments').delete().eq('article_id', id);
      await App.supabase.from('wiki_votes').delete().eq('article_id', id);
      await App.supabase.from('wiki_articles').delete().eq('id', id);
      UI.toast('Article supprimé', 'success');
      this.closeModal('modal-article');
      this.loadCommunityArticles();
    } catch(e) { UI.toast('Erreur lors de la suppression', 'error'); }
  },

  loadArticleComments: async function(articleId) {
    var el = document.getElementById('article-cmts-' + articleId);
    if (!el || !App.supabase) return;
    try {
      var result = await App.supabase
        .from('wiki_comments')
        .select('id,content,user_id,created_at,reply_to,profiles(username)')
        .eq('article_id', articleId)
        .order('created_at', { ascending: true });
      if (result.error) throw result.error;
      if (!result.data || !result.data.length) {
        el.innerHTML = '<p style="color:var(--text3);font-size:.78rem;padding:8px 0">Aucun commentaire — soyez le premier !</p>';
        return;
      }
      var html = '';
      result.data.forEach(function(c) {
        var name = (c.profiles && c.profiles.username) || 'Anonyme';
        html += '<div class="cmt">' +
          '<div class="cmt__av">' + name.charAt(0).toUpperCase() + '</div>' +
          '<div class="cmt__body">' +
            '<div class="cmt__head">' +
              '<span class="cmt__author">' + App.esc(name) + '</span>' +
              '<span class="cmt__date">' + App.ago(c.created_at) + '</span>' +
            '</div>' +
            '<div class="cmt__text">' + App.esc(c.content) + '</div>' +
          '</div></div>';
      });
      el.innerHTML = html;
    } catch(e) {}
  },

  addArticleComment: async function(articleId) {
    if (!App.currentUser || !App.supabase) { UI.toast('Connectez-vous', 'warning'); return; }
    var input = document.getElementById('article-cmt-' + articleId);
    if (!input) return;
    var content = input.value.trim();
    if (!content || content.length < 2) { UI.toast('Trop court', 'warning'); return; }
    if (content.length > 2000) { UI.toast('Trop long (max 2000)', 'warning'); return; }
    try {
      var result = await App.supabase.from('wiki_comments').insert({
        article_id: articleId,
        user_id: App.currentUser.id,
        content: content
      });
      if (result.error) throw result.error;
      input.value = '';
      UI.toast('Commentaire ajouté', 'success');
      this.loadArticleComments(articleId);
    } catch(e) { UI.toast('Erreur : ' + (e.message || ''), 'error'); }
  },

  wikiWrite: function() {
    var writeBtn = document.getElementById('btn-wiki-write');
    if (writeBtn) {
      writeBtn.addEventListener('click', function() {
        if (!App.currentUser) { UI.toast('Connectez-vous pour contribuer', 'warning'); return; }
        UI.openModal('modal-wiki-write');
      });
    }
    var previewBtn = document.getElementById('btn-wiki-preview');
    var contentInput = document.getElementById('wiki-write-content');
    var previewEl = document.getElementById('wiki-write-preview');
    if (previewBtn && contentInput && previewEl) {
      previewBtn.addEventListener('click', function() {
        var text = contentInput.value.trim();
        if (text) {
          previewEl.style.display = 'block';
          previewEl.innerHTML = '<div style="padding:14px;background:var(--bg3);border-radius:var(--r);border:1px solid var(--border);font-size:.85rem;line-height:1.8;white-space:pre-wrap">' + App.esc(text) + '</div>';
        } else { previewEl.style.display = 'none'; }
      });
    }
    var publishBtn = document.getElementById('btn-wiki-publish');
    if (publishBtn) publishBtn.addEventListener('click', function() { UI.publishArticle(); });
  },

  publishArticle: async function() {
    if (!App.currentUser || !App.supabase) { UI.toast('Connectez-vous', 'warning'); return; }
    var titleInput = document.getElementById('wiki-write-title');
    var categoryInput = document.getElementById('wiki-write-category');
    var contentInput = document.getElementById('wiki-write-content');
    if (!titleInput || !contentInput) return;
    var title = titleInput.value.trim();
    var category = (categoryInput ? categoryInput.value.trim() : '') || 'general';
    var content = contentInput.value.trim();

    // Mapper les valeurs du select vers l'enum DB
    var catMap = { 'Général': 'general', 'Guide': 'guide', 'Info': 'info', 'Discussion': 'discussion', 'Proposition': 'proposition', 'general': 'general', 'guide': 'guide', 'info': 'info', 'discussion': 'discussion', 'proposition': 'proposition' };
    category = catMap[category] || 'general';

    if (!title || title.length < 3) { UI.toast('Titre trop court (min 3 caractères)', 'warning'); return; }
    if (!content || content.length < 10) { UI.toast('Contenu trop court (min 10 caractères)', 'warning'); return; }

    var btn = document.getElementById('btn-wiki-publish');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Publication...'; }

    try {
      try {
        var modResp = await fetch('/api/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title, description: content }) });
        var modData = await modResp.json();
        if (modData.flagged && modData.cleaned) { title = modData.cleaned.title; content = modData.cleaned.description; UI.toast('Contenu reformulé', 'info'); }
      } catch(e) {}

      var slug = title.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 60) + '-' + Date.now();

      var authorName = (App.currentProfile && App.currentProfile.username) || 'Citoyen';

      var result = await App.supabase.from('wiki_articles').insert({
        title: title,
        content: content,
        category: category,
        slug: slug,
        author_id: App.currentUser.id,
        author_name: authorName,
        upvotes: 0,
        views: 0,
        pinned: false
      });
      if (result.error) throw result.error;

      if (App.currentProfile) {
        var newRep = (App.currentProfile.reputation || 0) + 15;
        await App.supabase.from('profiles').update({ reputation: newRep }).eq('id', App.currentUser.id);
        App.currentProfile.reputation = newRep;
        if (typeof Auth !== 'undefined') Auth.updateUI(true);
      }

      titleInput.value = '';
      if (categoryInput) categoryInput.value = 'general';
      contentInput.value = '';
      var previewEl = document.getElementById('wiki-write-preview');
      if (previewEl) previewEl.style.display = 'none';
      this.closeModal('modal-wiki-write');
      UI.toast('Article publié ! +15 pts 🎉', 'success');
      App.trackEvent('article_published');
      this.loadCommunityArticles();
    } catch(e) {
      UI.toast('Erreur : ' + (e.message || 'Échec'), 'error');
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publier'; }
  },

  contactEmail: function() {
    document.querySelectorAll('.contact-link[data-email]').forEach(function(link) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        var email = link.getAttribute('data-email');
        if (email) window.location.href = 'mailto:' + email;
      });
    });
  },

  networkStatus: function() {
    window.addEventListener('offline', function() { UI.toast('Connexion perdue — mode hors ligne', 'warning'); });
    window.addEventListener('online', function() {
      UI.toast('Connexion rétablie', 'success');
      if (typeof Reports !== 'undefined') Reports.loadAll();
    });
  },

  openPublicProfile: async function(userId) {
    if (!userId || !App.supabase) return;
    var container = document.getElementById('public-profile-container');
    if (!container) return;
    container.innerHTML = '<div style="padding:40px;text-align:center"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem;color:var(--green2)"></i></div>';
    this.openModal('modal-public-profile');
    try {
      var result = await App.supabase.from('profiles').select('*').eq('id', userId).single();
      if (!result.data) { container.innerHTML = '<p style="padding:20px;text-align:center;color:var(--text3)">Profil introuvable</p>'; return; }
      var u = result.data;
      var initial = (u.username || '?').charAt(0).toUpperCase();
      var repsRes = await App.supabase.from('reports').select('id', { count: 'exact' }).eq('user_id', userId);
      var resolvedRes = await App.supabase.from('reports').select('id', { count: 'exact' }).eq('user_id', userId).eq('status', 'resolved');
      var total = repsRes.count || 0;
      var resolved = resolvedRes.count || 0;
      var html = '<div class="pub-profile">' +
        '<div class="pub-profile__avatar">' + initial + '</div>' +
        '<div class="pub-profile__name">' + App.esc(u.username || 'Citoyen') + '</div>' +
        '<div class="pub-profile__meta">' +
          (u.commune ? '<span><i class="fas fa-map-pin"></i> ' + App.esc(u.commune) + '</span> · ' : '') +
          'Membre depuis ' + App.formatDate(u.created_at) +
        '</div>' +
        '<div class="pub-profile__stats">' +
          '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:14px;text-align:center">' +
            '<div style="font-size:1.3rem;font-weight:800;color:var(--blue2)">' + total + '</div>' +
            '<div style="font-size:.62rem;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-top:3px">Signalements</div>' +
          '</div>' +
          '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:14px;text-align:center">' +
            '<div style="font-size:1.3rem;font-weight:800;color:var(--green2)">' + resolved + '</div>' +
            '<div style="font-size:.62rem;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-top:3px">Résolus</div>' +
          '</div>' +
          '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:14px;text-align:center">' +
            '<div style="font-size:1.3rem;font-weight:800;color:var(--yellow2)">' + (u.reputation || 0) + '</div>' +
            '<div style="font-size:.62rem;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-top:3px">Points</div>' +
          '</div>' +
        '</div></div>';
      container.innerHTML = html;
    } catch(e) {
      container.innerHTML = '<p style="padding:20px;text-align:center;color:var(--text3)">Erreur de chargement</p>';
    }
  },

  toast: function(msg, type) {
    type = type || 'info';
    var icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    var container = document.getElementById('toasts');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toasts';
      container.className = 'toasts';
      document.body.appendChild(container);
    }
    var toast = document.createElement('div');
    toast.className = 'toast toast--' + type;
    toast.innerHTML = '<span class="toast__ico"><i class="fas ' + (icons[type] || icons.info) + '"></i></span>' +
      '<span class="toast__msg">' + App.esc(String(msg)) + '</span>' +
      '<button class="toast__x" onclick="this.parentNode.remove()"><i class="fas fa-times"></i></button>';
    container.appendChild(toast);
    setTimeout(function() {
      if (toast.parentNode) {
        toast.style.transition = 'all .25s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(80px)';
        setTimeout(function() { if (toast.parentNode) toast.remove(); }, 260);
      }
    }, 4000);
    return toast;
  }
};
