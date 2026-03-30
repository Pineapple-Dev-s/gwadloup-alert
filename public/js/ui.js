var UI = {
  catIcons: {
    road:'fa-road', warning:'fa-exclamation-triangle', sign:'fa-sign',
    marking:'fa-paint-roller', bump:'fa-wave-square', car:'fa-car',
    boat:'fa-ship', dump:'fa-trash', beach:'fa-umbrella-beach',
    river:'fa-water', bin:'fa-trash-alt', light:'fa-lightbulb',
    cable:'fa-bolt', leak:'fa-tint', flood:'fa-house-flood-water',
    sewer:'fa-faucet-drip', stagnant:'fa-droplet', plant:'fa-leaf',
    tree:'fa-tree', invasive:'fa-seedling', building:'fa-building',
    abandoned:'fa-building-circle-xmark', sidewalk:'fa-person-walking',
    railing:'fa-grip-lines', danger:'fa-shield-halved',
    crosswalk:'fa-crosshairs', school:'fa-school', noise:'fa-volume-high',
    animals:'fa-paw', mosquito:'fa-mosquito', other:'fa-map-pin'
  },

  getCatIcon: function(iconKey) {
    var fa = this.catIcons[iconKey] || 'fa-map-pin';
    return '<i class="fas ' + fa + '"></i>';
  },

  init: function() {
    this.nav();
    this.modals();
    this.filters();
    this.form();
    this.burger();
    this.catGrid();
    this.community();
    this.wikiEdit();
    this.debug();
    ImageUpload.init();
  },

  debug: function() {
    window.GA = {
      status: function() {
        console.log('=== GWADLOUP ALERT DEBUG ===');
        console.log('Supabase URL:', App.config ? App.config.supabaseUrl : 'NOT LOADED');
        console.log('Supabase client:', App.supabase ? 'OK' : 'MISSING');
        console.log('User:', App.currentUser ? App.currentUser.email : 'Not logged in');
        console.log('Profile:', App.currentProfile ? JSON.stringify(App.currentProfile) : 'None');
        console.log('Reports loaded:', App.reports.length);
        console.log('Map:', MapManager.map ? 'OK' : 'MISSING');
        console.log('Markers:', Object.keys(MapManager.markers).length);
        console.log('Filters:', JSON.stringify(App.filters));
        console.log('ImgBB key:', App.config && App.config.imgbbApiKey ? 'SET' : 'MISSING');
        console.log('Contact:', App.config ? App.config.contactEmail : 'N/A');
        var views = document.querySelectorAll('.view');
        var activeView = 'none';
        views.forEach(function(v) { if (v.classList.contains('active')) activeView = v.id; });
        console.log('Active view:', activeView);
        console.log('=== END DEBUG ===');
        return 'Debug info printed above';
      },
      test: function() {
        console.log('=== RUNNING TESTS ===');
        var pass = 0; var fail = 0;
        function check(name, condition) {
          if (condition) { console.log('  OK ' + name); pass++; }
          else { console.log('  FAIL ' + name); fail++; }
        }
        check('Config loaded', !!App.config);
        check('Supabase client', !!App.supabase);
        check('Map initialized', !!MapManager.map);
        check('Categories defined', Object.keys(App.categories).length > 20);
        check('DOM: map container', !!document.getElementById('map'));
        check('DOM: report form', !!document.getElementById('report-form'));
        check('DOM: category grid', !!document.getElementById('category-grid'));
        check('DOM: login form', !!document.getElementById('login-form'));
        check('DOM: toast container', !!document.getElementById('toast-container'));
        check('DOM: community view', !!document.getElementById('view-community'));
        check('DOM: wiki edit form', !!document.getElementById('wiki-edit-form'));
        check('ImageUpload ready', typeof ImageUpload.uploadAll === 'function');
        console.log('Result: ' + pass + ' passed, ' + fail + ' failed');
        return pass + '/' + (pass + fail) + ' tests passed';
      },
      reload: function() { Reports.loadAll(); return 'Reports reloaded'; },
      toast: function(msg) { UI.toast(msg || 'Test notification', 'info'); return 'Toast shown'; },
      user: function() { return App.currentUser || 'Not logged in'; },
      reports: function() { return App.reports; }
    };
    console.log('gwadloup alert v4 - Type GA.status() or GA.test()');
  },

  catGrid: function() {
    var g = document.getElementById('category-grid');
    if (!g) return;
    var html = '';
    var keys = Object.keys(App.categories);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = App.categories[k];
      var fa = this.catIcons[v.icon] || 'fa-map-pin';
      html += '<label class="catc"><input type="radio" name="category" value="' + k + '">' +
        '<div class="catc__ico"><i class="fas ' + fa + '"></i></div>' +
        '<div class="catc__name">' + v.label + '</div></label>';
    }
    g.innerHTML = html;
    g.addEventListener('change', function() {
      var btn = document.getElementById('btn-step1-next');
      if (btn) btn.disabled = false;
    });
  },

  nav: function() {
    var self = this;
    var tabs = document.querySelectorAll('.hdr__tab');

    for (var i = 0; i < tabs.length; i++) {
      (function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          var view = btn.getAttribute('data-view');

          for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
          btn.classList.add('active');

          var views = document.querySelectorAll('.view');
          for (var j = 0; j < views.length; j++) views[j].classList.remove('active');
          var target = document.getElementById('view-' + view);
          if (target) target.classList.add('active');

          if (view === 'map' && MapManager.map) {
            setTimeout(function() { MapManager.map.invalidateSize(); }, 150);
          }
          if (view === 'stats') Reports.updateStats();
          if (view === 'wiki') self.loadWiki();
          if (view === 'community') self.loadTagProposals();

          var nav = document.getElementById('main-nav');
          if (nav) nav.classList.remove('open');
          var burger = document.getElementById('burger-menu');
          if (burger) burger.classList.remove('open');
        });
      })(tabs[i]);
    }

    var logo = document.getElementById('logo-link');
    if (logo) {
      logo.addEventListener('click', function(e) {
        e.preventDefault();
        for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
        var mapTab = document.querySelector('.hdr__tab[data-view="map"]');
        if (mapTab) mapTab.classList.add('active');
        var views = document.querySelectorAll('.view');
        for (var j = 0; j < views.length; j++) views[j].classList.remove('active');
        var mapView = document.getElementById('view-map');
        if (mapView) mapView.classList.add('active');
        if (MapManager.map) setTimeout(function() { MapManager.map.invalidateSize(); }, 150);
      });
    }
  },

  burger: function() {
    var btn = document.getElementById('burger-menu');
    if (btn) {
      btn.addEventListener('click', function() {
        btn.classList.toggle('open');
        var nav = document.getElementById('main-nav');
        if (nav) nav.classList.toggle('open');
      });
    }
  },

  modals: function() {
    document.addEventListener('click', function(e) {
      var closeBtn = e.target.hasAttribute('data-close') ? e.target : e.target.closest('[data-close]');
      if (closeBtn) {
        var modal = closeBtn.closest('.modal');
        if (modal) {
          modal.classList.remove('open');
          document.body.style.overflow = '';
        }
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var openModals = document.querySelectorAll('.modal.open');
        for (var i = 0; i < openModals.length; i++) openModals[i].classList.remove('open');
        document.body.style.overflow = '';
      }
    });

    var reportBtn = document.getElementById('btn-new-report');
    if (reportBtn) {
      reportBtn.addEventListener('click', function() {
        if (!App.currentUser) {
          UI.toast('Connectez-vous d\'abord', 'warning');
          UI.openModal('modal-login');
          return;
        }

        var form = document.getElementById('report-form');
        if (form) form.reset();
        ImageUpload.reset();

        var allSteps = document.querySelectorAll('.fstep');
        for (var i = 0; i < allSteps.length; i++) allSteps[i].classList.remove('active');
        var s1 = document.getElementById('step-1');
        if (s1) s1.classList.add('active');

        var allIndicators = document.querySelectorAll('.steps__i');
        for (var i = 0; i < allIndicators.length; i++) {
          allIndicators[i].classList.remove('active', 'done');
        }
        var firstInd = document.querySelector('.steps__i[data-step="1"]');
        if (firstInd) firstInd.classList.add('active');

        var b1 = document.getElementById('btn-step1-next');
        if (b1) b1.disabled = true;
        var b2 = document.getElementById('btn-step2-next');
        if (b2) b2.disabled = true;
        var li = document.getElementById('location-info');
        if (li) li.style.display = 'none';
        var dc = document.getElementById('desc-count');
        if (dc) dc.textContent = '0';

        UI.openModal('modal-report');
        setTimeout(function() { MapManager.initMiniMap(); }, 400);
      });
    }
  },

  openModal: function(id) {
    var m = document.getElementById(id);
    if (m) {
      m.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  },

  closeModal: function(id) {
    var m = document.getElementById(id);
    if (m) m.classList.remove('open');
    var stillOpen = document.querySelectorAll('.modal.open');
    if (stillOpen.length === 0) document.body.style.overflow = '';
  },

  filters: function() {
    var catFilter = document.getElementById('filter-category');
    var statusFilter = document.getElementById('filter-status');
    var communeFilter = document.getElementById('filter-commune');
    var resetBtn = document.getElementById('btn-reset-filters');
    var sortSel = document.getElementById('sort-reports');

    if (catFilter) catFilter.addEventListener('change', function(e) { App.filters.category = e.target.value; Reports.loadAll(); });
    if (statusFilter) statusFilter.addEventListener('change', function(e) { App.filters.status = e.target.value; Reports.loadAll(); });
    if (communeFilter) communeFilter.addEventListener('change', function(e) { App.filters.commune = e.target.value; Reports.loadAll(); });

    if (resetBtn) {
      resetBtn.addEventListener('click', function() {
        App.filters = { category: '', status: '', commune: '' };
        if (catFilter) catFilter.value = '';
        if (statusFilter) statusFilter.value = '';
        if (communeFilter) communeFilter.value = '';
        Reports.loadAll();
      });
    }

    if (sortSel) {
      sortSel.addEventListener('change', function(e) {
        var s = e.target.value;
        if (s === 'newest') App.reports.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        else if (s === 'oldest') App.reports.sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at); });
        else App.reports.sort(function(a, b) { return (b.upvotes || 0) - (a.upvotes || 0); });
        Reports.renderList();
      });
    }
  },

  form: function() {
    var self = this;

    var s1btn = document.getElementById('btn-step1-next');
    if (s1btn) s1btn.addEventListener('click', function() { self.goStep(2); });

    var s2btn = document.getElementById('btn-step2-next');
    if (s2btn) s2btn.addEventListener('click', function() { self.goStep(3); });

    var prevBtns = document.querySelectorAll('[data-prev]');
    for (var i = 0; i < prevBtns.length; i++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          self.goStep(parseInt(btn.getAttribute('data-prev')));
        });
      })(prevBtns[i]);
    }

    var geoBtn = document.getElementById('btn-geolocate');
    if (geoBtn) {
      geoBtn.addEventListener('click', function() {
        if (!navigator.geolocation) { UI.toast('Non supporte', 'error'); return; }
        geoBtn.disabled = true;
        geoBtn.textContent = 'Localisation...';
        navigator.geolocation.getCurrentPosition(
          function(pos) {
            var lat = pos.coords.latitude;
            var lng = pos.coords.longitude;
            if (!MapManager.isInGuadeloupe(lat, lng)) {
              UI.toast('Vous n\'êtes pas en Guadeloupe. Placez le point manuellement.', 'warning');
            } else {
              MapManager.setPin(lat, lng);
              MapManager.reverseGeo(lat, lng);
            }
            geoBtn.disabled = false;
            geoBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Localiser';
          },
          function() {
            UI.toast('Localisation impossible', 'warning');
            geoBtn.disabled = false;
            geoBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Localiser';
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }

    var timer;
    var searchInput = document.getElementById('address-search');
    var searchResults = document.getElementById('search-results');

    if (searchInput && searchResults) {
      searchInput.addEventListener('input', function() {
        clearTimeout(timer);
        var q = searchInput.value.trim();
        if (q.length < 3) { searchResults.classList.remove('open'); return; }
        timer = setTimeout(function() {
          MapManager.searchAddr(q).then(function(data) {
            if (data.length > 0) {
              var html = '';
              for (var i = 0; i < data.length; i++) {
                html += '<div class="loc-r" data-lat="' + data[i].lat + '" data-lon="' + data[i].lon + '">' + data[i].display_name + '</div>';
              }
              searchResults.innerHTML = html;
              searchResults.classList.add('open');
            } else {
              searchResults.innerHTML = '<div class="loc-r">Aucun résultat en Guadeloupe</div>';
              searchResults.classList.add('open');
            }
          });
        }, 400);
      });

      searchResults.addEventListener('click', function(e) {
        var item = e.target.closest('.loc-r');
        if (item && item.dataset.lat) {
          var lat = parseFloat(item.dataset.lat);
          var lon = parseFloat(item.dataset.lon);
          if (!MapManager.isInGuadeloupe(lat, lon)) {
            UI.toast('Ce lieu n\'est pas en Guadeloupe', 'warning');
            return;
          }
          MapManager.setPin(lat, lon);
          MapManager.reverseGeo(lat, lon);
          searchInput.value = item.textContent;
          searchResults.classList.remove('open');
        }
      });

      document.addEventListener('click', function(e) {
        if (!e.target.closest('.loc-search')) searchResults.classList.remove('open');
      });
    }

    var descEl = document.getElementById('report-description');
    if (descEl) {
      descEl.addEventListener('input', function() {
        var dc = document.getElementById('desc-count');
        if (dc) dc.textContent = descEl.value.length;
      });
    }

    var prios = document.querySelectorAll('.prio');
    for (var i = 0; i < prios.length; i++) {
      (function(p) {
        p.addEventListener('click', function() {
          for (var j = 0; j < prios.length; j++) prios[j].classList.remove('active');
          p.classList.add('active');
        });
      })(prios[i]);
    }

    var form = document.getElementById('report-form');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        Reports.submitReport();
      });
    }
  },

  goStep: function(n) {
    var allSteps = document.querySelectorAll('.fstep');
    for (var i = 0; i < allSteps.length; i++) allSteps[i].classList.remove('active');
    var target = document.getElementById('step-' + n);
    if (target) target.classList.add('active');

    var allInd = document.querySelectorAll('.steps__i');
    for (var i = 0; i < allInd.length; i++) {
      var num = parseInt(allInd[i].getAttribute('data-step'));
      allInd[i].classList.remove('active', 'done');
      if (num < n) allInd[i].classList.add('done');
      if (num === n) allInd[i].classList.add('active');
    }

    if (n === 2 && MapManager.miniMap) {
      setTimeout(function() { MapManager.miniMap.invalidateSize(); }, 150);
    }
  },

  // === WIKI ===
  loadWiki: function() {
    var self = this;
    fetch('/api/wiki').then(function(r) { return r.json(); }).then(function(pages) {
      var nav = document.getElementById('wiki-nav');
      if (!nav) return;
      var html = '';
      for (var i = 0; i < pages.length; i++) {
        html += '<button class="wnav' + (i === 0 ? ' active' : '') + '" data-page="' + pages[i].slug + '">' + pages[i].title + '</button>';
      }
      nav.innerHTML = html;

      nav.addEventListener('click', function(e) {
        var btn = e.target.closest('.wnav');
        if (!btn) return;
        var allNav = nav.querySelectorAll('.wnav');
        for (var j = 0; j < allNav.length; j++) allNav[j].classList.remove('active');
        btn.classList.add('active');
        self.loadWikiPage(btn.getAttribute('data-page'));
      });

      if (pages.length > 0) self.loadWikiPage(pages[0].slug);
      else {
        var content = document.getElementById('wiki-content');
        if (content) content.innerHTML = '<p style="padding:24px;color:var(--text2)">Aucune page wiki. Connectez-vous pour créer la première !</p>';
      }
    }).catch(function() {
      var content = document.getElementById('wiki-content');
      if (content) content.innerHTML = '<p>Erreur de chargement</p>';
    });
  },

  loadWikiPage: function(slug) {
    var el = document.getElementById('wiki-content');
    if (!el) return;
    el.innerHTML = '<p class="wiki__load">Chargement...</p>';
    fetch('/api/wiki/' + slug).then(function(r) {
      if (!r.ok) throw new Error();
      return r.text();
    }).then(function(md) {
      // Remove history comment
      md = md.replace(/^<!--[\s\S]*?-->\n?/, '');
      var editBtn = '';
      if (App.currentUser) {
        editBtn = '<div style="text-align:right;margin-bottom:12px"><button class="btn btn--ghost" onclick="UI.editWikiPage(\'' + slug + '\')"><i class="fas fa-edit"></i> Modifier</button></div>';
      }
      el.innerHTML = editBtn + marked.parse(md);
    }).catch(function() {
      el.innerHTML = '<p>Page introuvable</p>';
    });
  },

  wikiEdit: function() {
    var self = this;

    var newBtn = document.getElementById('btn-new-wiki');
    if (newBtn) {
      newBtn.addEventListener('click', function() {
        if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
        document.getElementById('wiki-edit-title').textContent = 'Nouvel article';
        document.getElementById('wiki-edit-slug').value = '';
        document.getElementById('wiki-edit-slug').disabled = false;
        document.getElementById('wiki-edit-content').value = '# Titre\n\nContenu de l\'article...';
        document.getElementById('wiki-char-count').textContent = '0';
        UI.openModal('modal-wiki-edit');
      });
    }

    var contentInput = document.getElementById('wiki-edit-content');
    if (contentInput) {
      contentInput.addEventListener('input', function() {
        var c = document.getElementById('wiki-char-count');
        if (c) c.textContent = contentInput.value.length;
      });
    }

    var form = document.getElementById('wiki-edit-form');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        self.saveWikiPage();
      });
    }

    var historyBtn = document.getElementById('btn-wiki-history');
    if (historyBtn) {
      historyBtn.addEventListener('click', function() { self.showWikiHistory(); });
    }
  },

  editWikiPage: function(slug) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    document.getElementById('wiki-edit-title').textContent = 'Modifier: ' + slug;
    document.getElementById('wiki-edit-slug').value = slug;
    document.getElementById('wiki-edit-slug').disabled = true;

    fetch('/api/wiki/' + slug).then(function(r) { return r.text(); }).then(function(md) {
      md = md.replace(/^<!--[\s\S]*?-->\n?/, '');
      document.getElementById('wiki-edit-content').value = md;
      document.getElementById('wiki-char-count').textContent = md.length;
      UI.openModal('modal-wiki-edit');
    });
  },

  saveWikiPage: async function() {
    var slug = document.getElementById('wiki-edit-slug').value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    var content = document.getElementById('wiki-edit-content').value;
    var author = App.currentProfile ? App.currentProfile.username : 'Anonyme';

    if (!slug || slug.length < 2) { UI.toast('Slug invalide', 'warning'); return; }
    if (!content || content.length < 10) { UI.toast('Contenu trop court', 'warning'); return; }

    var btn = document.getElementById('btn-wiki-save');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Sauvegarde...';

    try {
      var resp = await fetch('/api/wiki/' + slug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content, author: author })
      });
      var data = await resp.json();

      if (!resp.ok) {
        UI.toast(data.error || 'Erreur', 'error');
      } else {
        UI.closeModal('modal-wiki-edit');
        UI.toast(data.isNew ? 'Article créé !' : 'Article mis à jour !', 'success');
        this.loadWiki();
      }
    } catch (e) {
      UI.toast('Erreur réseau', 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Publier';
  },

  showWikiHistory: async function() {
    var container = document.getElementById('wiki-history-content');
    if (!container) return;
    container.innerHTML = '<p class="wiki__load">Chargement...</p>';
    UI.openModal('modal-wiki-history');

    try {
      var resp = await fetch('/api/wiki-history');
      var logs = await resp.json();

      if (logs.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text3);padding:24px">Aucune modification enregistrée</p>';
        return;
      }

      var html = '';
      for (var i = 0; i < logs.length; i++) {
        var log = logs[i];
        html += '<div class="adm" style="cursor:default">' +
          '<div class="adm__info">' +
          '<div class="adm__title">' + (log.isNew ? '📝 Créé' : '✏️ Modifié') + ': ' + App.esc(log.page) + '</div>' +
          '<div class="adm__meta">Par ' + App.esc(log.author) + ' • ' + App.ago(log.timestamp) + ' • ' + log.contentLength + ' car.</div>' +
          '</div></div>';
      }
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<p style="color:var(--red)">Erreur</p>';
    }
  },

  // === COMMUNITY / TAG PROPOSALS ===
  community: function() {
    var self = this;
    var proposeBtn = document.getElementById('btn-propose-tag');
    var formContainer = document.getElementById('tag-proposal-form-container');
    var cancelBtn = document.getElementById('tp-cancel');
    var form = document.getElementById('tag-proposal-form');

    if (proposeBtn) {
      proposeBtn.addEventListener('click', function() {
        if (!App.currentUser) { UI.toast('Connectez-vous pour proposer un tag', 'warning'); return; }
        proposeBtn.style.display = 'none';
        formContainer.style.display = 'block';
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        formContainer.style.display = 'none';
        proposeBtn.style.display = 'inline-flex';
        form.reset();
      });
    }

    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        self.submitTagProposal();
      });
    }
  },

  submitTagProposal: async function() {
    var name = document.getElementById('tp-name').value.trim();
    var icon = document.getElementById('tp-icon').value.trim();
    var description = document.getElementById('tp-description').value.trim();
    var author = App.currentProfile ? App.currentProfile.username : 'Anonyme';

    try {
      var resp = await fetch('/api/tag-proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, icon: icon, description: description, author: author })
      });
      var data = await resp.json();

      if (!resp.ok) {
        UI.toast(data.error || 'Erreur', 'error');
      } else {
        UI.toast('Tag proposé !', 'success');
        document.getElementById('tag-proposal-form').reset();
        document.getElementById('tag-proposal-form-container').style.display = 'none';
        document.getElementById('btn-propose-tag').style.display = 'inline-flex';
        this.loadTagProposals();
      }
    } catch (e) {
      UI.toast('Erreur réseau', 'error');
    }
  },

  loadTagProposals: async function() {
    var container = document.getElementById('tag-proposals-list');
    if (!container) return;

    try {
      var resp = await fetch('/api/tag-proposals');
      var proposals = await resp.json();

      if (proposals.length === 0) {
        container.innerHTML = '<p style="color:var(--text3);font-size:.8rem">Aucune proposition pour le moment</p>';
        return;
      }

      // Sort by votes
      proposals.sort(function(a, b) { return (b.votes || 0) - (a.votes || 0); });

      var html = '';
      for (var i = 0; i < proposals.length; i++) {
        var p = proposals[i];
        var hasVoted = App.currentUser && p.voters && p.voters.includes(App.currentUser.id);
        html += '<div class="adm" style="cursor:default">' +
          '<div style="font-size:1.2rem;margin-right:6px"><i class="fas ' + (p.icon || 'fa-tag') + '"></i></div>' +
          '<div class="adm__info">' +
          '<div class="adm__title">' + App.esc(p.name) + '</div>' +
          '<div class="adm__meta">' + App.esc(p.description) + '</div>' +
          '<div class="adm__meta">Par ' + App.esc(p.author) + ' • ' + App.ago(p.created_at) + '</div>' +
          '</div>' +
          '<button class="vote-btn' + (hasVoted ? ' voted' : '') + '" onclick="UI.voteTagProposal(\'' + p.id + '\')">' +
          '<i class="fas fa-arrow-up"></i> ' + (p.votes || 0) +
          '</button></div>';
      }
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<p style="color:var(--text3)">Erreur</p>';
    }
  },

  voteTagProposal: async function(id) {
    if (!App.currentUser) { UI.toast('Connectez-vous pour voter', 'warning'); return; }

    try {
      var resp = await fetch('/api/tag-proposals/' + id + '/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voter: App.currentUser.id })
      });
      var data = await resp.json();
      if (resp.ok) {
        this.loadTagProposals();
      } else {
        UI.toast(data.error || 'Erreur', 'error');
      }
    } catch (e) {
      UI.toast('Erreur réseau', 'error');
    }
  },

  toast: function(msg, type) {
    type = type || 'info';
    var icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };
    var container = document.getElementById('toast-container');
    if (!container) return;
    var t = document.createElement('div');
    t.className = 'toast toast--' + type;
    t.innerHTML = '<i class="toast__ico fas ' + icons[type] + '"></i><span class="toast__msg">' + msg + '</span><button class="toast__x" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>';
    container.appendChild(t);
    setTimeout(function() {
      if (t.parentElement) {
        t.style.opacity = '0';
        t.style.transform = 'translateX(60px)';
        t.style.transition = '.2s';
        setTimeout(function() { if (t.parentElement) t.remove(); }, 200);
      }
    }, 4000);
  },

  showLoading: function() {
    var el = document.getElementById('loading-overlay');
    if (el) el.classList.add('active');
  },

  hideLoading: function() {
    var el = document.getElementById('loading-overlay');
    if (el) el.classList.remove('active');
  }
};
