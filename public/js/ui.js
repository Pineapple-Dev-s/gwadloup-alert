var UI = {
  catIcons: {
    road:'fa-road', warning:'fa-exclamation-triangle', sign:'fa-sign', marking:'fa-paint-roller',
    bump:'fa-wave-square', car:'fa-car', boat:'fa-ship', dump:'fa-trash', beach:'fa-umbrella-beach',
    river:'fa-water', bin:'fa-trash-alt', light:'fa-lightbulb', cable:'fa-bolt', leak:'fa-tint',
    flood:'fa-house-flood-water', sewer:'fa-faucet-drip', stagnant:'fa-droplet', plant:'fa-leaf',
    tree:'fa-tree', invasive:'fa-seedling', building:'fa-building', abandoned:'fa-building-circle-xmark',
    sidewalk:'fa-person-walking', railing:'fa-grip-lines', danger:'fa-shield-halved',
    crosswalk:'fa-crosshairs', school:'fa-school', noise:'fa-volume-high', animals:'fa-paw',
    mosquito:'fa-mosquito', other:'fa-map-pin'
  },
  wikiCatIcons: { general:'📌', guide:'📖', info:'ℹ️', discussion:'💬', proposition:'💡' },
  searchTimeout: null,
  _viewedArticles: {}, // Track which articles user already viewed this session

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
    ImageUpload.init();
    console.log('UI initialized — categories:', Object.keys(App.categories).length);
  },

  nav: function() {
    var self = this;
    var tabs = document.querySelectorAll('.hdr__tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function() {
        var view = this.getAttribute('data-view');
        for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
        this.classList.add('active');
        var views = document.querySelectorAll('.view');
        for (var j = 0; j < views.length; j++) views[j].classList.remove('active');
        var target = document.getElementById('view-' + view);
        if (target) target.classList.add('active');
        var nav = document.getElementById('main-nav');
        if (nav) nav.classList.remove('open');
        var burger = document.getElementById('burger-menu');
        if (burger) burger.classList.remove('open');
        if (view === 'map' && MapManager.map) setTimeout(function() { MapManager.map.invalidateSize(); }, 100);
        if (view === 'stats') Reports.updateStats();
        if (view === 'wiki') { self.loadWikiStatic(); self.loadCommunityArticles(); }
        if (view === 'community') self.loadTagProposals();
      });
    }
    var logo = document.getElementById('logo-link');
    if (logo) logo.addEventListener('click', function(e) {
      e.preventDefault();
      for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
      var mapTab = document.querySelector('[data-view="map"]');
      if (mapTab) mapTab.classList.add('active');
      var views = document.querySelectorAll('.view');
      for (var j = 0; j < views.length; j++) views[j].classList.remove('active');
      var mapView = document.getElementById('view-map');
      if (mapView) mapView.classList.add('active');
      if (MapManager.map) setTimeout(function() { MapManager.map.invalidateSize(); }, 100);
    });
  },

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

  modals: function() {
    var self = this;
    document.querySelectorAll('[data-close]').forEach(function(el) {
      el.addEventListener('click', function() {
        var modal = el.closest('.modal');
        if (modal) self.closeModal(modal.id);
      });
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var modals = document.querySelectorAll('.modal.open');
        for (var i = modals.length - 1; i >= 0; i--) { self.closeModal(modals[i].id); break; }
      }
    });
    var newBtn = document.getElementById('btn-new-report');
    if (newBtn) {
      newBtn.addEventListener('click', function() {
        if (!App.currentUser) { self.toast('Connectez-vous d\'abord', 'warning'); return; }
        self.resetReportForm();
        self.openModal('modal-report');
        setTimeout(function() { MapManager.initMiniMap(); }, 200);
      });
    }
  },

  openModal: function(id) {
    var modal = document.getElementById(id);
    if (modal) { modal.classList.add('open'); document.body.style.overflow = 'hidden'; }
  },
  closeModal: function(id) {
    var modal = document.getElementById(id);
    if (modal) modal.classList.remove('open');
    if (!document.querySelector('.modal.open')) document.body.style.overflow = '';
  },

  filters: function() {
    var ids = ['filter-category', 'filter-status', 'filter-commune'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) el.addEventListener('change', function() {
        App.filters.category = document.getElementById('filter-category').value;
        App.filters.status = document.getElementById('filter-status').value;
        App.filters.commune = document.getElementById('filter-commune').value;
        Reports.loadAll();
      });
    }
    var reset = document.getElementById('btn-reset-filters');
    if (reset) reset.addEventListener('click', function() {
      document.getElementById('filter-category').value = '';
      document.getElementById('filter-status').value = '';
      document.getElementById('filter-commune').value = '';
      App.filters = { category: '', status: '', commune: '' };
      Reports.loadAll();
    });
    var sort = document.getElementById('sort-reports');
    if (sort) sort.addEventListener('change', function() {
      var v = sort.value;
      if (v === 'newest') App.reports.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      else if (v === 'oldest') App.reports.sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at); });
      else if (v === 'most-voted') App.reports.sort(function(a, b) { return (b.upvotes || 0) - (a.upvotes || 0); });
      Reports.renderList();
    });
  },

  form: function() {
    var self = this;
    var step1Next = document.getElementById('btn-step1-next');
    var step2Next = document.getElementById('btn-step2-next');
    if (step1Next) step1Next.addEventListener('click', function() { self.goStep(2); });
    if (step2Next) step2Next.addEventListener('click', function() { self.goStep(3); });
    document.querySelectorAll('[data-prev]').forEach(function(btn) {
      btn.addEventListener('click', function() { self.goStep(parseInt(btn.getAttribute('data-prev'))); });
    });
    var desc = document.getElementById('report-description');
    if (desc) desc.addEventListener('input', function() {
      var ct = document.getElementById('desc-count');
      if (ct) ct.textContent = desc.value.length;
    });
    var form = document.getElementById('report-form');
    if (form) form.addEventListener('submit', function(e) { e.preventDefault(); Reports.submitReport(); });
    var geoBtn = document.getElementById('btn-geolocate');
    if (geoBtn) geoBtn.addEventListener('click', function() { self.geolocate(); });
    var addrInput = document.getElementById('address-search');
    if (addrInput) {
      addrInput.addEventListener('input', function() {
        clearTimeout(self.searchTimeout);
        var q = addrInput.value.trim();
        if (q.length < 3) { document.getElementById('search-results').classList.remove('open'); return; }
        self.searchTimeout = setTimeout(function() { self.searchAddress(q); }, 400);
      });
      addrInput.addEventListener('focus', function() {
        var sr = document.getElementById('search-results');
        if (sr && sr.children.length > 0) sr.classList.add('open');
      });
      document.addEventListener('click', function(e) {
        if (!e.target.closest('.loc-search')) {
          var sr = document.getElementById('search-results');
          if (sr) sr.classList.remove('open');
        }
      });
    }
  },

  goStep: function(n) {
    var steps = document.querySelectorAll('.fstep');
    var indicators = document.querySelectorAll('.steps__i');
    for (var i = 0; i < steps.length; i++) steps[i].classList.remove('active');
    for (var i = 0; i < indicators.length; i++) {
      var s = parseInt(indicators[i].getAttribute('data-step'));
      indicators[i].classList.remove('active', 'done');
      if (s < n) indicators[i].classList.add('done');
      else if (s === n) indicators[i].classList.add('active');
    }
    var target = document.getElementById('step-' + n);
    if (target) target.classList.add('active');
  },

  geolocate: function() {
    if (!navigator.geolocation) { this.toast('Géolocalisation non supportée', 'error'); return; }
    this.toast('Localisation en cours...', 'info');
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        var lat = pos.coords.latitude, lng = pos.coords.longitude;
        if (!MapManager.isInGuadeloupe(lat, lng)) { UI.toast('Vous n\'êtes pas en Guadeloupe', 'warning'); return; }
        MapManager.setPin(lat, lng);
        MapManager.reverseGeo(lat, lng);
        UI.toast('Position trouvée', 'success');
      },
      function() { UI.toast('Erreur de géolocalisation', 'error'); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  },

  searchAddress: async function(query) {
    var results = await MapManager.searchAddr(query);
    var container = document.getElementById('search-results');
    if (!results || results.length === 0) {
      container.innerHTML = '<div class="loc-r" style="color:var(--text3)">Aucun résultat</div>';
      container.classList.add('open');
      return;
    }
    var html = '';
    for (var i = 0; i < results.length; i++) {
      html += '<div class="loc-r" data-lat="' + results[i].lat + '" data-lon="' + results[i].lon + '" data-name="' + App.esc(results[i].display_name) + '">' + App.esc(results[i].display_name) + '</div>';
    }
    container.innerHTML = html;
    container.classList.add('open');
    container.querySelectorAll('.loc-r').forEach(function(el) {
      el.addEventListener('click', function() {
        var lat = parseFloat(el.getAttribute('data-lat'));
        var lon = parseFloat(el.getAttribute('data-lon'));
        MapManager.setPin(lat, lon);
        document.getElementById('report-address').value = el.getAttribute('data-name');
        document.getElementById('selected-address').textContent = el.getAttribute('data-name');
        document.getElementById('location-info').style.display = 'flex';
        document.getElementById('address-search').value = el.getAttribute('data-name');
        container.classList.remove('open');
        MapManager.reverseGeo(lat, lon);
      });
    });
  },

  resetReportForm: function() {
    var form = document.getElementById('report-form');
    if (form) form.reset();
    this.goStep(1);
    document.getElementById('report-lat').value = '';
    document.getElementById('report-lng').value = '';
    document.getElementById('report-address').value = '';
    document.getElementById('report-commune').value = '';
    document.getElementById('location-info').style.display = 'none';
    document.getElementById('btn-step1-next').disabled = true;
    document.getElementById('btn-step2-next').disabled = true;
    var dc = document.getElementById('desc-count');
    if (dc) dc.textContent = '0';
    ImageUpload.reset();
  },

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
    grid.querySelectorAll('input[name="category"]').forEach(function(inp) {
      inp.addEventListener('change', function() {
        document.getElementById('btn-step1-next').disabled = false;
      });
    });
  },

  // === WIKI TABS ===
  wikiTabs: function() {
    var self = this;
    document.querySelectorAll('.wiki-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        var target = tab.getAttribute('data-wtab');
        document.querySelectorAll('.wiki-tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        document.querySelectorAll('.wiki-panel').forEach(function(p) { p.classList.remove('active'); });
        var panel = document.getElementById('wpanel-' + target);
        if (panel) panel.classList.add('active');
        if (target === 'community') self.loadCommunityArticles();
      });
    });
  },

  loadWikiStatic: async function() {
    try {
      var r = await fetch('/api/wiki-static');
      var pages = await r.json();
      var nav = document.getElementById('wiki-nav');
      if (!nav) return;
      if (pages.length === 0) { nav.innerHTML = '<p style="color:var(--text3);font-size:.75rem">Pas de docs</p>'; return; }
      var html = '';
      for (var i = 0; i < pages.length; i++) {
        html += '<button class="wnav' + (i === 0 ? ' active' : '') + '" data-slug="' + pages[i].slug + '">' + App.esc(pages[i].title) + '</button>';
      }
      nav.innerHTML = html;
      nav.querySelectorAll('.wnav').forEach(function(btn) {
        btn.addEventListener('click', function() {
          nav.querySelectorAll('.wnav').forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
          UI.loadWikiPage(btn.getAttribute('data-slug'));
        });
      });
      if (pages.length > 0) this.loadWikiPage(pages[0].slug);
    } catch (e) { console.error('Wiki load error:', e); }
  },

  loadWikiPage: async function(slug) {
    var content = document.getElementById('wiki-content');
    if (!content) return;
    content.innerHTML = '<p class="wiki__load">Chargement...</p>';
    try {
      var r = await fetch('/api/wiki-static/' + slug);
      if (!r.ok) throw new Error();
      var md = await r.text();
      content.innerHTML = marked.parse(md);
    } catch (e) { content.innerHTML = '<p style="color:var(--text3)">Page non trouvée</p>'; }
  },

  // === COMMUNITY ARTICLES ===
  loadCommunityArticles: async function() {
    var container = document.getElementById('community-articles-list');
    if (!container) return;
    container.innerHTML = '<p class="wiki__load">Chargement...</p>';
    try {
      var catFilter = document.getElementById('wiki-cat-filter');
      var sortFilter = document.getElementById('wiki-sort');
      var query = App.supabase.from('wiki_articles').select('*');
      if (catFilter && catFilter.value) query = query.eq('category', catFilter.value);
      if (sortFilter && sortFilter.value === 'popular') {
        query = query.order('upvotes', { ascending: false });
      } else {
        query = query.order('pinned', { ascending: false }).order('created_at', { ascending: false });
      }
      var result = await query;
      if (result.error) throw result.error;
      var data = result.data;
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty" style="padding:40px"><i class="fas fa-pen-fancy fa-2x" style="color:var(--text3);margin-bottom:8px"></i><h3 style="font-size:.9rem">Pas encore d\'articles</h3><p style="font-size:.78rem;color:var(--text2)">Soyez le premier à écrire !</p></div>';
        return;
      }
      var html = '';
      for (var i = 0; i < data.length; i++) {
        var a = data[i];
        var catIcon = this.wikiCatIcons[a.category] || '📌';
        var preview = (a.content || '').replace(/[#*`\[\]>|_~\-]/g, '').substring(0, 150);
        var pinnedBadge = a.pinned ? '<span style="background:var(--yellow);color:#000;padding:1px 6px;border-radius:10px;font-size:.6rem;font-weight:700;margin-left:6px"><i class="fas fa-thumbtack"></i> Épinglé</span>' : '';
        html += '<div class="wcard" onclick="UI.openArticle(\'' + a.id + '\')">' +
          '<div class="wcard__head"><span class="wcard__cat">' + catIcon + ' ' + (a.category || 'general') + pinnedBadge + '</span><span class="wcard__date">' + App.ago(a.created_at) + '</span></div>' +
          '<div class="wcard__title">' + App.esc(a.title) + '</div>' +
          '<div class="wcard__preview">' + App.esc(preview) + '</div>' +
          '<div class="wcard__foot"><span class="wcard__author"><i class="fas fa-user"></i> ' + App.esc(a.author_name || 'Anonyme') + '</span>' +
          '<span class="wcard__votes"><i class="fas fa-arrow-up"></i> ' + (a.upvotes || 0) + ' · <i class="fas fa-eye"></i> ' + (a.views || 0) + '</span></div></div>';
      }
      container.innerHTML = html;

      if (catFilter && !catFilter._bound) {
        catFilter.addEventListener('change', function() { UI.loadCommunityArticles(); });
        catFilter._bound = true;
      }
      if (sortFilter && !sortFilter._bound) {
        sortFilter.addEventListener('change', function() { UI.loadCommunityArticles(); });
        sortFilter._bound = true;
      }
    } catch (e) {
      console.error('Community articles error:', e);
      container.innerHTML = '<p style="color:var(--red)">Erreur de chargement</p>';
    }
  },

  // === OPEN ARTICLE — FIXED VIEWS (only once per session per article) ===
  openArticle: async function(id) {
    var container = document.getElementById('wiki-article-detail');
    if (!container) return;
    container.innerHTML = '<p class="wiki__load">Chargement...</p>';
    this.openModal('modal-wiki-article');

    try {
      // Increment views ONLY once per session per article
      if (!this._viewedArticles[id]) {
        this._viewedArticles[id] = true;
        var viewResult = await App.supabase.from('wiki_articles').select('views').eq('id', id).single();
        if (viewResult.data) {
          await App.supabase.from('wiki_articles').update({ views: (viewResult.data.views || 0) + 1 }).eq('id', id);
        }
      }

      var result = await App.supabase.from('wiki_articles').select('*').eq('id', id).single();
      if (result.error) throw result.error;
      var article = result.data;

      var isAdmin = App.currentProfile && App.currentProfile.role === 'admin';
      var isAuthor = App.currentUser && article.author_id === App.currentUser.id;
      var hasVoted = false;
      if (App.currentUser) {
        var voteResult = await App.supabase.from('wiki_votes').select('id').eq('article_id', id).eq('user_id', App.currentUser.id).maybeSingle();
        if (voteResult.data) hasVoted = true;
      }

      var catIcon = this.wikiCatIcons[article.category] || '📌';
      var pinnedBadge = article.pinned ? ' <span style="background:var(--yellow);color:#000;padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:700"><i class="fas fa-thumbtack"></i> Épinglé</span>' : '';

      var html = '<div style="padding:20px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">' +
        '<span class="wcard__cat" style="font-size:.75rem">' + catIcon + ' ' + (article.category || 'general') + pinnedBadge + '</span>' +
        '<span style="font-size:.7rem;color:var(--text3)">' + App.ago(article.created_at) + '</span></div>' +
        '<h1 style="font-size:1.3rem;font-weight:700;margin-bottom:12px">' + App.esc(article.title) + '</h1>' +
        '<div style="display:flex;gap:12px;font-size:.78rem;color:var(--text2);margin-bottom:16px;flex-wrap:wrap">' +
        '<span><i class="fas fa-user" style="color:var(--green)"></i> ' + App.esc(article.author_name || 'Anonyme') + '</span>' +
        '<span><i class="fas fa-eye"></i> ' + (article.views || 0) + ' vues</span>' +
        '<span><i class="fas fa-arrow-up" style="color:var(--orange)"></i> ' + (article.upvotes || 0) + ' votes</span></div>' +
        '<div class="wiki__body" style="margin-bottom:16px">' + marked.parse(article.content || '') + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--border);margin-bottom:16px">' +
        '<button class="vote-btn' + (hasVoted ? ' voted' : '') + '" onclick="UI.toggleArticleVote(\'' + id + '\')"><i class="fas fa-arrow-up"></i> <span id="article-vote-count">' + (article.upvotes || 0) + '</span> Voter</button>';

      if (isAdmin) {
        html += '<button class="btn btn--outline" onclick="UI.togglePinArticle(\'' + id + '\',' + !article.pinned + ')"><i class="fas fa-thumbtack"></i> ' + (article.pinned ? 'Désépingler' : 'Épingler') + '</button>';
      }
      if (isAdmin || isAuthor) {
        html += '<button class="btn btn--danger" onclick="Auth.deleteWikiArticle(\'' + id + '\')"><i class="fas fa-trash"></i> Supprimer</button>';
      }
      html += '</div>';

      // Comments
      html += '<div class="comments" style="margin-top:0">' +
        '<div class="comments__title" style="font-size:.9rem;margin-bottom:12px"><i class="fas fa-comments"></i> Discussion</div>';
      if (App.currentUser) {
        html += '<div class="cmtform" id="wiki-comment-form-main">' +
          '<textarea id="wiki-comment-input-' + id + '" placeholder="Votre commentaire..." rows="2" style="flex:1"></textarea>' +
          '<button class="btn btn--primary" onclick="UI.addWikiComment(\'' + id + '\',null)"><i class="fas fa-paper-plane"></i></button></div>';
      } else {
        html += '<p style="font-size:.78rem;color:var(--text3);margin-bottom:12px">Connectez-vous pour commenter</p>';
      }
      html += '<div id="wiki-comments-' + id + '"><p class="wiki__load" style="font-size:.78rem">Chargement...</p></div>';
      html += '</div></div>';

      container.innerHTML = html;
      this.loadWikiComments(id);
    } catch (e) {
      console.error('Open article error:', e);
      container.innerHTML = '<p style="color:var(--red);padding:20px">Erreur de chargement</p>';
    }
  },

  togglePinArticle: async function(id, pin) {
    if (!App.currentProfile || App.currentProfile.role !== 'admin') { this.toast('Accès refusé', 'error'); return; }
    try {
      var result = await App.supabase.from('wiki_articles').update({ pinned: pin, updated_at: new Date().toISOString() }).eq('id', id);
      if (result.error) throw result.error;
      this.toast(pin ? 'Article épinglé !' : 'Article désépinglé', 'success');
      this.openArticle(id);
      this.loadCommunityArticles();
    } catch (e) { this.toast('Erreur', 'error'); }
  },

  toggleArticleVote: async function(id) {
    if (!App.currentUser) { this.toast('Connectez-vous', 'warning'); return; }
    try {
      var existResult = await App.supabase.from('wiki_votes').select('id').eq('article_id', id).eq('user_id', App.currentUser.id).maybeSingle();
      var artResult = await App.supabase.from('wiki_articles').select('upvotes').eq('id', id).single();
      var currentVotes = (artResult.data && artResult.data.upvotes) || 0;
      if (existResult.data) {
        await App.supabase.from('wiki_votes').delete().eq('id', existResult.data.id);
        await App.supabase.from('wiki_articles').update({ upvotes: Math.max(0, currentVotes - 1) }).eq('id', id);
        this.toast('Vote retiré', 'info');
      } else {
        await App.supabase.from('wiki_votes').insert({ article_id: id, user_id: App.currentUser.id });
        await App.supabase.from('wiki_articles').update({ upvotes: currentVotes + 1 }).eq('id', id);
        this.toast('Merci pour votre vote !', 'success');
      }
      this.openArticle(id);
    } catch (e) { this.toast('Erreur', 'error'); }
  },

  // === THREADED COMMENTS ===
  loadWikiComments: async function(articleId) {
    var container = document.getElementById('wiki-comments-' + articleId);
    if (!container) return;
    try {
      var result = await App.supabase.from('wiki_comments').select('*, profiles(username)').eq('article_id', articleId).order('created_at', { ascending: true });
      if (result.error) throw result.error;
      var comments = result.data;
      if (!comments || comments.length === 0) {
        container.innerHTML = '<p style="color:var(--text3);font-size:.78rem;padding:8px">Aucun commentaire — soyez le premier !</p>';
        return;
      }
      var rootComments = [];
      var childMap = {};
      for (var i = 0; i < comments.length; i++) {
        if (!comments[i].reply_to) rootComments.push(comments[i]);
        else { if (!childMap[comments[i].reply_to]) childMap[comments[i].reply_to] = []; childMap[comments[i].reply_to].push(comments[i]); }
      }
      container.innerHTML = this._renderCommentsTree(rootComments, childMap, articleId, 0);
    } catch (e) { container.innerHTML = '<p style="color:var(--red);font-size:.78rem">Erreur</p>'; }
  },

  _renderCommentsTree: function(comments, childMap, articleId, depth) {
    var html = '';
    var maxDepth = 4;
    var indent = Math.min(depth, maxDepth) * 20;
    var isAdmin = App.currentProfile && App.currentProfile.role === 'admin';
    for (var i = 0; i < comments.length; i++) {
      var c = comments[i];
      var name = (c.profiles && c.profiles.username) || 'Anonyme';
      var initial = name.charAt(0).toUpperCase();
      var isOwner = App.currentUser && c.user_id === App.currentUser.id;
      var borderStyle = depth > 0 ? 'border-left:2px solid var(--green);padding-left:8px;background:rgba(63,185,80,.02);' : '';
      html += '<div class="cmt" style="margin-left:' + indent + 'px;' + borderStyle + 'margin-bottom:6px">' +
        '<div class="cmt__av">' + initial + '</div><div class="cmt__body" style="flex:1">' +
        '<div class="cmt__head"><span class="cmt__author">' + App.esc(name) + '</span><span class="cmt__date">' + App.ago(c.created_at) + '</span></div>' +
        '<div class="cmt__text">' + App.esc(c.content) + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:4px">';
      if (App.currentUser && depth < maxDepth) {
        html += '<button class="btn btn--ghost" style="font-size:.65rem;padding:2px 6px" onclick="UI.showReplyForm(\'' + articleId + '\',\'' + c.id + '\')"><i class="fas fa-reply"></i> Répondre</button>';
      }
      if (isOwner || isAdmin) {
        html += '<button class="btn btn--ghost" style="font-size:.65rem;padding:2px 6px;color:var(--red)" onclick="UI.deleteWikiComment(\'' + articleId + '\',\'' + c.id + '\')"><i class="fas fa-trash"></i></button>';
      }
      html += '</div><div id="reply-form-' + c.id + '"></div></div></div>';
      if (childMap[c.id] && childMap[c.id].length > 0) {
        html += this._renderCommentsTree(childMap[c.id], childMap, articleId, depth + 1);
      }
    }
    return html;
  },

  showReplyForm: function(articleId, parentId) {
    var container = document.getElementById('reply-form-' + parentId);
    if (!container) return;
    if (container.innerHTML.trim()) { container.innerHTML = ''; return; }
    container.innerHTML = '<div class="cmtform" style="margin-top:6px">' +
      '<textarea id="reply-input-' + parentId + '" placeholder="Votre réponse..." rows="2" style="flex:1;font-size:.78rem"></textarea>' +
      '<button class="btn btn--primary" style="font-size:.72rem" onclick="UI.addWikiComment(\'' + articleId + '\',\'' + parentId + '\')"><i class="fas fa-paper-plane"></i></button>' +
      '<button class="btn btn--ghost" style="font-size:.72rem" onclick="document.getElementById(\'reply-form-' + parentId + '\').innerHTML=\'\'">Annuler</button></div>';
    var textarea = document.getElementById('reply-input-' + parentId);
    if (textarea) textarea.focus();
  },

  addWikiComment: async function(articleId, parentId) {
    if (!App.currentUser) { this.toast('Connectez-vous', 'warning'); return; }
    var inputId = parentId ? 'reply-input-' + parentId : 'wiki-comment-input-' + articleId;
    var input = document.getElementById(inputId);
    if (!input) return;
    var content = input.value.trim();
    if (!content || content.length < 2) { this.toast('Trop court', 'warning'); return; }
    if (content.length > 2000) { this.toast('Max 2000 caractères', 'warning'); return; }
    try {
      var modResp = await fetch('/api/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '', description: content, context: 'wiki' }) });
      var modData = await modResp.json();
      if (modData.flagged && modData.reformulated && modData.cleaned) { content = modData.cleaned.description; this.toast('Commentaire reformulé', 'info'); }
      var insertData = { article_id: articleId, user_id: App.currentUser.id, content: content };
      if (parentId) insertData.reply_to = parentId;
      var result = await App.supabase.from('wiki_comments').insert(insertData);
      if (result.error) throw result.error;
      input.value = '';
      if (parentId) { var rc = document.getElementById('reply-form-' + parentId); if (rc) rc.innerHTML = ''; }
      this.toast('Commentaire ajouté', 'success');
      this.loadWikiComments(articleId);
    } catch (e) { this.toast('Erreur', 'error'); }
  },

  deleteWikiComment: async function(articleId, commentId) {
    if (!confirm('Supprimer ce commentaire ?')) return;
    try {
      await App.supabase.from('wiki_comments').delete().eq('reply_to', commentId);
      var result = await App.supabase.from('wiki_comments').delete().eq('id', commentId);
      if (result.error) throw result.error;
      this.toast('Supprimé', 'success');
      this.loadWikiComments(articleId);
    } catch (e) { this.toast('Erreur', 'error'); }
  },

  // === WIKI WRITE WITH MARKDOWN TOOLBAR — FIXED PREVIEW ===
  wikiWrite: function() {
    var self = this;
    var newBtn = document.getElementById('btn-new-article');
    if (newBtn) {
      newBtn.addEventListener('click', function() {
        if (!App.currentUser) { self.toast('Connectez-vous', 'warning'); return; }
        document.getElementById('wiki-write-title').textContent = 'Écrire un article';
        document.getElementById('wa-title').value = '';
        document.getElementById('wa-category').value = 'general';
        document.getElementById('wa-content').value = '';
        document.getElementById('wa-char-count').textContent = '0';
        var preview = document.getElementById('wa-preview');
        if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
        // Remove old toolbar
        var oldTb = document.getElementById('md-toolbar');
        if (oldTb) oldTb.remove();
        self.openModal('modal-wiki-write');
        setTimeout(function() { self.initMarkdownToolbar(); }, 150);
      });
    }

    var waContent = document.getElementById('wa-content');
    if (waContent) {
      waContent.addEventListener('input', function() {
        var ct = document.getElementById('wa-char-count');
        if (ct) ct.textContent = waContent.value.length;
        self.updateMarkdownPreview();
      });
    }

    var form = document.getElementById('wiki-write-form');
    if (form) form.addEventListener('submit', function(e) { e.preventDefault(); self.publishArticle(); });
  },

  initMarkdownToolbar: function() {
    var contentArea = document.getElementById('wa-content');
    if (!contentArea) return;
    var existingToolbar = document.getElementById('md-toolbar');
    if (existingToolbar) existingToolbar.remove();

    var toolbar = document.createElement('div');
    toolbar.id = 'md-toolbar';
    toolbar.style.cssText = 'display:flex;gap:2px;flex-wrap:wrap;padding:6px 8px;background:var(--bg3);border:1px solid var(--border);border-bottom:none;border-radius:var(--r) var(--r) 0 0;margin-top:4px';

    var buttons = [
      { icon: 'fa-bold', title: 'Gras (Ctrl+B)', action: 'bold' },
      { icon: 'fa-italic', title: 'Italique (Ctrl+I)', action: 'italic' },
      { icon: 'fa-strikethrough', title: 'Barré', action: 'strike' },
      { sep: true },
      { icon: 'fa-heading', title: 'Titre 1', action: 'h1', label: 'H1' },
      { icon: 'fa-heading', title: 'Titre 2', action: 'h2', label: 'H2', small: true },
      { icon: 'fa-heading', title: 'Titre 3', action: 'h3', label: 'H3', smaller: true },
      { sep: true },
      { icon: 'fa-list-ul', title: 'Liste', action: 'ul' },
      { icon: 'fa-list-ol', title: 'Liste numérotée', action: 'ol' },
      { icon: 'fa-check-square', title: 'Checklist', action: 'checklist' },
      { sep: true },
      { icon: 'fa-quote-left', title: 'Citation', action: 'quote' },
      { icon: 'fa-code', title: 'Code inline', action: 'code' },
      { icon: 'fa-file-code', title: 'Bloc de code', action: 'codeblock' },
      { sep: true },
      { icon: 'fa-link', title: 'Lien', action: 'link' },
      { icon: 'fa-image', title: 'Image', action: 'image' },
      { icon: 'fa-table', title: 'Tableau', action: 'table' },
      { icon: 'fa-minus', title: 'Séparateur', action: 'hr' },
      { sep: true },
      { icon: 'fa-eye', title: 'Aperçu', action: 'preview', special: true }
    ];

    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (b.sep) { var sep = document.createElement('div'); sep.style.cssText = 'width:1px;height:20px;background:var(--border);margin:0 2px;align-self:center'; toolbar.appendChild(sep); continue; }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.title = b.title;
      btn.setAttribute('data-md-action', b.action);
      btn.style.cssText = 'width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:' + (b.special ? 'var(--green2)' : 'var(--bg)') + ';border:1px solid var(--border);border-radius:3px;cursor:pointer;color:' + (b.special ? '#fff' : 'var(--text2)') + ';font-size:.7rem;transition:all .1s';
      var fontSize = b.smaller ? ' style="font-size:.5rem"' : (b.small ? ' style="font-size:.6rem"' : '');
      btn.innerHTML = '<i class="fas ' + b.icon + '"' + fontSize + '></i>';
      (function(action) { btn.addEventListener('click', function() { UI.applyMarkdown(action); }); })(b.action);
      btn.addEventListener('mouseenter', function() { this.style.borderColor = 'var(--green)'; this.style.color = 'var(--text)'; });
      btn.addEventListener('mouseleave', function() { if (this.getAttribute('data-md-action') !== 'preview') { this.style.borderColor = 'var(--border)'; this.style.color = 'var(--text2)'; } });
      toolbar.appendChild(btn);
    }

    // Insert toolbar BEFORE the textarea
    var fieldDiv = contentArea.closest('.field');
    if (fieldDiv) {
      fieldDiv.insertBefore(toolbar, contentArea);
    } else {
      contentArea.parentNode.insertBefore(toolbar, contentArea);
    }
    contentArea.style.borderRadius = '0 0 var(--r) var(--r)';
    contentArea.style.borderTop = 'none';
  },

  applyMarkdown: function(action) {
    var textarea = document.getElementById('wa-content');
    if (!textarea) return;
    if (action === 'preview') { this.toggleMarkdownPreview(); return; }

    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var text = textarea.value;
    var selected = text.substring(start, end);
    var before = text.substring(0, start);
    var after = text.substring(end);
    var insert = '';
    var cursorOffset = 0;

    switch (action) {
      case 'bold': insert = '**' + (selected || 'texte en gras') + '**'; cursorOffset = selected ? 0 : -2; break;
      case 'italic': insert = '*' + (selected || 'texte en italique') + '*'; cursorOffset = selected ? 0 : -1; break;
      case 'strike': insert = '~~' + (selected || 'texte barré') + '~~'; cursorOffset = selected ? 0 : -2; break;
      case 'h1': insert = '\n# ' + (selected || 'Titre principal') + '\n'; break;
      case 'h2': insert = '\n## ' + (selected || 'Sous-titre') + '\n'; break;
      case 'h3': insert = '\n### ' + (selected || 'Section') + '\n'; break;
      case 'ul': insert = selected ? selected.split('\n').map(function(l) { return '- ' + l; }).join('\n') : '\n- Élément 1\n- Élément 2\n- Élément 3\n'; break;
      case 'ol': insert = selected ? selected.split('\n').map(function(l, idx) { return (idx + 1) + '. ' + l; }).join('\n') : '\n1. Élément 1\n2. Élément 2\n3. Élément 3\n'; break;
      case 'checklist': insert = '\n- [ ] Tâche 1\n- [ ] Tâche 2\n- [x] Tâche terminée\n'; break;
      case 'quote': insert = selected ? selected.split('\n').map(function(l) { return '> ' + l; }).join('\n') : '\n> Citation ici\n'; break;
      case 'code': insert = '`' + (selected || 'code') + '`'; cursorOffset = selected ? 0 : -1; break;
      case 'codeblock': insert = '\n```\n' + (selected || '// Votre code ici') + '\n```\n'; break;
      case 'link': insert = selected ? '[' + selected + '](https://)' : '[texte du lien](https://example.com)'; break;
      case 'image': insert = '![description](https://url-de-image.jpg)'; break;
      case 'table': insert = '\n| Colonne 1 | Colonne 2 | Colonne 3 |\n|-----------|-----------|----------|\n| Cellule   | Cellule   | Cellule  |\n| Cellule   | Cellule   | Cellule  |\n'; break;
      case 'hr': insert = '\n---\n'; break;
      default: return;
    }

    textarea.value = before + insert + after;
    textarea.focus();
    var newPos = start + insert.length + cursorOffset;
    textarea.setSelectionRange(newPos, newPos);
    textarea.dispatchEvent(new Event('input'));
  },

  toggleMarkdownPreview: function() {
    var preview = document.getElementById('wa-preview');
    var textarea = document.getElementById('wa-content');
    if (!preview || !textarea) return;
    var isHidden = preview.style.display === 'none' || preview.style.display === '' || !preview.offsetParent;
    if (isHidden) {
      preview.style.display = 'block';
      preview.innerHTML = marked.parse(textarea.value || '*Rien à afficher — commencez à écrire !*');
    } else {
      preview.style.display = 'none';
    }
  },

  updateMarkdownPreview: function() {
    var preview = document.getElementById('wa-preview');
    var textarea = document.getElementById('wa-content');
    if (!preview || !textarea) return;
    // Only update if preview is visible
    if (preview.offsetParent !== null && preview.style.display !== 'none') {
      preview.innerHTML = marked.parse(textarea.value || '*Rien à afficher*');
    }
  },

  // === PUBLISH ARTICLE — sends context: 'wiki' for markdown-aware moderation ===
  publishArticle: async function() {
    if (!App.currentUser) { this.toast('Connectez-vous', 'warning'); return; }
    var title = document.getElementById('wa-title').value.trim();
    var category = document.getElementById('wa-category').value;
    var content = document.getElementById('wa-content').value.trim();
    if (!title || title.length < 3) { this.toast('Titre trop court (min 3)', 'warning'); return; }
    if (!content || content.length < 10) { this.toast('Contenu trop court (min 10)', 'warning'); return; }
    var btn = document.getElementById('btn-wiki-publish');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Publication...';
    try {
      var modResp = await fetch('/api/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title, description: content, context: 'wiki' }) });
      var modData = await modResp.json();
      if (modData.flagged && modData.reformulated && modData.cleaned) { title = modData.cleaned.title; content = modData.cleaned.description; this.toast('Contenu reformulé', 'info'); }
      var slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 80) + '-' + Date.now().toString(36);
      var authorName = (App.currentProfile && App.currentProfile.username) || App.currentUser.email.split('@')[0];
      var result = await App.supabase.from('wiki_articles').insert({ slug: slug, title: title, content: content, category: category, author_id: App.currentUser.id, author_name: authorName, upvotes: 0, views: 0, pinned: false });
      if (result.error) throw result.error;
      if (App.currentProfile) {
        await App.supabase.from('profiles').update({ reputation: (App.currentProfile.reputation || 0) + 5 }).eq('id', App.currentUser.id);
        App.currentProfile.reputation = (App.currentProfile.reputation || 0) + 5;
      }
      this.closeModal('modal-wiki-write');
      this.toast('Article publié ! +5 pts', 'success');
      this.loadCommunityArticles();
    } catch (e) { this.toast('Erreur: ' + (e.message || 'Échec'), 'error'); }
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publier';
  },

  // === TAG PROPOSALS — FIXED VOTE COUNT + ADMIN APPROVE/REJECT ===
  community: function() {
    var self = this;
    var proposeBtn = document.getElementById('btn-propose-tag');
    var formContainer = document.getElementById('tag-proposal-form-container');
    var cancelBtn = document.getElementById('tp-cancel');
    var form = document.getElementById('tag-proposal-form');
    if (proposeBtn) proposeBtn.addEventListener('click', function() {
      if (!App.currentUser) { self.toast('Connectez-vous', 'warning'); return; }
      formContainer.style.display = formContainer.style.display === 'none' ? 'block' : 'none';
    });
    if (cancelBtn) cancelBtn.addEventListener('click', function() { formContainer.style.display = 'none'; });
    if (form) form.addEventListener('submit', function(e) { e.preventDefault(); self.submitTagProposal(); });
  },

  submitTagProposal: async function() {
    if (!App.currentUser) return;
    var name = document.getElementById('tp-name').value.trim();
    var icon = document.getElementById('tp-icon').value.trim() || 'fa-tag';
    var description = document.getElementById('tp-description').value.trim();
    if (!name || name.length < 2) { this.toast('Nom trop court', 'warning'); return; }
    if (!description || description.length < 5) { this.toast('Description trop courte', 'warning'); return; }
    try {
      var authorName = (App.currentProfile && App.currentProfile.username) || 'Anonyme';
      var result = await App.supabase.from('tag_proposals').insert({ name: name, icon: icon, description: description, author_id: App.currentUser.id, author_name: authorName, upvotes: 0 });
      if (result.error) throw result.error;
      this.toast('Proposition envoyée !', 'success');
      document.getElementById('tag-proposal-form').reset();
      document.getElementById('tag-proposal-form-container').style.display = 'none';
      this.loadTagProposals();
    } catch (e) { this.toast('Erreur: ' + (e.message || 'Échec'), 'error'); }
  },

  loadTagProposals: async function() {
    var container = document.getElementById('tag-proposals-list');
    if (!container) return;
    try {
      var result = await App.supabase.from('tag_proposals').select('*').order('upvotes', { ascending: false });
      if (result.error) throw result.error;
      var data = result.data;
      if (!data || data.length === 0) {
        container.innerHTML = '<p style="color:var(--text3);font-size:.8rem;text-align:center;padding:16px">Aucune proposition</p>';
        return;
      }

      // Get user's votes
      var userVotes = {};
      if (App.currentUser) {
        var voteResult = await App.supabase.from('tag_votes').select('proposal_id').eq('user_id', App.currentUser.id);
        if (voteResult.data) {
          for (var v = 0; v < voteResult.data.length; v++) userVotes[voteResult.data[v].proposal_id] = true;
        }
      }

      var isAdmin = App.currentProfile && App.currentProfile.role === 'admin';
      var html = '';
      for (var i = 0; i < data.length; i++) {
        var t = data[i];
        var hasVoted = userVotes[t.id] || false;
        var statusBadge = '';
        if (t.status === 'approved') statusBadge = '<span style="background:var(--green-bg);color:var(--green);padding:2px 6px;border-radius:10px;font-size:.6rem;font-weight:700;margin-left:6px"><i class="fas fa-check"></i> Validé</span>';
        else if (t.status === 'rejected') statusBadge = '<span style="background:var(--red-bg);color:var(--red);padding:2px 6px;border-radius:10px;font-size:.6rem;font-weight:700;margin-left:6px"><i class="fas fa-times"></i> Refusé</span>';

        html += '<div class="adm" style="align-items:flex-start">' +
          '<div style="flex:1"><div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;flex-wrap:wrap">' +
          '<i class="fas ' + App.esc(t.icon) + '" style="color:var(--green)"></i>' +
          '<strong style="font-size:.82rem">' + App.esc(t.name) + '</strong>' + statusBadge + '</div>' +
          '<p style="font-size:.72rem;color:var(--text2);margin-bottom:4px">' + App.esc(t.description) + '</p>' +
          '<span style="font-size:.65rem;color:var(--text3)">Par ' + App.esc(t.author_name) + ' • ' + App.ago(t.created_at) + '</span></div>' +
          '<button class="vote-btn' + (hasVoted ? ' voted' : '') + '" onclick="UI.voteTagProposal(\'' + t.id + '\')" id="tag-vote-btn-' + t.id + '"><i class="fas fa-arrow-up"></i> <span id="tag-vote-count-' + t.id + '">' + (t.upvotes || 0) + '</span></button>';

        if (isAdmin) {
          html += '<div style="display:flex;gap:4px;flex-wrap:wrap">';
          if (t.status !== 'approved') html += '<button class="btn btn--primary" style="font-size:.65rem;padding:3px 8px" onclick="UI.setTagStatus(\'' + t.id + '\',\'approved\')" title="Valider"><i class="fas fa-check"></i></button>';
          if (t.status !== 'rejected') html += '<button class="btn btn--outline" style="font-size:.65rem;padding:3px 8px;color:var(--orange)" onclick="UI.setTagStatus(\'' + t.id + '\',\'rejected\')" title="Refuser"><i class="fas fa-ban"></i></button>';
          html += '<button class="btn btn--danger" style="font-size:.65rem;padding:3px 8px" onclick="UI.deleteTagProposal(\'' + t.id + '\')" title="Supprimer"><i class="fas fa-trash"></i></button></div>';
        }
        html += '</div>';
      }
      container.innerHTML = html;
    } catch (e) { container.innerHTML = '<p style="color:var(--red);font-size:.78rem">Erreur</p>'; }
  },

  voteTagProposal: async function(id) {
    if (!App.currentUser) { this.toast('Connectez-vous', 'warning'); return; }
    try {
      var existResult = await App.supabase.from('tag_votes').select('id').eq('proposal_id', id).eq('user_id', App.currentUser.id).maybeSingle();
      var propResult = await App.supabase.from('tag_proposals').select('upvotes').eq('id', id).single();
      if (propResult.error) throw propResult.error;
      var currentVotes = propResult.data.upvotes || 0;

      if (existResult.data) {
        var delResult = await App.supabase.from('tag_votes').delete().eq('id', existResult.data.id);
        if (delResult.error) throw delResult.error;
        var newCount = Math.max(0, currentVotes - 1);
        var upResult = await App.supabase.from('tag_proposals').update({ upvotes: newCount }).eq('id', id);
        if (upResult.error) throw upResult.error;
        // Update UI immediately
        var countEl = document.getElementById('tag-vote-count-' + id);
        var btnEl = document.getElementById('tag-vote-btn-' + id);
        if (countEl) countEl.textContent = newCount;
        if (btnEl) btnEl.classList.remove('voted');
        this.toast('Vote retiré', 'info');
      } else {
        var insResult = await App.supabase.from('tag_votes').insert({ proposal_id: id, user_id: App.currentUser.id });
        if (insResult.error) throw insResult.error;
        var newCount2 = currentVotes + 1;
        var upResult2 = await App.supabase.from('tag_proposals').update({ upvotes: newCount2 }).eq('id', id);
        if (upResult2.error) throw upResult2.error;
        // Update UI immediately
        var countEl2 = document.getElementById('tag-vote-count-' + id);
        var btnEl2 = document.getElementById('tag-vote-btn-' + id);
        if (countEl2) countEl2.textContent = newCount2;
        if (btnEl2) btnEl2.classList.add('voted');
        this.toast('Vote ajouté !', 'success');
      }
    } catch (e) {
      console.error('Tag vote error:', e);
      this.toast('Erreur: ' + (e.message || 'Échec'), 'error');
      // Reload to sync
      this.loadTagProposals();
    }
  },

  setTagStatus: async function(id, status) {
    if (!App.currentProfile || App.currentProfile.role !== 'admin') { this.toast('Accès refusé', 'error'); return; }
    try {
      var result = await App.supabase.from('tag_proposals').update({ status: status }).eq('id', id);
      if (result.error) throw result.error;
      this.toast(status === 'approved' ? 'Proposition validée !' : 'Proposition refusée', status === 'approved' ? 'success' : 'info');
      this.loadTagProposals();
    } catch (e) { this.toast('Erreur', 'error'); }
  },

  deleteTagProposal: async function(id) {
    if (!confirm('Supprimer cette proposition ?')) return;
    try {
      await App.supabase.from('tag_votes').delete().eq('proposal_id', id);
      var result = await App.supabase.from('tag_proposals').delete().eq('id', id);
      if (result.error) throw result.error;
      this.toast('Supprimé', 'success');
      this.loadTagProposals();
    } catch (e) { this.toast('Erreur', 'error'); }
  },

  contactEmail: function() {
    var emailLink = document.getElementById('contact-email-link');
    var emailDisplay = document.getElementById('contact-email-display');
    if (App.config && App.config.contactEmail) {
      if (emailLink) emailLink.href = 'mailto:' + App.config.contactEmail;
      if (emailDisplay) emailDisplay.textContent = App.config.contactEmail;
    }
    var repoLink = document.getElementById('repo-link');
    if (repoLink && App.config && App.config.repoUrl) repoLink.href = App.config.repoUrl;
  },

  keyboardShortcuts: function() {
    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.shiftKey && e.key === 'N') { e.preventDefault(); var btn = document.getElementById('btn-new-report'); if (btn) btn.click(); }
      // Markdown shortcuts in wiki editor
      var wa = document.getElementById('wa-content');
      if (wa && document.activeElement === wa) {
        if (e.ctrlKey && e.key === 'b') { e.preventDefault(); UI.applyMarkdown('bold'); }
        if (e.ctrlKey && e.key === 'i') { e.preventDefault(); UI.applyMarkdown('italic'); }
        if (e.ctrlKey && e.key === 'k') { e.preventDefault(); UI.applyMarkdown('link'); }
      }
    });
  },

  networkStatus: function() {
    window.addEventListener('offline', function() { UI.toast('Connexion perdue', 'warning'); });
    window.addEventListener('online', function() { UI.toast('Connexion rétablie', 'success'); });
  },

  toast: function(msg, type) {
    type = type || 'info';
    var icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    var container = document.getElementById('toast-container');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'toast toast--' + type;
    toast.innerHTML = '<i class="toast__ico fas ' + (icons[type] || icons.info) + '"></i><span class="toast__msg">' + App.esc(msg) + '</span><button class="toast__x" onclick="this.parentNode.remove()"><i class="fas fa-times"></i></button>';
    container.appendChild(toast);
    setTimeout(function() {
      toast.style.transition = 'all .3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(60px)';
      setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300);
    }, 4000);
  },

  showLoading: function() { var el = document.getElementById('loading-overlay'); if (el) el.classList.add('active'); },
  hideLoading: function() { var el = document.getElementById('loading-overlay'); if (el) el.classList.remove('active'); }
};
