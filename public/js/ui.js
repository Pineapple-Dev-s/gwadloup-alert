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
  wikiCatIcons: { general:'📌', guide:'📖', info:'ℹ️', discussion:'💬', proposition:'💡' },

  init: function() {
    this.nav(); this.modals(); this.filters(); this.form(); this.burger();
    this.catGrid(); this.community(); this.wikiTabs(); this.wikiWrite();
    this.contactEmail(); this.debug();
    ImageUpload.init();
  },

  contactEmail: function() {
    if (App.config && App.config.contactEmail) {
      var link = document.getElementById('contact-email-link');
      var display = document.getElementById('contact-email-display');
      if (link) link.href = 'mailto:' + App.config.contactEmail;
      if (display) display.textContent = App.config.contactEmail;
    }
  },

  debug: function() {
    window.GA = {
      status: function() { console.log('Reports:', App.reports.length, '| User:', App.currentUser ? App.currentUser.email : 'none'); return 'OK'; },
      test: function() { console.log('Config:', !!App.config, '| Supabase:', !!App.supabase, '| Map:', !!MapManager.map); return 'OK'; },
      reload: function() { Reports.loadAll(); return 'Reloaded'; }
    };
  },

  catGrid: function() {
    var g = document.getElementById('category-grid'); if (!g) return;
    var html = '', keys = Object.keys(App.categories);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], v = App.categories[k], fa = this.catIcons[v.icon] || 'fa-map-pin';
      html += '<label class="catc"><input type="radio" name="category" value="' + k + '"><div class="catc__ico"><i class="fas ' + fa + '"></i></div><div class="catc__name">' + v.label + '</div></label>';
    }
    g.innerHTML = html;
    g.addEventListener('change', function() { var b = document.getElementById('btn-step1-next'); if (b) b.disabled = false; });
  },

  nav: function() {
    var self = this, tabs = document.querySelectorAll('.hdr__tab');
    for (var i = 0; i < tabs.length; i++) {
      (function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault(); var view = btn.getAttribute('data-view');
          for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
          btn.classList.add('active');
          var views = document.querySelectorAll('.view');
          for (var j = 0; j < views.length; j++) views[j].classList.remove('active');
          var target = document.getElementById('view-' + view);
          if (target) target.classList.add('active');
          if (view === 'map' && MapManager.map) setTimeout(function() { MapManager.map.invalidateSize(); }, 150);
          if (view === 'stats') Reports.updateStats();
          if (view === 'wiki') self.loadWikiOfficial();
          if (view === 'community') self.loadTagProposals();
          var nav = document.getElementById('main-nav'); if (nav) nav.classList.remove('open');
          var burger = document.getElementById('burger-menu'); if (burger) burger.classList.remove('open');
        });
      })(tabs[i]);
    }
    var logo = document.getElementById('logo-link');
    if (logo) logo.addEventListener('click', function(e) {
      e.preventDefault();
      for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
      var mt = document.querySelector('.hdr__tab[data-view="map"]'); if (mt) mt.classList.add('active');
      var views = document.querySelectorAll('.view');
      for (var j = 0; j < views.length; j++) views[j].classList.remove('active');
      var mv = document.getElementById('view-map'); if (mv) mv.classList.add('active');
      if (MapManager.map) setTimeout(function() { MapManager.map.invalidateSize(); }, 150);
    });
  },

  burger: function() { var b = document.getElementById('burger-menu'); if (b) b.addEventListener('click', function() { b.classList.toggle('open'); var n = document.getElementById('main-nav'); if (n) n.classList.toggle('open'); }); },

  modals: function() {
    document.addEventListener('click', function(e) {
      var c = e.target.hasAttribute('data-close') ? e.target : e.target.closest('[data-close]');
      if (c) { var m = c.closest('.modal'); if (m) { m.classList.remove('open'); document.body.style.overflow = ''; } }
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { var o = document.querySelectorAll('.modal.open'); for (var i = 0; i < o.length; i++) o[i].classList.remove('open'); document.body.style.overflow = ''; }
    });
    var rb = document.getElementById('btn-new-report');
    if (rb) rb.addEventListener('click', function() {
      if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); UI.openModal('modal-login'); return; }
      var f = document.getElementById('report-form'); if (f) f.reset(); ImageUpload.reset();
      var s = document.querySelectorAll('.fstep'); for (var i = 0; i < s.length; i++) s[i].classList.remove('active');
      document.getElementById('step-1').classList.add('active');
      var ind = document.querySelectorAll('.steps__i'); for (var i = 0; i < ind.length; i++) ind[i].classList.remove('active', 'done');
      document.querySelector('.steps__i[data-step="1"]').classList.add('active');
      var b1 = document.getElementById('btn-step1-next'); if (b1) b1.disabled = true;
      var b2 = document.getElementById('btn-step2-next'); if (b2) b2.disabled = true;
      var li = document.getElementById('location-info'); if (li) li.style.display = 'none';
      var dc = document.getElementById('desc-count'); if (dc) dc.textContent = '0';
      UI.openModal('modal-report');
      setTimeout(function() { MapManager.initMiniMap(); }, 400);
    });
  },

  openModal: function(id) { var m = document.getElementById(id); if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; } },
  closeModal: function(id) { var m = document.getElementById(id); if (m) m.classList.remove('open'); if (!document.querySelectorAll('.modal.open').length) document.body.style.overflow = ''; },

  filters: function() {
    var cf = document.getElementById('filter-category'), sf = document.getElementById('filter-status'), cmf = document.getElementById('filter-commune'), rb = document.getElementById('btn-reset-filters'), ss = document.getElementById('sort-reports');
    if (cf) cf.addEventListener('change', function(e) { App.filters.category = e.target.value; Reports.loadAll(); });
    if (sf) sf.addEventListener('change', function(e) { App.filters.status = e.target.value; Reports.loadAll(); });
    if (cmf) cmf.addEventListener('change', function(e) { App.filters.commune = e.target.value; Reports.loadAll(); });
    if (rb) rb.addEventListener('click', function() { App.filters = { category:'', status:'', commune:'' }; if (cf) cf.value=''; if (sf) sf.value=''; if (cmf) cmf.value=''; Reports.loadAll(); });
    if (ss) ss.addEventListener('change', function(e) { var s = e.target.value; if (s==='newest') App.reports.sort(function(a,b){return new Date(b.created_at)-new Date(a.created_at);}); else if (s==='oldest') App.reports.sort(function(a,b){return new Date(a.created_at)-new Date(b.created_at);}); else App.reports.sort(function(a,b){return (b.upvotes||0)-(a.upvotes||0);}); Reports.renderList(); });
  },

  form: function() {
    var self = this;
    var s1 = document.getElementById('btn-step1-next'); if (s1) s1.addEventListener('click', function() { self.goStep(2); });
    var s2 = document.getElementById('btn-step2-next'); if (s2) s2.addEventListener('click', function() { self.goStep(3); });
    var pb = document.querySelectorAll('[data-prev]'); for (var i = 0; i < pb.length; i++) (function(b) { b.addEventListener('click', function() { self.goStep(parseInt(b.getAttribute('data-prev'))); }); })(pb[i]);

    var gb = document.getElementById('btn-geolocate');
    if (gb) gb.addEventListener('click', function() {
      if (!navigator.geolocation) { UI.toast('Non supporté', 'error'); return; }
      gb.disabled = true; gb.textContent = 'Localisation...';
      navigator.geolocation.getCurrentPosition(function(pos) {
        if (!MapManager.isInGuadeloupe(pos.coords.latitude, pos.coords.longitude)) UI.toast('Pas en Guadeloupe. Placez manuellement.', 'warning');
        else { MapManager.setPin(pos.coords.latitude, pos.coords.longitude); MapManager.reverseGeo(pos.coords.latitude, pos.coords.longitude); }
        gb.disabled = false; gb.innerHTML = '<i class="fas fa-crosshairs"></i> Localiser';
      }, function() { UI.toast('Localisation impossible', 'warning'); gb.disabled = false; gb.innerHTML = '<i class="fas fa-crosshairs"></i> Localiser'; }, { enableHighAccuracy: true, timeout: 10000 });
    });

    var timer, si = document.getElementById('address-search'), sr = document.getElementById('search-results');
    if (si && sr) {
      si.addEventListener('input', function() { clearTimeout(timer); var q = si.value.trim(); if (q.length < 3) { sr.classList.remove('open'); return; }
        timer = setTimeout(function() { MapManager.searchAddr(q).then(function(data) {
          if (data.length > 0) { var h = ''; for (var i = 0; i < data.length; i++) h += '<div class="loc-r" data-lat="' + data[i].lat + '" data-lon="' + data[i].lon + '">' + data[i].display_name + '</div>';
            sr.innerHTML = h; sr.classList.add('open'); } else { sr.innerHTML = '<div class="loc-r">Aucun résultat</div>'; sr.classList.add('open'); }
        }); }, 400);
      });
      si.addEventListener('focus', function() { if (sr.children.length > 0 && si.value.trim().length >= 3) sr.classList.add('open'); });
      sr.addEventListener('click', function(e) { var item = e.target.closest('.loc-r'); if (item && item.dataset.lat) {
        var lat = parseFloat(item.dataset.lat), lon = parseFloat(item.dataset.lon);
        if (!MapManager.isInGuadeloupe(lat, lon)) { UI.toast('Pas en Guadeloupe', 'warning'); return; }
        MapManager.setPin(lat, lon); MapManager.reverseGeo(lat, lon); si.value = item.textContent; sr.classList.remove('open');
      }});
      document.addEventListener('click', function(e) { if (!e.target.closest('.loc-search')) sr.classList.remove('open'); });
    }

    var de = document.getElementById('report-description');
    if (de) de.addEventListener('input', function() { var dc = document.getElementById('desc-count'); if (dc) dc.textContent = de.value.length; });
    var prios = document.querySelectorAll('.prio');
    for (var i = 0; i < prios.length; i++) (function(p) { p.addEventListener('click', function() { for (var j = 0; j < prios.length; j++) prios[j].classList.remove('active'); p.classList.add('active'); }); })(prios[i]);
    var form = document.getElementById('report-form');
    if (form) form.addEventListener('submit', function(e) { e.preventDefault(); Reports.submitReport(); });
  },

  goStep: function(n) {
    var s = document.querySelectorAll('.fstep'); for (var i = 0; i < s.length; i++) s[i].classList.remove('active');
    var t = document.getElementById('step-' + n); if (t) t.classList.add('active');
    var ind = document.querySelectorAll('.steps__i');
    for (var i = 0; i < ind.length; i++) { var num = parseInt(ind[i].getAttribute('data-step')); ind[i].classList.remove('active','done'); if (num < n) ind[i].classList.add('done'); if (num === n) ind[i].classList.add('active'); }
    if (n === 2 && MapManager.miniMap) setTimeout(function() { MapManager.miniMap.invalidateSize(); }, 150);
  },

  // === WIKI TABS ===
  wikiTabs: function() {
    var self = this;
    var tabs = document.querySelectorAll('.wiki-tab');
    for (var i = 0; i < tabs.length; i++) {
      (function(tab) {
        tab.addEventListener('click', function() {
          for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
          tab.classList.add('active');
          var panels = document.querySelectorAll('.wiki-panel');
          for (var j = 0; j < panels.length; j++) panels[j].classList.remove('active');
          var target = document.getElementById('wpanel-' + tab.getAttribute('data-wtab'));
          if (target) target.classList.add('active');
          if (tab.getAttribute('data-wtab') === 'community') self.loadCommunityArticles();
        });
      })(tabs[i]);
    }

    var catF = document.getElementById('wiki-cat-filter');
    var sortF = document.getElementById('wiki-sort');
    if (catF) catF.addEventListener('change', function() { self.loadCommunityArticles(); });
    if (sortF) sortF.addEventListener('change', function() { self.loadCommunityArticles(); });
  },

  // === OFFICIAL WIKI (static .md files) ===
  loadWikiOfficial: function() {
    var self = this;
    fetch('/api/wiki-static').then(function(r) { return r.json(); }).then(function(pages) {
      var nav = document.getElementById('wiki-nav'); if (!nav) return;
      var html = '';
      for (var i = 0; i < pages.length; i++) html += '<button class="wnav' + (i === 0 ? ' active' : '') + '" data-page="' + pages[i].slug + '">' + pages[i].title + '</button>';
      nav.innerHTML = html;
      nav.addEventListener('click', function(e) {
        var btn = e.target.closest('.wnav'); if (!btn) return;
        var allNav = nav.querySelectorAll('.wnav'); for (var j = 0; j < allNav.length; j++) allNav[j].classList.remove('active');
        btn.classList.add('active'); self.loadWikiStaticPage(btn.getAttribute('data-page'));
      });
      if (pages.length > 0) self.loadWikiStaticPage(pages[0].slug);
      else { var c = document.getElementById('wiki-content'); if (c) c.innerHTML = '<p style="padding:24px;color:var(--text2)">Aucune page</p>'; }
    }).catch(function() { var c = document.getElementById('wiki-content'); if (c) c.innerHTML = '<p>Erreur</p>'; });
  },

  loadWikiStaticPage: function(slug) {
    var el = document.getElementById('wiki-content'); if (!el) return;
    el.innerHTML = '<p class="wiki__load">Chargement...</p>';
    fetch('/api/wiki-static/' + slug).then(function(r) { if (!r.ok) throw new Error(); return r.text(); }).then(function(md) {
      el.innerHTML = marked.parse(md);
    }).catch(function() { el.innerHTML = '<p>Page introuvable</p>'; });
  },

  // === COMMUNITY ARTICLES (Supabase) ===
  loadCommunityArticles: async function() {
    var container = document.getElementById('community-articles-list'); if (!container) return;
    container.innerHTML = '<p class="wiki__load">Chargement...</p>';

    try {
      var catFilter = document.getElementById('wiki-cat-filter');
      var sortFilter = document.getElementById('wiki-sort');
      var cat = catFilter ? catFilter.value : '';
      var sort = sortFilter ? sortFilter.value : 'newest';

      var query = App.supabase.from('wiki_articles').select('*');
      if (cat) query = query.eq('category', cat);
      if (sort === 'popular') query = query.order('upvotes', { ascending: false });
      else query = query.order('created_at', { ascending: false });

      var { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty" style="padding:40px"><span>📝</span><h3>Aucun article</h3><p style="color:var(--text2);margin-top:8px">Soyez le premier a ecrire !</p></div>';
        return;
      }

      var html = '';
      for (var i = 0; i < data.length; i++) {
        var a = data[i];
        var catIcon = this.wikiCatIcons[a.category] || '📌';
        var preview = a.content.replace(/[#*_\[\]`>|]/g, '').substring(0, 120);
        html += '<div class="wcard" onclick="UI.openWikiArticle(\'' + a.id + '\')">' +
          '<div class="wcard__head">' +
          '<span class="wcard__cat">' + catIcon + ' ' + (a.category || 'general') + '</span>' +
          '<span class="wcard__date">' + App.ago(a.created_at) + '</span>' +
          '</div>' +
          '<h3 class="wcard__title">' + App.esc(a.title) + '</h3>' +
          '<p class="wcard__preview">' + App.esc(preview) + '...</p>' +
          '<div class="wcard__foot">' +
          '<span class="wcard__author"><i class="fas fa-user"></i> ' + App.esc(a.author_name) + '</span>' +
          '<span class="wcard__votes"><i class="fas fa-arrow-up"></i> ' + (a.upvotes || 0) + '</span>' +
          '</div></div>';
      }
      container.innerHTML = html;
    } catch (e) {
      console.error('Load articles error:', e);
      container.innerHTML = '<p style="color:var(--red)">Erreur de chargement</p>';
    }
  },

  openWikiArticle: async function(id) {
    var container = document.getElementById('wiki-article-detail'); if (!container) return;
    container.innerHTML = '<p class="wiki__load" style="padding:40px">Chargement...</p>';
    UI.openModal('modal-wiki-article');

    try {
      var { data: article, error } = await App.supabase.from('wiki_articles').select('*').eq('id', id).single();
      if (error || !article) throw error || new Error('Not found');

      var catIcon = this.wikiCatIcons[article.category] || '📌';
      var isOwner = App.currentUser && article.author_id === App.currentUser.id;
      var isAdmin = App.currentProfile && App.currentProfile.role === 'admin';

      // Check vote
      var hasVoted = false;
      if (App.currentUser) {
        try {
          var { data: vote } = await App.supabase.from('wiki_votes').select('id').eq('article_id', id).eq('user_id', App.currentUser.id).single();
          if (vote) hasVoted = true;
        } catch (e) {}
      }

      var html = '<div style="padding:20px">' +
        '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">' +
        '<span class="badge badge--cat">' + catIcon + ' ' + (article.category || 'general') + '</span>' +
        '</div>' +
        '<h1 style="font-size:1.3rem;font-weight:700;margin-bottom:8px">' + App.esc(article.title) + '</h1>' +
        '<div class="det__meta" style="margin-bottom:16px">' +
        '<span><i class="fas fa-user"></i> ' + App.esc(article.author_name) + '</span>' +
        '<span><i class="fas fa-clock"></i> ' + App.ago(article.created_at) + '</span>' +
        '</div>' +
        '<div class="wiki__body" style="padding:0;border:none">' + marked.parse(article.content) + '</div>' +
        '<div class="det__actions" style="margin-top:20px">' +
        '<button class="vote-btn' + (hasVoted ? ' voted' : '') + '" onclick="UI.voteWikiArticle(\'' + id + '\')">' +
        '<i class="fas fa-arrow-up"></i> <span id="wavote-' + id + '">' + (article.upvotes || 0) + '</span> Soutenir</button>';

      if (isOwner || isAdmin) {
        html += '<button class="btn btn--danger" onclick="UI.deleteWikiArticle(\'' + id + '\')"><i class="fas fa-trash"></i> Supprimer</button>';
      }
      html += '</div>';

      // Comments
      html += '<div class="comments"><div class="comments__title"><i class="fas fa-comments"></i> Commentaires</div>';
      if (App.currentUser) {
        html += '<div class="cmtform"><textarea id="wcmt-input-' + id + '" placeholder="Votre commentaire..." rows="2"></textarea>' +
          '<button class="btn btn--primary" onclick="UI.addWikiComment(\'' + id + '\')"><i class="fas fa-paper-plane"></i></button></div>';
      }
      html += '<div id="wcmt-list-' + id + '"></div></div></div>';

      container.innerHTML = html;
      this.loadWikiComments(id);
    } catch (e) {
      container.innerHTML = '<p style="padding:40px;color:var(--red)">Article introuvable</p>';
    }
  },

  loadWikiComments: async function(articleId) {
    var el = document.getElementById('wcmt-list-' + articleId); if (!el) return;
    try {
      var { data: comments } = await App.supabase.from('wiki_comments').select('*, profiles(username)').eq('article_id', articleId).order('created_at', { ascending: true });
      if (!comments || comments.length === 0) { el.innerHTML = '<p style="color:var(--text3);font-size:.78rem;padding:8px">Aucun commentaire</p>'; return; }
      var html = '';
      for (var i = 0; i < comments.length; i++) {
        var c = comments[i], name = (c.profiles && c.profiles.username) || 'Anonyme';
        html += '<div class="cmt"><div class="cmt__av">' + name.charAt(0).toUpperCase() + '</div><div class="cmt__body"><div class="cmt__head"><span class="cmt__author">' + App.esc(name) + '</span><span class="cmt__date">' + App.ago(c.created_at) + '</span></div><div class="cmt__text">' + App.esc(c.content) + '</div></div></div>';
      }
      el.innerHTML = html;
    } catch (e) { el.innerHTML = '<p style="color:var(--text3)">Erreur</p>'; }
  },

  addWikiComment: async function(articleId) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    var input = document.getElementById('wcmt-input-' + articleId); if (!input) return;
    var content = input.value.trim();
    if (!content || content.length < 2) { UI.toast('Trop court', 'warning'); return; }
    try {
      var { error } = await App.supabase.from('wiki_comments').insert({ article_id: articleId, user_id: App.currentUser.id, content: content });
      if (error) throw error;
      input.value = ''; UI.toast('Commentaire ajouté', 'success');
      this.loadWikiComments(articleId);
    } catch (e) { UI.toast('Erreur', 'error'); }
  },

  voteWikiArticle: async function(id) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    try {
      var { data: existing } = await App.supabase.from('wiki_votes').select('id').eq('article_id', id).eq('user_id', App.currentUser.id).single();
      var { data: article } = await App.supabase.from('wiki_articles').select('upvotes').eq('id', id).single();
      var current = article ? (article.upvotes || 0) : 0;

      if (existing) {
        await App.supabase.from('wiki_votes').delete().eq('id', existing.id);
        await App.supabase.from('wiki_articles').update({ upvotes: Math.max(0, current - 1) }).eq('id', id);
        UI.toast('Vote retiré', 'info');
      } else {
        await App.supabase.from('wiki_votes').insert({ article_id: id, user_id: App.currentUser.id });
        await App.supabase.from('wiki_articles').update({ upvotes: current + 1 }).eq('id', id);
        UI.toast('Merci !', 'success');
      }
      this.openWikiArticle(id);
    } catch (e) { UI.toast('Erreur', 'error'); }
  },

  deleteWikiArticle: async function(id) {
    if (!confirm('Supprimer cet article ?')) return;
    try {
      var { error } = await App.supabase.from('wiki_articles').delete().eq('id', id);
      if (error) throw error;
      UI.toast('Article supprimé', 'success');
      UI.closeModal('modal-wiki-article');
      this.loadCommunityArticles();
    } catch (e) { UI.toast('Erreur: ' + (e.message || ''), 'error'); }
  },

  // === WIKI WRITE ===
  wikiWrite: function() {
    var self = this;
    var newBtn = document.getElementById('btn-new-article');
    if (newBtn) newBtn.addEventListener('click', function() {
      if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
      document.getElementById('wiki-write-title').textContent = 'Ecrire un article';
      var f = document.getElementById('wiki-write-form'); if (f) f.reset();
      document.getElementById('wa-char-count').textContent = '0';
      UI.openModal('modal-wiki-write');
    });

    var contentInput = document.getElementById('wa-content');
    if (contentInput) contentInput.addEventListener('input', function() { var c = document.getElementById('wa-char-count'); if (c) c.textContent = contentInput.value.length; });

    var form = document.getElementById('wiki-write-form');
    if (form) form.addEventListener('submit', function(e) { e.preventDefault(); self.publishWikiArticle(); });
  },

  publishWikiArticle: async function() {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }

    var title = document.getElementById('wa-title').value.trim();
    var category = document.getElementById('wa-category').value;
    var content = document.getElementById('wa-content').value.trim();

    if (!title || title.length < 3) { UI.toast('Titre trop court', 'warning'); return; }
    if (!content || content.length < 10) { UI.toast('Contenu trop court', 'warning'); return; }

    var slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 80);
    var authorName = (App.currentProfile && App.currentProfile.username) || 'Anonyme';

    var btn = document.getElementById('btn-wiki-publish');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Publication...';

    try {
      // Moderate
      var modResp = await fetch('/api/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title, description: content }) });
      var modData = await modResp.json();
      if (modData.flagged) {
        if (modData.reformulated && modData.cleaned) { title = modData.cleaned.title; content = modData.cleaned.description; UI.toast('Contenu reformulé', 'info'); }
        else { UI.toast('Contenu inapproprié', 'error'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publier'; return; }
      }

      var { error } = await App.supabase.from('wiki_articles').insert({
        slug: slug + '-' + Date.now().toString(36),
        title: title, content: content, category: category,
        author_id: App.currentUser.id, author_name: authorName
      });
      if (error) throw error;

      UI.closeModal('modal-wiki-write');
      UI.toast('Article publié !', 'success');

      // Switch to community tab and reload
      var communityTab = document.querySelector('.wiki-tab[data-wtab="community"]');
      if (communityTab) communityTab.click();
      else this.loadCommunityArticles();
    } catch (e) {
      console.error('Publish error:', e);
      UI.toast('Erreur: ' + (e.message || 'Échec'), 'error');
    }

    btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publier';
  },

  // === COMMUNITY / TAG PROPOSALS ===
  community: function() {
    var self = this;
    var pb = document.getElementById('btn-propose-tag'), fc = document.getElementById('tag-proposal-form-container'), cb = document.getElementById('tp-cancel'), f = document.getElementById('tag-proposal-form');
    if (pb) pb.addEventListener('click', function() { if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; } pb.style.display = 'none'; fc.style.display = 'block'; });
    if (cb) cb.addEventListener('click', function() { fc.style.display = 'none'; pb.style.display = 'inline-flex'; f.reset(); });
    if (f) f.addEventListener('submit', function(e) { e.preventDefault(); self.submitTagProposal(); });
  },

  submitTagProposal: async function() {
    var name = document.getElementById('tp-name').value.trim(), icon = document.getElementById('tp-icon').value.trim(), desc = document.getElementById('tp-description').value.trim();
    var author = App.currentProfile ? App.currentProfile.username : 'Anonyme';
    try {
      var resp = await fetch('/api/tag-proposals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, icon: icon, description: desc, author: author }) });
      var data = await resp.json();
      if (!resp.ok) { UI.toast(data.error || 'Erreur', 'error'); } else { UI.toast('Tag proposé !', 'success'); document.getElementById('tag-proposal-form').reset(); document.getElementById('tag-proposal-form-container').style.display = 'none'; document.getElementById('btn-propose-tag').style.display = 'inline-flex'; this.loadTagProposals(); }
    } catch (e) { UI.toast('Erreur réseau', 'error'); }
  },

  loadTagProposals: async function() {
    var c = document.getElementById('tag-proposals-list'); if (!c) return;
    try {
      var resp = await fetch('/api/tag-proposals'); var proposals = await resp.json();
      if (proposals.length === 0) { c.innerHTML = '<p style="color:var(--text3);font-size:.8rem">Aucune proposition</p>'; return; }
      proposals.sort(function(a, b) { return (b.votes || 0) - (a.votes || 0); });
      var html = '';
      for (var i = 0; i < proposals.length; i++) { var p = proposals[i], hv = App.currentUser && p.voters && p.voters.includes(App.currentUser.id);
        html += '<div class="adm" style="cursor:default"><div style="font-size:1.2rem;margin-right:6px"><i class="fas ' + (p.icon || 'fa-tag') + '"></i></div><div class="adm__info"><div class="adm__title">' + App.esc(p.name) + '</div><div class="adm__meta">' + App.esc(p.description) + '</div><div class="adm__meta">Par ' + App.esc(p.author) + ' • ' + App.ago(p.created_at) + '</div></div><button class="vote-btn' + (hv ? ' voted' : '') + '" onclick="UI.voteTagProposal(\'' + p.id + '\')"><i class="fas fa-arrow-up"></i> ' + (p.votes || 0) + '</button></div>';
      }
      c.innerHTML = html;
    } catch (e) { c.innerHTML = '<p style="color:var(--text3)">Erreur</p>'; }
  },

  voteTagProposal: async function(id) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    try {
      var resp = await fetch('/api/tag-proposals/' + id + '/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voter: App.currentUser.id }) });
      if (resp.ok) this.loadTagProposals(); else { var d = await resp.json(); UI.toast(d.error || 'Erreur', 'error'); }
    } catch (e) { UI.toast('Erreur', 'error'); }
  },

  toast: function(msg, type) {
    type = type || 'info';
    var icons = { success:'fa-check-circle', error:'fa-exclamation-circle', warning:'fa-exclamation-triangle', info:'fa-info-circle' };
    var c = document.getElementById('toast-container'); if (!c) return;
    var t = document.createElement('div'); t.className = 'toast toast--' + type;
    t.innerHTML = '<i class="toast__ico fas ' + icons[type] + '"></i><span class="toast__msg">' + msg + '</span><button class="toast__x" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>';
    c.appendChild(t);
    setTimeout(function() { if (t.parentElement) { t.style.opacity = '0'; t.style.transform = 'translateX(60px)'; t.style.transition = '.2s'; setTimeout(function() { if (t.parentElement) t.remove(); }, 200); } }, 4000);
  },

  showLoading: function() { var e = document.getElementById('loading-overlay'); if (e) e.classList.add('active'); },
  hideLoading: function() { var e = document.getElementById('loading-overlay'); if (e) e.classList.remove('active'); }
};
