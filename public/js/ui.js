var UI = {
  catIcons: {
    road: 'fa-road', warning: 'fa-exclamation-triangle', sign: 'fa-sign', marking: 'fa-paint-roller',
    bump: 'fa-wave-square', car: 'fa-car', boat: 'fa-ship', dump: 'fa-trash',
    beach: 'fa-umbrella-beach', river: 'fa-water', bin: 'fa-trash-alt',
    light: 'fa-lightbulb', cable: 'fa-bolt', leak: 'fa-tint',
    flood: 'fa-house-flood-water', sewer: 'fa-faucet-drip', stagnant: 'fa-droplet',
    plant: 'fa-leaf', tree: 'fa-tree', invasive: 'fa-seedling',
    building: 'fa-building', abandoned: 'fa-building-circle-xmark',
    sidewalk: 'fa-person-walking', railing: 'fa-grip-lines',
    danger: 'fa-shield-halved', crosswalk: 'fa-crosshairs', school: 'fa-school',
    noise: 'fa-volume-high', animals: 'fa-paw', mosquito: 'fa-mosquito',
    other: 'fa-map-pin', graffiti: 'fa-spray-can'
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
    this.keyboardShortcuts();
    this.networkStatus();
  },

  // ═══════════════ NAVIGATION ═══════════════
  nav: function() {
    var tabs = document.querySelectorAll('.hdr__tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function() {
        var view = this.getAttribute('data-view');
        tabs.forEach(function(t) { t.classList.remove('active'); });
        this.classList.add('active');
        document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
        var target = document.getElementById('view-' + view);
        if (target) target.classList.add('active');

        // View-specific actions
        if (view === 'map' && MapManager.map) {
          setTimeout(function() { MapManager.map.invalidateSize(); }, 100);
        }
        if (view === 'stats') Reports.updateStats();
        if (view === 'wiki') { UI.loadWikiStatic(); UI.loadCommunityArticles(); }
        if (view === 'community') UI.loadTagProposals();

        // Close burger on mobile
        var nav = document.getElementById('main-nav');
        var burger = document.getElementById('burger-menu');
        if (nav) nav.classList.remove('open');
        if (burger) burger.classList.remove('open');
      });
    }

    // Logo click = map
    var logo = document.getElementById('logo-link');
    if (logo) logo.addEventListener('click', function(e) {
      e.preventDefault();
      var mapTab = document.querySelector('[data-view="map"]');
      if (mapTab) mapTab.click();
    });
  },

  // ═══════════════ MODALS ═══════════════
  modals: function() {
    document.querySelectorAll('[data-close]').forEach(function(el) {
      el.addEventListener('click', function() {
        var modal = this.closest('.modal');
        if (modal) modal.classList.remove('open');
      });
    });
  },

  openModal: function(id) {
    var m = document.getElementById(id);
    if (m) m.classList.add('open');
  },

  closeModal: function(id) {
    var m = document.getElementById(id);
    if (m) m.classList.remove('open');
  },

  // ═══════════════ FILTERS ═══════════════
  filters: function() {
    var self = this;
    var filterCat = document.getElementById('filter-category');
    var filterStatus = document.getElementById('filter-status');
    var filterCommune = document.getElementById('filter-commune');
    var resetBtn = document.getElementById('btn-reset-filters');
    var sortReports = document.getElementById('sort-reports');

    function applyFilters() {
      App.filters.category = filterCat ? filterCat.value : '';
      App.filters.status = filterStatus ? filterStatus.value : '';
      App.filters.commune = filterCommune ? filterCommune.value : '';
      Reports.loadAll();
    }

    if (filterCat) filterCat.addEventListener('change', applyFilters);
    if (filterStatus) filterStatus.addEventListener('change', applyFilters);
    if (filterCommune) filterCommune.addEventListener('change', applyFilters);
    if (sortReports) sortReports.addEventListener('change', function() { Reports.renderList(); });

    if (resetBtn) resetBtn.addEventListener('click', function() {
      if (filterCat) filterCat.value = '';
      if (filterStatus) filterStatus.value = '';
      if (filterCommune) filterCommune.value = '';
      App.filters = { category: '', status: '', commune: '' };
      Reports.loadAll();
    });
  },

  // ═══════════════ FORM (Report steps) ═══════════════
  form: function() {
    var self = this;

    // Step navigation
    document.querySelectorAll('[data-prev]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var prev = parseInt(this.getAttribute('data-prev'));
        self._goStep(prev);
      });
    });

    var step1Next = document.getElementById('btn-step1-next');
    if (step1Next) step1Next.addEventListener('click', function() { self._goStep(2); });

    var step2Next = document.getElementById('btn-step2-next');
    if (step2Next) step2Next.addEventListener('click', function() { self._goStep(3); });

    // Description counter
    var desc = document.getElementById('report-description');
    if (desc) desc.addEventListener('input', function() {
      var counter = document.getElementById('desc-count');
      if (counter) counter.textContent = this.value.length;
    });

    // Form submit
    var form = document.getElementById('report-form');
    if (form) form.addEventListener('submit', function(e) { e.preventDefault(); Reports.submitReport(); });

    // Geolocate
    var geoBtn = document.getElementById('btn-geolocate');
    if (geoBtn) geoBtn.addEventListener('click', function() {
      if (!navigator.geolocation) { UI.toast('Géolocalisation non disponible', 'error'); return; }
      UI.toast('Localisation en cours...', 'info');
      navigator.geolocation.getCurrentPosition(function(pos) {
        var lat = pos.coords.latitude, lng = pos.coords.longitude;
        if (MapManager.isInGuadeloupe(lat, lng)) {
          MapManager.setPin(lat, lng);
          MapManager.reverseGeo(lat, lng);
        } else {
          UI.toast('Position hors Guadeloupe', 'warning');
        }
      }, function() {
        UI.toast('Impossible de vous localiser', 'error');
      }, { enableHighAccuracy: true, timeout: 10000 });
    });

    // Address search
    var searchInput = document.getElementById('address-search');
    var searchResults = document.getElementById('search-results');
    var searchTimer = null;
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        clearTimeout(searchTimer);
        var q = this.value.trim();
        if (q.length < 3) { if (searchResults) searchResults.classList.remove('open'); return; }
        searchTimer = setTimeout(function() {
          MapManager.searchAddr(q).then(function(results) {
            if (!results || results.length === 0) { searchResults.classList.remove('open'); return; }
            var html = '';
            for (var i = 0; i < results.length; i++) {
              html += '<div class="loc-r" data-lat="' + results[i].lat + '" data-lng="' + results[i].lon + '">' + App.esc(results[i].display_name) + '</div>';
            }
            searchResults.innerHTML = html;
            searchResults.classList.add('open');

            searchResults.querySelectorAll('.loc-r').forEach(function(r) {
              r.addEventListener('click', function() {
                var lat = parseFloat(this.getAttribute('data-lat'));
                var lng = parseFloat(this.getAttribute('data-lng'));
                MapManager.setPin(lat, lng);
                MapManager.reverseGeo(lat, lng);
                searchInput.value = this.textContent;
                searchResults.classList.remove('open');
              });
            });
          });
        }, 400);
      });
    }

    // Image upload
    if (typeof ImageUpload !== 'undefined') ImageUpload.init();
  },

  _goStep: function(step) {
    document.querySelectorAll('.fstep').forEach(function(s) { s.classList.remove('active'); });
    document.querySelectorAll('.steps__i').forEach(function(s) {
      var sn = parseInt(s.getAttribute('data-step'));
      s.classList.remove('active', 'done');
      if (sn < step) s.classList.add('done');
      if (sn === step) s.classList.add('active');
    });
    var target = document.getElementById('step-' + step);
    if (target) target.classList.add('active');

    // Init mini map on step 2
    if (step === 2) {
      setTimeout(function() { MapManager.initMiniMap(); }, 100);
    }
  },

  openReportModal: function() {
    // Reset form
    var form = document.getElementById('report-form');
    if (form) form.reset();
    this._goStep(1);
    var step1Btn = document.getElementById('btn-step1-next');
    if (step1Btn) step1Btn.disabled = true;
    var step2Btn = document.getElementById('btn-step2-next');
    if (step2Btn) step2Btn.disabled = true;
    ImageUpload.reset();
    var descCount = document.getElementById('desc-count');
    if (descCount) descCount.textContent = '0';
    var locInfo = document.getElementById('location-info');
    if (locInfo) locInfo.style.display = 'none';
    this.openModal('modal-report');
  },

  // ═══════════════ BURGER ═══════════════
  burger: function() {
    var burger = document.getElementById('burger-menu');
    var nav = document.getElementById('main-nav');
    if (burger && nav) {
      burger.addEventListener('click', function() {
        burger.classList.toggle('open');
        nav.classList.toggle('open');
      });
    }
  },

  // ═══════════════ CATEGORY GRID ═══════════════
  catGrid: function() {
    var grid = document.getElementById('category-grid');
    if (!grid) return;
    var html = '';
    for (var key in App.categories) {
      var cat = App.categories[key];
      var fa = this.catIcons[cat.icon] || 'fa-map-pin';
      html += '<label class="catc"><input type="radio" name="category" value="' + key + '">' +
        '<span class="catc__ico"><i class="fas ' + fa + '"></i></span>' +
        '<span class="catc__name">' + cat.label + '</span></label>';
    }
    grid.innerHTML = html;

    // Enable next button on selection
    grid.addEventListener('change', function() {
      var btn = document.getElementById('btn-step1-next');
      if (btn) btn.disabled = false;
    });
  },

  // ═══════════════ COMMUNITY (tags) ═══════════════
  community: function() {
    var proposeBtn = document.getElementById('btn-propose-tag');
    var formContainer = document.getElementById('tag-proposal-form-container');
    var cancelBtn = document.getElementById('tp-cancel');
    var form = document.getElementById('tag-proposal-form');

    if (proposeBtn) proposeBtn.addEventListener('click', function() {
      if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
      if (formContainer) formContainer.style.display = formContainer.style.display === 'none' ? 'block' : 'none';
    });

    if (cancelBtn) cancelBtn.addEventListener('click', function() {
      if (formContainer) formContainer.style.display = 'none';
    });

    if (form) form.addEventListener('submit', function(e) {
      e.preventDefault();
      UI.submitTagProposal();
    });
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
    } catch(e) {
      UI.toast('Erreur: ' + (e.message || 'Échec'), 'error');
    }
  },

  loadTagProposals: async function() {
    var list = document.getElementById('tag-proposals-list');
    if (!list) return;
    try {
      var result = await App.supabase.from('tag_proposals').select('*').order('upvotes', { ascending: false });
      if (!result.data || result.data.length === 0) {
        list.innerHTML = '<p style="color:var(--text3);font-size:.8rem">Aucune proposition pour le moment</p>';
        return;
      }
      var html = '';
      for (var i = 0; i < result.data.length; i++) {
        var t = result.data[i];
        var statusBadge = t.status === 'approved' ? '<span class="badge badge--resolved">Approuvé</span>' :
          t.status === 'rejected' ? '<span class="badge badge--rejected">Rejeté</span>' :
          '<span class="badge badge--pending">En attente</span>';
        html += '<div class="adm" style="margin-bottom:6px">' +
          '<div style="font-size:1.2rem;width:36px;text-align:center"><i class="fas ' + App.esc(t.icon || 'fa-tag') + '"></i></div>' +
          '<div class="adm__info"><div class="adm__title">' + App.esc(t.name) + ' ' + statusBadge + '</div>' +
          '<div class="adm__meta">' + App.esc(t.description) + ' · par ' + App.esc(t.author_name) + '</div></div>' +
          '<button class="vote-btn" onclick="UI.voteTagProposal(\'' + t.id + '\')"><i class="fas fa-arrow-up"></i> ' + (t.upvotes || 0) + '</button></div>';
      }
      list.innerHTML = html;
    } catch(e) {
      list.innerHTML = '<p style="color:var(--text3)">Erreur de chargement</p>';
    }
  },

  voteTagProposal: async function(id) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    try {
      var existing = await App.supabase.from('tag_votes').select('id').eq('proposal_id', id).eq('user_id', App.currentUser.id).maybeSingle();
      if (existing.data) { UI.toast('Déjà voté', 'info'); return; }
      await App.supabase.from('tag_votes').insert({ proposal_id: id, user_id: App.currentUser.id });
      var allVotes = await App.supabase.from('tag_votes').select('id').eq('proposal_id', id);
      var count = (allVotes.data && allVotes.data.length) || 0;
      await App.supabase.from('tag_proposals').update({ upvotes: count }).eq('id', id);
      UI.toast('Vote enregistré !', 'success');
      this.loadTagProposals();
    } catch(e) { UI.toast('Erreur', 'error'); }
  },

  // ═══════════════ WIKI TABS ═══════════════
  wikiTabs: function() {
    var tabs = document.querySelectorAll('.wiki-tab');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        var target = this.getAttribute('data-wtab');
        tabs.forEach(function(t) { t.classList.remove('active'); });
        this.classList.add('active');
        document.querySelectorAll('.wiki-panel').forEach(function(p) { p.classList.remove('active'); });
        var panel = document.getElementById('wpanel-' + target);
        if (panel) panel.classList.add('active');
      });
    });

    // Filter/sort for community articles
    var catFilter = document.getElementById('wiki-cat-filter');
    var wikiSort = document.getElementById('wiki-sort');
    if (catFilter) catFilter.addEventListener('change', function() { UI.loadCommunityArticles(); });
    if (wikiSort) wikiSort.addEventListener('change', function() { UI.loadCommunityArticles(); });
  },

  // ═══════════════ WIKI STATIC (official docs) ═══════════════
  loadWikiStatic: async function() {
    var nav = document.getElementById('wiki-nav');
    var content = document.getElementById('wiki-content');
    if (!nav) return;
    try {
      var resp = await fetch('/api/wiki-static');
      var pages = await resp.json();
      if (!pages.length) { nav.innerHTML = '<p style="color:var(--text3);font-size:.75rem">Aucun guide</p>'; return; }
      var html = '';
      for (var i = 0; i < pages.length; i++) {
        html += '<button class="wnav' + (i === 0 ? ' active' : '') + '" data-slug="' + pages[i].slug + '">' + App.esc(pages[i].title) + '</button>';
      }
      nav.innerHTML = html;

      // Load first page
      this._loadWikiPage(pages[0].slug);

      nav.querySelectorAll('.wnav').forEach(function(btn) {
        btn.addEventListener('click', function() {
          nav.querySelectorAll('.wnav').forEach(function(b) { b.classList.remove('active'); });
          this.classList.add('active');
          UI._loadWikiPage(this.getAttribute('data-slug'));
        });
      });
    } catch(e) {
      if (nav) nav.innerHTML = '<p style="color:var(--text3)">Erreur</p>';
    }
  },

  _loadWikiPage: async function(slug) {
    var content = document.getElementById('wiki-content');
    if (!content) return;
    content.innerHTML = '<p class="wiki__load">Chargement...</p>';
    try {
      var resp = await fetch('/api/wiki-static/' + slug);
      if (!resp.ok) throw new Error();
      var md = await resp.text();
      content.innerHTML = marked.parse(md);
    } catch(e) {
      content.innerHTML = '<p style="color:var(--text3)">Erreur de chargement</p>';
    }
  },

  // ═══════════════ WIKI COMMUNITY ARTICLES ═══════════════
  loadCommunityArticles: async function() {
    var list = document.getElementById('community-articles-list');
    if (!list) return;
    list.innerHTML = '<p class="wiki__load">Chargement...</p>';

    try {
      var catFilter = document.getElementById('wiki-cat-filter');
      var sortEl = document.getElementById('wiki-sort');
      var cat = catFilter ? catFilter.value : '';
      var sort = sortEl ? sortEl.value : 'newest';

      var query = App.supabase.from('wiki_articles').select('*');
      if (cat) query = query.eq('category', cat);

      if (sort === 'popular') {
        query = query.order('upvotes', { ascending: false });
      } else {
        query = query.order('pinned', { ascending: false }).order('created_at', { ascending: false });
      }

      var result = await query;
      if (!result.data || result.data.length === 0) {
        list.innerHTML = '<div class="empty"><span><i class="fas fa-book-open fa-3x"></i></span><h3>Aucun article</h3><p style="color:var(--text2)">Soyez le premier à écrire !</p></div>';
        return;
      }

      var catEmojis = { general: '📌', guide: '📖', info: 'ℹ️', discussion: '💬', proposition: '💡' };
      var html = '';
      for (var i = 0; i < result.data.length; i++) {
        var a = result.data[i];
        var emoji = catEmojis[a.category] || '📌';
        var preview = (a.content || '').replace(/[#*_`\[\]]/g, '').substring(0, 120);
        html += '<div class="wcard" onclick="UI.openArticle(\'' + a.id + '\')">' +
          '<div class="wcard__head">' +
            '<span class="wcard__cat">' + emoji + ' ' + App.esc(a.category || 'general') + '</span>' +
            '<span class="wcard__date">' + App.ago(a.created_at) + '</span>' +
          '</div>' +
          (a.pinned ? '<span style="font-size:.65rem;color:var(--yellow);margin-bottom:4px;display:inline-block"><i class="fas fa-thumbtack"></i> Épinglé</span>' : '') +
          '<div class="wcard__title">' + App.esc(a.title) + '</div>' +
          '<div class="wcard__preview">' + App.esc(preview) + '...</div>' +
          '<div class="wcard__foot">' +
            '<span class="wcard__author"><i class="fas fa-user"></i> ' + App.esc(a.author_name || 'Anonyme') + '</span>' +
            '<span class="wcard__votes"><i class="fas fa-arrow-up"></i> ' + (a.upvotes || 0) + ' · <i class="fas fa-eye"></i> ' + (a.views || 0) + '</span>' +
          '</div></div>';
      }
      list.innerHTML = html;
    } catch(e) {
      list.innerHTML = '<p style="color:var(--text3)">Erreur de chargement</p>';
    }
  },

  // ═══════════════ OPEN ARTICLE ═══════════════
  openArticle: async function(id) {
    var container = document.getElementById('wiki-article-detail');
    if (!container) return;
    container.innerHTML = '<p class="wiki__load">Chargement...</p>';
    this.openModal('modal-wiki-article');

    try {
      // Increment views
      var viewResult = await App.supabase.from('wiki_articles').select('views').eq('id', id).single();
      if (viewResult.data) {
        await App.supabase.from('wiki_articles').update({ views: (viewResult.data.views || 0) + 1 }).eq('id', id);
      }

      // Load article
      var result = await App.supabase.from('wiki_articles').select('*').eq('id', id).single();
      if (!result.data) { container.innerHTML = '<p style="color:var(--text3)">Article introuvable</p>'; return; }
      var a = result.data;

      var isAdmin = App.currentProfile && App.currentProfile.role === 'admin';
      var isAuthor = App.currentUser && a.author_id === App.currentUser.id;

      // Check user vote
      var hasVoted = false;
      if (App.currentUser) {
        var voteCheck = await App.supabase.from('wiki_votes').select('id').eq('article_id', id).eq('user_id', App.currentUser.id).maybeSingle();
        if (voteCheck.data) hasVoted = true;
      }

      // Count real votes
      var voteCountResult = await App.supabase.from('wiki_votes').select('id').eq('article_id', id);
      var realVotes = (voteCountResult.data && voteCountResult.data.length) || 0;

      var catEmojis = { general: '📌', guide: '📖', info: 'ℹ️', discussion: '💬', proposition: '💡' };
      var emoji = catEmojis[a.category] || '📌';

      var html = '<div style="padding:20px">';

      // Header
      html += '<div style="margin-bottom:16px">' +
        '<span class="wcard__cat">' + emoji + ' ' + App.esc(a.category) + '</span> ' +
        '<span style="font-size:.68rem;color:var(--text3)">' + App.ago(a.created_at) + '</span>' +
        (a.pinned ? ' <span style="font-size:.65rem;color:var(--yellow)"><i class="fas fa-thumbtack"></i> Épinglé</span>' : '') +
        '<h2 style="font-size:1.3rem;font-weight:700;margin:8px 0 4px">' + App.esc(a.title) + '</h2>' +
        '<div style="font-size:.78rem;color:var(--text2)">' +
          '<span style="cursor:pointer;text-decoration:underline dotted" onclick="UI.openPublicProfile(\'' + a.author_id + '\')"><i class="fas fa-user" style="color:var(--green)"></i> ' + App.esc(a.author_name || 'Anonyme') + '</span>' +
          ' · <i class="fas fa-eye"></i> ' + ((a.views || 0) + 1) +
          ' · <i class="fas fa-arrow-up" style="color:var(--orange)"></i> ' + realVotes +
        '</div></div>';

      // Content (markdown)
      html += '<div class="wiki__body" style="border:none;padding:0;margin-bottom:16px">' + marked.parse(a.content || '') + '</div>';

      // Poll
      if (a.poll_data) {
        html += Polls.renderPoll(a.poll_data, id);
      }

      // Actions
      html += '<div style="display:flex;gap:6px;flex-wrap:wrap;padding:12px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:16px">';

      // Vote button
      html += '<button class="vote-btn' + (hasVoted ? ' voted' : '') + '" id="wiki-vote-btn-' + id + '"><i class="fas fa-arrow-up"></i> <span>' + realVotes + '</span> Voter</button>';

      // Share button
      html += '<button class="btn btn--outline" id="wiki-share-btn-' + id + '"><i class="fas fa-share-alt"></i> Partager</button>';

      // Admin: pin
      if (isAdmin) {
        html += '<button class="btn btn--outline" id="wiki-pin-btn-' + id + '"><i class="fas fa-thumbtack"></i> ' + (a.pinned ? 'Désépingler' : 'Épingler') + '</button>';
      }

      // Delete (admin or author)
      if (isAdmin || isAuthor) {
        html += '<button class="btn btn--danger" id="wiki-del-btn-' + id + '"><i class="fas fa-trash"></i> Supprimer</button>';
      }
      html += '</div>';

      // Comments section
      html += '<div class="comments">';
      html += '<div class="comments__title"><i class="fas fa-comments"></i> Commentaires</div>';

      if (App.currentUser) {
        html += '<div class="cmtform">' +
          '<textarea id="wiki-comment-input-' + id + '" placeholder="Votre commentaire..." rows="2"></textarea>' +
          '<button class="btn btn--primary" id="wiki-comment-btn-' + id + '"><i class="fas fa-paper-plane"></i></button></div>';
      }

      html += '<div id="wiki-comments-list-' + id + '"></div>';
      html += '</div></div>';

      container.innerHTML = html;

      // Bind events after rendering
      var voteBtn = document.getElementById('wiki-vote-btn-' + id);
      if (voteBtn) voteBtn.addEventListener('click', function() { UI.toggleArticleVote(id); });

      var shareBtn = document.getElementById('wiki-share-btn-' + id);
      if (shareBtn) shareBtn.addEventListener('click', function() { Share.shareArticle(id, a.title); });

      var pinBtn = document.getElementById('wiki-pin-btn-' + id);
      if (pinBtn) pinBtn.addEventListener('click', function() { UI.togglePinArticle(id, !a.pinned); });

      var delBtn = document.getElementById('wiki-del-btn-' + id);
      if (delBtn) delBtn.addEventListener('click', function() { Auth.deleteWikiArticle(id); });

      var cmtBtn = document.getElementById('wiki-comment-btn-' + id);
      if (cmtBtn) cmtBtn.addEventListener('click', function() { UI.addWikiComment(id); });

      // Load comments
      this.loadWikiComments(id);

    } catch(e) {
      console.error('Open article error:', e);
      container.innerHTML = '<p style="color:var(--text3)">Erreur</p>';
    }
  },

  // ═══════════════ ARTICLE ACTIONS ═══════════════
  toggleArticleVote: async function(articleId) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    try {
      var existing = await App.supabase.from('wiki_votes').select('id').eq('article_id', articleId).eq('user_id', App.currentUser.id).maybeSingle();
      if (existing.data) {
        await App.supabase.from('wiki_votes').delete().eq('id', existing.data.id);
        UI.toast('Vote retiré', 'info');
      } else {
        await App.supabase.from('wiki_votes').insert({ article_id: articleId, user_id: App.currentUser.id });
        UI.toast('Merci !', 'success');
      }
      // Update count
      var all = await App.supabase.from('wiki_votes').select('id').eq('article_id', articleId);
      var count = (all.data && all.data.length) || 0;
      await App.supabase.from('wiki_articles').update({ upvotes: count }).eq('id', articleId);
      this.openArticle(articleId);
    } catch(e) { UI.toast('Erreur', 'error'); }
  },

  togglePinArticle: async function(articleId, pin) {
    try {
      await App.supabase.from('wiki_articles').update({ pinned: pin }).eq('id', articleId);
      UI.toast(pin ? 'Article épinglé' : 'Article désépinglé', 'success');
      this.openArticle(articleId);
    } catch(e) { UI.toast('Erreur', 'error'); }
  },

  // ═══════════════ WIKI COMMENTS ═══════════════
  loadWikiComments: async function(articleId) {
    var el = document.getElementById('wiki-comments-list-' + articleId);
    if (!el) return;
    try {
      var result = await App.supabase.from('wiki_comments')
        .select('*, profiles(username)')
        .eq('article_id', articleId)
        .order('created_at', { ascending: true });

      if (!result.data || result.data.length === 0) {
        el.innerHTML = '<p style="color:var(--text3);font-size:.78rem;padding:8px">Aucun commentaire</p>';
        return;
      }

      // Build tree
      var roots = [];
      var childMap = {};
      for (var i = 0; i < result.data.length; i++) {
        var c = result.data[i];
        if (!c.reply_to) {
          roots.push(c);
        } else {
          if (!childMap[c.reply_to]) childMap[c.reply_to] = [];
          childMap[c.reply_to].push(c);
        }
      }

      var html = this._renderCommentTree(roots, childMap, articleId, 0);
      el.innerHTML = html;

      // Bind reply buttons
      el.querySelectorAll('.wiki-reply-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var parentId = this.getAttribute('data-parent');
          var replyDiv = document.getElementById('reply-form-' + parentId);
          if (replyDiv) replyDiv.style.display = replyDiv.style.display === 'none' ? 'block' : 'none';
        });
      });

      el.querySelectorAll('.wiki-reply-submit').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var parentId = this.getAttribute('data-parent');
          var aid = this.getAttribute('data-article');
          UI.addWikiComment(aid, parentId);
        });
      });

    } catch(e) {
      el.innerHTML = '<p style="color:var(--text3)">Erreur</p>';
    }
  },

  _renderCommentTree: function(comments, childMap, articleId, depth) {
    if (depth > 4) return '';
    var html = '';
    for (var i = 0; i < comments.length; i++) {
      var c = comments[i];
      var name = (c.profiles && c.profiles.username) || 'Anonyme';
      var indent = depth * 24;
      html += '<div class="cmt" style="margin-left:' + indent + 'px">' +
        '<div class="cmt__av">' + name.charAt(0).toUpperCase() + '</div>' +
        '<div class="cmt__body">' +
          '<div class="cmt__head">' +
            '<span class="cmt__author" style="cursor:pointer" onclick="UI.openPublicProfile(\'' + c.user_id + '\')">' + App.esc(name) + '</span>' +
            '<span class="cmt__date">' + App.ago(c.created_at) + '</span>' +
          '</div>' +
          '<div class="cmt__text">' + App.esc(c.content) + '</div>';

      if (App.currentUser && depth < 4) {
        html += '<button class="wiki-reply-btn" data-parent="' + c.id + '" style="font-size:.65rem;color:var(--text3);background:none;border:none;cursor:pointer;margin-top:2px"><i class="fas fa-reply"></i> Répondre</button>' +
          '<div id="reply-form-' + c.id + '" style="display:none;margin-top:4px">' +
            '<div class="cmtform"><textarea id="reply-input-' + c.id + '" placeholder="Répondre..." rows="1" style="font-size:.75rem"></textarea>' +
            '<button class="btn btn--primary wiki-reply-submit" data-parent="' + c.id + '" data-article="' + articleId + '" style="padding:4px 8px"><i class="fas fa-paper-plane"></i></button></div></div>';
      }

      html += '</div></div>';

      // Render children
      if (childMap[c.id]) {
        html += this._renderCommentTree(childMap[c.id], childMap, articleId, depth + 1);
      }
    }
    return html;
  },

  addWikiComment: async function(articleId, replyTo) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    var inputId = replyTo ? 'reply-input-' + replyTo : 'wiki-comment-input-' + articleId;
    var input = document.getElementById(inputId);
    if (!input) return;
    var content = input.value.trim();
    if (!content || content.length < 2) { UI.toast('Trop court', 'warning'); return; }

    try {
      var modResp = await fetch('/api/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '', description: content }) });
      var modData = await modResp.json();
      if (modData.flagged && modData.reformulated && modData.cleaned) {
        content = modData.cleaned.description;
      }

      var insertData = { article_id: articleId, user_id: App.currentUser.id, content: content };
      if (replyTo) insertData.reply_to = replyTo;

      var result = await App.supabase.from('wiki_comments').insert(insertData);
      if (result.error) throw result.error;
      input.value = '';
      UI.toast('Commentaire ajouté', 'success');
      this.loadWikiComments(articleId);
    } catch(e) { UI.toast('Erreur', 'error'); }
  },

  // ═══════════════ WIKI WRITE ═══════════════
  wikiWrite: function() {
    var newBtn = document.getElementById('btn-new-article');
    if (newBtn) newBtn.addEventListener('click', function() {
      if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
      UI.openModal('modal-wiki-write');
    });

    var form = document.getElementById('wiki-write-form');
    if (form) form.addEventListener('submit', function(e) {
      e.preventDefault();
      UI.publishArticle();
    });

    // Character count
    var contentArea = document.getElementById('wa-content');
    if (contentArea) {
      contentArea.addEventListener('input', function() {
        var counter = document.getElementById('wa-char-count');
        if (counter) counter.textContent = this.value.length;

        // Live preview
        var preview = document.getElementById('wa-preview');
        if (preview && this.value.trim()) {
          preview.style.display = 'block';
          preview.innerHTML = marked.parse(this.value);
        } else if (preview) {
          preview.style.display = 'none';
        }
      });
    }

    // Markdown toolbar
    this._addMarkdownToolbar();

    // Poll toggle
    var pollToggle = document.getElementById('wiki-poll-toggle');
    if (pollToggle) pollToggle.addEventListener('click', function() { Polls.toggleForm(); });
  },

  _addMarkdownToolbar: function() {
    var content = document.getElementById('wa-content');
    if (!content) return;

    var toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex;gap:2px;margin-bottom:4px;flex-wrap:wrap';

    var tools = [
      { icon: 'fa-bold', pre: '**', post: '**', label: 'Gras' },
      { icon: 'fa-italic', pre: '*', post: '*', label: 'Italique' },
      { icon: 'fa-strikethrough', pre: '~~', post: '~~', label: 'Barré' },
      { icon: 'fa-heading', pre: '## ', post: '', label: 'Titre' },
      { icon: 'fa-list-ul', pre: '- ', post: '', label: 'Liste' },
      { icon: 'fa-list-ol', pre: '1. ', post: '', label: 'Liste num.' },
      { icon: 'fa-quote-left', pre: '> ', post: '', label: 'Citation' },
      { icon: 'fa-code', pre: '`', post: '`', label: 'Code' },
      { icon: 'fa-link', pre: '[', post: '](url)', label: 'Lien' },
      { icon: 'fa-image', pre: '![alt](', post: ')', label: 'Image' },
      { icon: 'fa-table', pre: '| Col1 | Col2 |\n|------|------|\n| ', post: ' | val |', label: 'Tableau' }
    ];

    for (var i = 0; i < tools.length; i++) {
      (function(tool) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn--ghost';
        btn.style.cssText = 'padding:3px 6px;font-size:.7rem';
        btn.innerHTML = '<i class="fas ' + tool.icon + '"></i>';
        btn.title = tool.label;
        btn.addEventListener('click', function() {
          var start = content.selectionStart;
          var end = content.selectionEnd;
          var selected = content.value.substring(start, end);
          var replacement = tool.pre + (selected || tool.label) + tool.post;
          content.value = content.value.substring(0, start) + replacement + content.value.substring(end);
          content.focus();
          content.dispatchEvent(new Event('input'));
        });
        toolbar.appendChild(btn);
      })(tools[i]);
    }

    // Preview toggle
    var previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'btn btn--ghost';
    previewBtn.style.cssText = 'padding:3px 6px;font-size:.7rem;margin-left:auto';
    previewBtn.innerHTML = '<i class="fas fa-eye"></i>';
    previewBtn.title = 'Aperçu';
    previewBtn.addEventListener('click', function() {
      var preview = document.getElementById('wa-preview');
      if (preview) {
        if (preview.style.display === 'none') {
          preview.style.display = 'block';
          preview.innerHTML = marked.parse(content.value || '');
        } else {
          preview.style.display = 'none';
        }
      }
    });
    toolbar.appendChild(previewBtn);

    // Poll button
    var pollBtn = document.createElement('button');
    pollBtn.type = 'button';
    pollBtn.className = 'btn btn--ghost';
    pollBtn.id = 'wiki-poll-toggle';
    pollBtn.style.cssText = 'padding:3px 6px;font-size:.7rem';
    pollBtn.innerHTML = '<i class="fas fa-poll"></i>';
    pollBtn.title = 'Sondage';
    pollBtn.addEventListener('click', function() { Polls.toggleForm(); });
    toolbar.appendChild(pollBtn);

    content.parentNode.insertBefore(toolbar, content);

    // Insert poll form placeholder
    var pollHtml = Polls.getFormHtml();
    var pollDiv = document.createElement('div');
    pollDiv.innerHTML = pollHtml;
    content.parentNode.insertBefore(pollDiv.firstChild, content.nextSibling);
    Polls.initForm();
  },

  publishArticle: async function() {
    if (!App.currentUser || !App.currentProfile) return;
    var title = document.getElementById('wa-title').value.trim();
    var category = document.getElementById('wa-category').value;
    var content = document.getElementById('wa-content').value.trim();

    if (!title || title.length < 3) { UI.toast('Titre trop court', 'warning'); return; }
    if (!content || content.length < 10) { UI.toast('Contenu trop court', 'warning'); return; }

    var btn = document.getElementById('btn-wiki-publish');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Publication...';

    try {
      // Moderate
      var modResp = await fetch('/api/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title, description: content, context: 'wiki' })
      });
      var modData = await modResp.json();
      if (modData.flagged && modData.reformulated && modData.cleaned) {
        title = modData.cleaned.title;
        content = modData.cleaned.description;
        UI.toast('Contenu reformulé', 'info');
      }

      var slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

      var pollData = Polls.getData();

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

      // Update reputation
      if (App.currentProfile) {
        await App.supabase.from('profiles').update({
          reputation: (App.currentProfile.reputation || 0) + 15
        }).eq('id', App.currentUser.id);
        App.currentProfile.reputation = (App.currentProfile.reputation || 0) + 15;
      }

      UI.closeModal('modal-wiki-write');
      UI.toast('Article publié ! +15 pts', 'success');
      document.getElementById('wiki-write-form').reset();
      var counter = document.getElementById('wa-char-count');
      if (counter) counter.textContent = '0';
      var preview = document.getElementById('wa-preview');
      if (preview) preview.style.display = 'none';

      this.loadCommunityArticles();
    } catch(e) {
      UI.toast('Erreur: ' + (e.message || 'Échec'), 'error');
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publier';
  },

  // ═══════════════ PUBLIC PROFILE ═══════════════
  openPublicProfile: async function(userId) {
    if (!userId) return;

    // If it's the current user, open private profile
    if (App.currentUser && userId === App.currentUser.id) {
      Auth.showProfile();
      return;
    }

    try {
      var profileResult = await App.supabase.from('profiles').select('*').eq('id', userId).single();
      if (!profileResult.data) { UI.toast('Profil introuvable', 'error'); return; }
      var p = profileResult.data;

      var initial = (p.username || '?').charAt(0).toUpperCase();
      var level = Auth._getLevel(p.reputation || 0);

      // Get user's reports
      var userReports = App.reports.filter(function(r) { return r.user_id === userId; });
      var resolved = userReports.filter(function(r) { return r.status === 'resolved'; }).length;

      var html = '<div class="pub-profile">' +
        '<div class="pub-profile__avatar">' + initial + '</div>' +
        '<div class="pub-profile__name">' + App.esc(p.username || 'Anonyme') + '</div>' +
        '<div class="pub-profile__meta">' +
          (p.commune ? '<i class="fas fa-map-pin"></i> ' + App.esc(p.commune) + ' · ' : '') +
          '<i class="fas fa-calendar"></i> Membre depuis ' + new Date(p.created_at).toLocaleDateString('fr-FR') +
          ' · Nv.' + level.num + ' ' + level.name +
        '</div>' +
        '<div class="pub-profile__stats">' +
          '<div class="profile__stat"><div class="profile__stat-value">' + (p.reports_count || 0) + '</div><div class="profile__stat-label">Signalements</div></div>' +
          '<div class="profile__stat profile__stat--green"><div class="profile__stat-value">' + resolved + '</div><div class="profile__stat-label">Résolus</div></div>' +
          '<div class="profile__stat profile__stat--yellow"><div class="profile__stat-value">' + (p.reputation || 0) + '</div><div class="profile__stat-label">Réputation</div></div>' +
        '</div>';

      // Badges
      html += '<div style="text-align:left;margin-top:16px" id="pub-badges-container"></div>';

      // User's reports
      if (userReports.length > 0) {
        html += '<div style="text-align:left;margin-top:16px">' +
          '<h3 style="font-size:.85rem;font-weight:700;margin-bottom:8px"><i class="fas fa-flag" style="color:var(--green)"></i> Signalements (' + userReports.length + ')</h3>';
        var max = Math.min(userReports.length, 10);
        for (var i = 0; i < max; i++) {
          var r = userReports[i];
          var cat = App.categories[r.category] || App.categories.other;
          var status = App.statuses[r.status] || App.statuses.pending;
          html += '<div class="adm" style="cursor:pointer;margin-bottom:4px" onclick="UI.closeModal(\'modal-profile\');Reports.openDetail(\'' + r.id + '\')">' +
            '<div class="adm__info"><div class="adm__title">' + App.esc(r.title) + '</div>' +
            '<div class="adm__meta"><span class="badge badge--cat">' + cat.label + '</span> <span class="badge badge--' + r.status + '">' + status.label + '</span> · ' + App.ago(r.created_at) + '</div></div>' +
            '<span class="card__votes"><i class="fas fa-arrow-up"></i> ' + (r.upvotes || 0) + '</span></div>';
        }
        if (userReports.length > 10) html += '<p style="color:var(--text3);font-size:.75rem;margin-top:4px">+ ' + (userReports.length - 10) + ' autres</p>';
        html += '</div>';
      }

      html += '</div>';

      var container = document.getElementById('profile-content');
      if (container) container.innerHTML = html;
      this.openModal('modal-profile');

      // Render badges for public profile
      if (typeof Badges !== 'undefined') {
        // Build minimal stats from public data
        var pubStats = {
          catCounts: {},
          votesGiven: 0,
          votesReceived: 0,
          wikiArticles: 0,
          commentsCount: 0,
          uniqueCommunes: 0,
          maxCommuneCount: 0,
          hasIslands: false,
          maxDailyReports: 0,
          nightReport: false,
          maxStreak: 0,
          resolvedCount: resolved,
          photosCount: 0
        };
        var communeCounts = {};
        for (var i = 0; i < userReports.length; i++) {
          var r = userReports[i];
          pubStats.catCounts[r.category] = (pubStats.catCounts[r.category] || 0) + 1;
          if (r.commune) communeCounts[r.commune] = (communeCounts[r.commune] || 0) + 1;
          pubStats.votesReceived += (r.upvotes || 0);
          if (r.images && r.images.length) pubStats.photosCount += r.images.length;
        }
        pubStats.uniqueCommunes = Object.keys(communeCounts).length;
        for (var c in communeCounts) { if (communeCounts[c] > pubStats.maxCommuneCount) pubStats.maxCommuneCount = communeCounts[c]; }

        var badgesEl = document.getElementById('pub-badges-container');
        if (badgesEl) badgesEl.innerHTML = Badges.renderGrid(p, pubStats);
      }

    } catch(e) {
      console.error('Public profile error:', e);
      UI.toast('Erreur chargement profil', 'error');
    }
  },

  // ═══════════════ CONTACT EMAIL ═══════════════
  contactEmail: function() {
    var link = document.getElementById('contact-email-link');
    var display = document.getElementById('contact-email-display');
    if (App.config && App.config.contactEmail) {
      if (link) link.href = 'mailto:' + App.config.contactEmail;
      if (display) display.textContent = App.config.contactEmail;
    }
  },

  // ═══════════════ KEYBOARD SHORTCUTS ═══════════════
  keyboardShortcuts: function() {
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.open').forEach(function(m) { m.classList.remove('open'); });
      }
    });
  },

  // ═══════════════ NETWORK STATUS ═══════════════
  networkStatus: function() {
    window.addEventListener('offline', function() { UI.toast('Connexion perdue', 'warning'); });
    window.addEventListener('online', function() { UI.toast('Reconnecté', 'success'); Reports.loadAll(); });
  },

  // ═══════════════ TOAST ═══════════════
  toast: function(msg, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    if (!container) return;

    var icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };

    var toast = document.createElement('div');
    toast.className = 'toast toast--' + type;
    toast.innerHTML = '<span class="toast__ico"><i class="fas ' + (icons[type] || icons.info) + '"></i></span>' +
      '<span class="toast__msg">' + App.esc(msg) + '</span>' +
      '<button class="toast__x"><i class="fas fa-times"></i></button>';

    toast.querySelector('.toast__x').addEventListener('click', function() { toast.remove(); });

    container.appendChild(toast);

    setTimeout(function() {
      if (toast.parentNode) toast.remove();
    }, 4000);
  },

  // ═══════════════ LOADING ═══════════════
  showLoading: function() {
    var loader = document.getElementById('loading-overlay');
    if (loader) loader.classList.add('active');
  },

  hideLoading: function() {
    var loader = document.getElementById('loading-overlay');
    if (loader) loader.classList.remove('active');
  }
};
