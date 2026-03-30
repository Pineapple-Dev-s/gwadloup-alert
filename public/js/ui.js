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
    this.wikiEditor();
    this.communityInit();
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
        console.log('Reports:', App.reports.length);
        console.log('Map:', MapManager.map ? 'OK' : 'MISSING');
        console.log('Markers:', Object.keys(MapManager.markers).length);
        console.log('Groq:', App.config && App.config.hasGroq ? 'AVAILABLE' : 'UNAVAILABLE');
        console.log('Contact:', App.config ? App.config.contactEmail : 'N/A');
        console.log('=== END ===');
        return 'Debug printed';
      },
      test: function() {
        var pass = 0; var fail = 0;
        function check(name, cond) { if (cond) { console.log('  ✅ ' + name); pass++; } else { console.log('  ❌ ' + name); fail++; } }
        check('Config', !!App.config);
        check('Supabase', !!App.supabase);
        check('Map', !!MapManager.map);
        check('Categories', Object.keys(App.categories).length >= 30);
        check('DOM map', !!document.getElementById('map'));
        check('DOM form', !!document.getElementById('report-form'));
        check('DOM community', !!document.getElementById('view-community'));
        check('ImageUpload', typeof ImageUpload.uploadAll === 'function');
        check('Community', typeof Community !== 'undefined');
        console.log('Result: ' + pass + '/' + (pass + fail));
        return pass + '/' + (pass + fail);
      },
      reload: function() { Reports.loadAll(); return 'Reloaded'; },
      toast: function(msg) { UI.toast(msg || 'Test', 'info'); }
    };
    console.log('🏝️ Gwadloup Alèrt — GA.status() | GA.test()');
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

          if (view === 'map' && MapManager.map) setTimeout(function() { MapManager.map.invalidateSize(); }, 150);
          if (view === 'stats') Reports.updateStats();
          if (view === 'wiki') self.loadWiki();
          if (view === 'community') Community.loadProposals();

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
        if (modal) { modal.classList.remove('open'); document.body.style.overflow = ''; }
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
          UI.toast('Connectez-vous pour signaler un problème', 'warning');
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

        var allInd = document.querySelectorAll('.steps__i');
        for (var i = 0; i < allInd.length; i++) allInd[i].classList.remove('active', 'done');
        var firstInd = document.querySelector('.steps__i[data-step="1"]');
        if (firstInd) firstInd.classList.add('active');

        var b1 = document.getElementById('btn-step1-next'); if (b1) b1.disabled = true;
        var b2 = document.getElementById('btn-step2-next'); if (b2) b2.disabled = true;
        var li = document.getElementById('location-info'); if (li) li.style.display = 'none';
        var dc = document.getElementById('desc-count'); if (dc) dc.textContent = '0';
        var ai = document.getElementById('ai-reformulate'); if (ai) ai.style.display = 'none';

        UI.openModal('modal-report');
        setTimeout(function() { MapManager.initMiniMap(); }, 400);
      });
    }
  },

  openModal: function(id) {
    var m = document.getElementById(id);
    if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
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
        if (!navigator.geolocation) { UI.toast('Géolocalisation non supportée', 'error'); return; }
        geoBtn.disabled = true;
        geoBtn.innerHTML = '<span class="spinner"></span> Localisation...';
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
            geoBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Me localiser';
          },
          function() {
            UI.toast('Impossible d\'obtenir votre position', 'warning');
            geoBtn.disabled = false;
            geoBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Me localiser';
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
              searchResults.classList.remove('open');
            }
          });
        }, 400);
      });

      searchResults.addEventListener('click', function(e) {
        var item = e.target.closest('.loc-r');
        if (item && item.dataset.lat) {
          var lat = parseFloat(item.dataset.lat);
          var lon = parseFloat(item.dataset.lon);
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
      else document.getElementById('wiki-content').innerHTML = '<p>Aucune page wiki</p>';
    }).catch(function() {
      document.getElementById('wiki-content').innerHTML = '<p>Erreur de chargement</p>';
    });
  },

  loadWikiPage: function(slug) {
    var el = document.getElementById('wiki-content');
    if (!el) return;
    el.innerHTML = '<p class="wiki__load">Chargement...</p>';

    fetch('/api/wiki/' + slug).then(function(r) {
      if (!r.ok) throw new Error();
      return r.json();
    }).then(function(data) {
      var editBtn = '';
      if (App.currentUser) {
        editBtn = '<div style="display:flex;gap:8px;margin-bottom:16px;justify-content:flex-end">' +
          '<button class="btn btn--ghost" onclick="UI.editWikiPage(\'' + slug + '\')"><i class="fas fa-edit"></i> Modifier</button>' +
          (App.currentProfile && App.currentProfile.role === 'admin' ?
            '<button class="btn btn--ghost" style="color:var(--red)" onclick="UI.deleteWikiPage(\'' + slug + '\')"><i class="fas fa-trash"></i> Supprimer</button>' : '') +
        '</div>';
      }
      el.innerHTML = editBtn + marked.parse(data.content);
    }).catch(function() {
      el.innerHTML = '<p>Page introuvable</p>';
    });
  },

  wikiEditor: function() {
    var self = this;

    var newBtn = document.getElementById('btn-wiki-new');
    if (newBtn) {
      newBtn.addEventListener('click', function() {
        if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
        document.getElementById('wiki-edit-title').textContent = 'Nouvel article';
        document.getElementById('wiki-edit-slug').value = '';
        document.getElementById('wiki-edit-slug').disabled = false;
        document.getElementById('wiki-edit-content').value = '# Mon article\n\nContenu ici...';
        UI.openModal('modal-wiki-edit');
      });
    }

    var saveBtn = document.getElementById('btn-wiki-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        self.saveWikiPage();
      });
    }
  },

  editWikiPage: function(slug) {
    document.getElementById('wiki-edit-title').textContent = 'Modifier: ' + slug;
    document.getElementById('wiki-edit-slug').value = slug;
    document.getElementById('wiki-edit-slug').disabled = true;

    fetch('/api/wiki/' + slug).then(function(r) { return r.json(); }).then(function(data) {
      // Remove metadata comment if present
      var content = data.content.replace(/^<!--[\s\S]*?-->\n?/, '');
      document.getElementById('wiki-edit-content').value = content;
      UI.openModal('modal-wiki-edit');
    }).catch(function() {
      UI.toast('Erreur de chargement', 'error');
    });
  },

  async saveWikiPage() {
    var slug = document.getElementById('wiki-edit-slug').value.trim().toLowerCase()
      .replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    var content = document.getElementById('wiki-edit-content').value;

    if (!slug || slug.length < 2) { UI.toast('Nom de page invalide (min 2 caractères)', 'warning'); return; }
    if (!content || content.trim().length < 10) { UI.toast('Contenu trop court (min 10 caractères)', 'warning'); return; }

    // Moderate content
    try {
      var modResult = await fetch('/api/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: content })
      }).then(function(r) { return r.json(); });

      if (!modResult.ok) {
        UI.toast('Contenu inapproprié détecté. Merci de reformuler.', 'error');
        return;
      }
    } catch (e) {}

    try {
      var r = await fetch('/api/wiki/' + slug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content,
          author: App.currentProfile ? App.currentProfile.username : 'Anonyme'
        })
      });
      var result = await r.json();

      if (result.ok) {
        UI.closeModal('modal-wiki-edit');
        UI.toast('Article sauvegardé ! 📝', 'success');
        this.loadWiki();
      } else {
        UI.toast(result.error || 'Erreur', 'error');
      }
    } catch (e) {
      UI.toast('Erreur réseau', 'error');
    }
  },

  async deleteWikiPage(slug) {
    if (!confirm('Supprimer cette page wiki ? Cette action est irréversible.')) return;

    try {
      var r = await fetch('/api/wiki/' + slug, { method: 'DELETE' });
      var result = await r.json();

      if (result.ok) {
        UI.toast('Page supprimée', 'success');
        this.loadWiki();
      } else {
        UI.toast(result.error || 'Erreur', 'error');
      }
    } catch (e) {
      UI.toast('Erreur réseau', 'error');
    }
  },

  // === COMMUNITY ===

  communityInit: function() {
    var tagBtn = document.getElementById('btn-new-tag');
    if (tagBtn) {
      tagBtn.addEventListener('click', function() {
        if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
        document.getElementById('tag-proposal-form').style.display = 'block';
        tagBtn.style.display = 'none';
      });
    }

    var submitTag = document.getElementById('btn-submit-tag');
    if (submitTag) {
      submitTag.addEventListener('click', function() {
        Community.submitProposal();
      });
    }
  },

  toast: function(msg, type) {
    type = type || 'info';
    var icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    var container = document.getElementById('toast-container');
    if (!container) return;
    var t = document.createElement('div');
    t.className = 'toast toast--' + type;
    t.innerHTML = '<i class="toast__ico fas ' + icons[type] + '"></i><span class="toast__msg">' + msg + '</span><button class="toast__x" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>';
    container.appendChild(t);
    setTimeout(function() {
      if (t.parentElement) {
        t.style.opacity = '0'; t.style.transform = 'translateX(60px)'; t.style.transition = '.2s';
        setTimeout(function() { if (t.parentElement) t.remove(); }, 200);
      }
    }, 4000);
  },

  showLoading: function() { var el = document.getElementById('loading-overlay'); if (el) el.classList.add('active'); },
  hideLoading: function() { var el = document.getElementById('loading-overlay'); if (el) el.classList.remove('active'); }
};

// === COMMUNITY MODULE ===

var Community = {
  async loadProposals() {
    var el = document.getElementById('tag-proposals-list');
    if (!el) return;

    try {
      var { data } = await App.supabase.from('tag_proposals')
        .select('*, profiles(username)')
        .order('votes', { ascending: false });

      if (!data || data.length === 0) {
        el.innerHTML = '<p style="font-size:.8rem;color:var(--text3)">Aucune proposition pour le moment</p>';
        return;
      }

      var html = '';
      data.forEach(function(p) {
        var authorName = (p.profiles && p.profiles.username) || 'Anonyme';
        var statusBadge = p.status === 'approved' ? '<span class="badge badge--resolved">✅ Approuvé</span>' :
                          p.status === 'rejected' ? '<span class="badge badge--rejected">❌ Rejeté</span>' :
                          '<span class="badge badge--pending">⏳ En vote</span>';

        html += '<div style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--bg3);border-radius:var(--r);margin-bottom:4px">' +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:2px">' +
            '<button class="btn btn--ghost" onclick="Community.voteProposal(\'' + p.id + '\')" style="padding:2px 6px;font-size:.85rem" title="Voter"><i class="fas fa-arrow-up"></i></button>' +
            '<span style="font-weight:700;color:var(--orange)">' + (p.votes || 0) + '</span>' +
          '</div>' +
          '<div style="flex:1">' +
            '<div style="font-weight:600;font-size:.85rem">' + App.esc(p.name) + ' ' + statusBadge + '</div>' +
            '<div style="font-size:.75rem;color:var(--text2)">' + App.esc(p.reason || '') + '</div>' +
            '<div style="font-size:.68rem;color:var(--text3)">par ' + App.esc(authorName) + ' · ' + App.ago(p.created_at) + '</div>' +
          '</div>' +
        '</div>';
      });
      el.innerHTML = html;
    } catch (e) {
      el.innerHTML = '<p style="font-size:.8rem;color:var(--text3)">Erreur de chargement</p>';
    }
  },

  async submitProposal() {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }

    var name = document.getElementById('tag-name').value.trim();
    var reason = document.getElementById('tag-reason').value.trim();

    if (!name || name.length < 3) { UI.toast('Nom trop court (min 3 caractères)', 'warning'); return; }

    // Moderate
    try {
      var modResult = await fetch('/api/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: name, description: reason })
      }).then(function(r) { return r.json(); });

      if (!modResult.ok) {
        UI.toast('Contenu inapproprié détecté', 'error');
        return;
      }
    } catch (e) {}

    try {
      var { error } = await App.supabase.from('tag_proposals').insert({
        name: name,
        reason: reason,
        user_id: App.currentUser.id,
        status: 'pending',
        votes: 1
      });

      if (error) throw error;

      UI.toast('Proposition soumise ! La communauté peut voter 🗳️', 'success');
      document.getElementById('tag-name').value = '';
      document.getElementById('tag-reason').value = '';
      document.getElementById('tag-proposal-form').style.display = 'none';
      var tagBtn = document.getElementById('btn-new-tag');
      if (tagBtn) tagBtn.style.display = 'inline-flex';
      this.loadProposals();
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  },

  async voteProposal(id) {
    if (!App.currentUser) { UI.toast('Connectez-vous pour voter', 'warning'); return; }

    try {
      // Check if already voted
      var { data: existing } = await App.supabase.from('tag_proposal_votes')
        .select('id').eq('proposal_id', id).eq('user_id', App.currentUser.id).single();

      if (existing) {
        UI.toast('Vous avez déjà voté pour cette proposition', 'info');
        return;
      }

      // Insert vote
      await App.supabase.from('tag_proposal_votes').insert({
        proposal_id: id,
        user_id: App.currentUser.id
      });

      // Increment count
      await App.supabase.rpc('increment_tag_votes', { pid: id });

      UI.toast('Vote enregistré ! 👍', 'success');
      this.loadProposals();
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  }
};
