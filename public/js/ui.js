var UI = {
  init: function() {
    this.nav();
    this.modals();
    this.filters();
    this.form();
    this.burger();
    this.catGrid();
    this.debug();
    ImageUpload.init();
  },

  debug: function() {
    // Debug commands in console: type GA.status() or GA.test()
    window.GA = {
      status: function() {
        console.log('%c=== GWADLOUP ALÈRT DEBUG ===', 'color:#3fb950;font-weight:bold;font-size:14px');
        console.log('Supabase URL:', App.config ? App.config.supabaseUrl : 'NOT LOADED');
        console.log('Supabase client:', App.supabase ? 'OK' : 'MISSING');
        console.log('User:', App.currentUser ? App.currentUser.email : 'Not logged in');
        console.log('Profile:', App.currentProfile ? JSON.stringify(App.currentProfile) : 'None');
        console.log('Reports loaded:', App.reports.length);
        console.log('Map:', MapManager.map ? 'OK' : 'MISSING');
        console.log('Markers:', Object.keys(MapManager.markers).length);
        console.log('Filters:', JSON.stringify(App.filters));
        console.log('ImgBB key:', App.config && App.config.imgbbApiKey ? 'SET' : 'MISSING');

        var views = document.querySelectorAll('.view');
        var activeView = 'none';
        views.forEach(function(v) { if (v.classList.contains('active')) activeView = v.id; });
        console.log('Active view:', activeView);

        var modals = document.querySelectorAll('.modal.open');
        console.log('Open modals:', modals.length);

        console.log('%c=== END DEBUG ===', 'color:#3fb950;font-weight:bold');
        return 'Debug info printed above';
      },

      test: function() {
        console.log('%c=== RUNNING TESTS ===', 'color:#58a6ff;font-weight:bold');
        var pass = 0;
        var fail = 0;

        function check(name, condition) {
          if (condition) { console.log('  ✅ ' + name); pass++; }
          else { console.log('  ❌ ' + name); fail++; }
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
        check('DOM: step-1', !!document.getElementById('step-1'));
        check('DOM: step-2', !!document.getElementById('step-2'));
        check('DOM: step-3', !!document.getElementById('step-3'));
        check('DOM: mini-map', !!document.getElementById('mini-map'));
        check('ImageUpload ready', typeof ImageUpload.uploadAll === 'function');

        console.log('%c  Result: ' + pass + ' passed, ' + fail + ' failed', fail > 0 ? 'color:#f85149' : 'color:#3fb950');
        return pass + '/' + (pass + fail) + ' tests passed';
      },

      reload: function() {
        Reports.loadAll();
        return 'Reports reloaded';
      },

      toast: function(msg) {
        UI.toast(msg || 'Test notification', 'info');
        return 'Toast shown';
      },

      user: function() {
        return App.currentUser || 'Not logged in';
      },

      reports: function() {
        return App.reports;
      }
    };

    console.log('%cgwadloup%calèrt%c — Console debug ready. Type GA.status() or GA.test()', 'color:#e6edf3;font-weight:700', 'color:#3fb950;font-weight:700', 'color:#8b949e');
  },

  catGrid: function() {
    var g = document.getElementById('category-grid');
    if (!g) return;
    var html = '';
    var keys = Object.keys(App.categories);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = App.categories[k];
      html += '<label class="catc"><input type="radio" name="category" value="' + k + '"><div class="catc__ico">' + v.emoji + '</div><div class="catc__name">' + v.label + '</div></label>';
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
    // Close buttons
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

    // Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var openModals = document.querySelectorAll('.modal.open');
        for (var i = 0; i < openModals.length; i++) openModals[i].classList.remove('open');
        document.body.style.overflow = '';
      }
    });

    // New report button
    var reportBtn = document.getElementById('btn-new-report');
    if (reportBtn) {
      reportBtn.addEventListener('click', function() {
        if (!App.currentUser) {
          UI.toast('Connectez-vous d\'abord', 'warning');
          UI.openModal('modal-login');
          return;
        }

        // Reset form
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

    // Step 1 next
    var s1btn = document.getElementById('btn-step1-next');
    if (s1btn) s1btn.addEventListener('click', function() { self.goStep(2); });

    // Step 2 next
    var s2btn = document.getElementById('btn-step2-next');
    if (s2btn) s2btn.addEventListener('click', function() { self.goStep(3); });

    // Prev buttons
    var prevBtns = document.querySelectorAll('[data-prev]');
    for (var i = 0; i < prevBtns.length; i++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          self.goStep(parseInt(btn.getAttribute('data-prev')));
        });
      })(prevBtns[i]);
    }

    // Geolocate
    var geoBtn = document.getElementById('btn-geolocate');
    if (geoBtn) {
      geoBtn.addEventListener('click', function() {
        if (!navigator.geolocation) { UI.toast('Non supporté', 'error'); return; }
        geoBtn.disabled = true;
        geoBtn.textContent = 'Localisation...';
        navigator.geolocation.getCurrentPosition(
          function(pos) {
            var lat = pos.coords.latitude;
            var lng = pos.coords.longitude;
            if (lat < 15.8 || lat > 16.6 || lng < -61.9 || lng > -60.9) {
              UI.toast('Hors Guadeloupe', 'warning');
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

    // Address search
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

    // Description counter
    var descEl = document.getElementById('report-description');
    if (descEl) {
      descEl.addEventListener('input', function() {
        var dc = document.getElementById('desc-count');
        if (dc) dc.textContent = descEl.value.length;
      });
    }

    // Priority
    var prios = document.querySelectorAll('.prio');
    for (var i = 0; i < prios.length; i++) {
      (function(p) {
        p.addEventListener('click', function() {
          for (var j = 0; j < prios.length; j++) prios[j].classList.remove('active');
          p.classList.add('active');
        });
      })(prios[i]);
    }

    // Submit
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
        if (content) content.innerHTML = '<p>Aucune page</p>';
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
      el.innerHTML = marked.parse(md);
    }).catch(function() {
      el.innerHTML = '<p>Page introuvable</p>';
    });
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
