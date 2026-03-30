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
  _viewedArticles: {},
  _previewVisible: false,

  init: function() {
    this.nav(); this.modals(); this.filters(); this.form(); this.burger();
    this.catGrid(); this.community(); this.wikiTabs(); this.wikiWrite();
    this.contactEmail(); this.keyboardShortcuts(); this.networkStatus();
    ImageUpload.init();
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
        document.getElementById('main-nav').classList.remove('open');
        document.getElementById('burger-menu').classList.remove('open');
        if (view === 'map' && MapManager.map) setTimeout(function() { MapManager.map.invalidateSize(); }, 100);
        if (view === 'stats') Reports.updateStats();
        if (view === 'wiki') { self.loadWikiStatic(); self.loadCommunityArticles(); }
        if (view === 'community') self.loadTagProposals();
      });
    }
    var logo = document.getElementById('logo-link');
    if (logo) logo.addEventListener('click', function(e) {
      e.preventDefault();
      document.querySelector('[data-view="map"]').click();
    });
  },

  burger: function() {
    var burger = document.getElementById('burger-menu');
    var nav = document.getElementById('main-nav');
    if (burger && nav) burger.addEventListener('click', function() { burger.classList.toggle('open'); nav.classList.toggle('open'); });
  },

  modals: function() {
    var self = this;
    document.querySelectorAll('[data-close]').forEach(function(el) {
      el.addEventListener('click', function() { var m = el.closest('.modal'); if (m) self.closeModal(m.id); });
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { var ms = document.querySelectorAll('.modal.open'); if (ms.length) self.closeModal(ms[ms.length - 1].id); }
    });
    var newBtn = document.getElementById('btn-new-report');
    if (newBtn) newBtn.addEventListener('click', function() {
      if (!App.currentUser) { self.toast('Connectez-vous', 'warning'); return; }
      self.resetReportForm(); self.openModal('modal-report');
      setTimeout(function() { MapManager.initMiniMap(); }, 200);
    });
  },

  openModal: function(id) { var m = document.getElementById(id); if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; } },
  closeModal: function(id) { var m = document.getElementById(id); if (m) m.classList.remove('open'); if (!document.querySelector('.modal.open')) document.body.style.overflow = ''; },

  filters: function() {
    ['filter-category','filter-status','filter-commune'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', function() {
        App.filters.category = document.getElementById('filter-category').value;
        App.filters.status = document.getElementById('filter-status').value;
        App.filters.commune = document.getElementById('filter-commune').value;
        Reports.loadAll();
      });
    });
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
      else if (v === 'most-voted') App.reports.sort(function(a, b) { return (b.upvotes||0) - (a.upvotes||0); });
      Reports.renderList();
    });
  },

  form: function() {
    var self = this;
    var s1 = document.getElementById('btn-step1-next'); if (s1) s1.addEventListener('click', function() { self.goStep(2); });
    var s2 = document.getElementById('btn-step2-next'); if (s2) s2.addEventListener('click', function() { self.goStep(3); });
    document.querySelectorAll('[data-prev]').forEach(function(b) { b.addEventListener('click', function() { self.goStep(parseInt(b.getAttribute('data-prev'))); }); });
    var desc = document.getElementById('report-description');
    if (desc) desc.addEventListener('input', function() { var c = document.getElementById('desc-count'); if (c) c.textContent = desc.value.length; });
    var form = document.getElementById('report-form');
    if (form) form.addEventListener('submit', function(e) { e.preventDefault(); Reports.submitReport(); });
    var geo = document.getElementById('btn-geolocate');
    if (geo) geo.addEventListener('click', function() { self.geolocate(); });
    var addr = document.getElementById('address-search');
    if (addr) {
      addr.addEventListener('input', function() {
        clearTimeout(self.searchTimeout);
        var q = addr.value.trim();
        if (q.length < 3) { document.getElementById('search-results').classList.remove('open'); return; }
        self.searchTimeout = setTimeout(function() { self.searchAddress(q); }, 400);
      });
      document.addEventListener('click', function(e) { if (!e.target.closest('.loc-search')) document.getElementById('search-results').classList.remove('open'); });
    }
  },

  goStep: function(n) {
    document.querySelectorAll('.fstep').forEach(function(s) { s.classList.remove('active'); });
    document.querySelectorAll('.steps__i').forEach(function(ind) {
      var s = parseInt(ind.getAttribute('data-step'));
      ind.classList.remove('active','done');
      if (s < n) ind.classList.add('done'); else if (s === n) ind.classList.add('active');
    });
    var t = document.getElementById('step-' + n); if (t) t.classList.add('active');
  },

  geolocate: function() {
    if (!navigator.geolocation) { this.toast('Non supporté', 'error'); return; }
    this.toast('Localisation...', 'info');
    navigator.geolocation.getCurrentPosition(function(p) {
      if (!MapManager.isInGuadeloupe(p.coords.latitude, p.coords.longitude)) { UI.toast('Hors Guadeloupe', 'warning'); return; }
      MapManager.setPin(p.coords.latitude, p.coords.longitude);
      MapManager.reverseGeo(p.coords.latitude, p.coords.longitude);
      UI.toast('Position trouvée', 'success');
    }, function() { UI.toast('Erreur géolocalisation', 'error'); }, { enableHighAccuracy: true, timeout: 10000 });
  },

  searchAddress: async function(q) {
    var results = await MapManager.searchAddr(q);
    var c = document.getElementById('search-results');
    if (!results || !results.length) { c.innerHTML = '<div class="loc-r" style="color:var(--text3)">Aucun résultat</div>'; c.classList.add('open'); return; }
    var html = '';
    for (var i = 0; i < results.length; i++) html += '<div class="loc-r" data-lat="' + results[i].lat + '" data-lon="' + results[i].lon + '" data-name="' + App.esc(results[i].display_name) + '">' + App.esc(results[i].display_name) + '</div>';
    c.innerHTML = html; c.classList.add('open');
    c.querySelectorAll('.loc-r').forEach(function(el) {
      el.addEventListener('click', function() {
        MapManager.setPin(parseFloat(el.getAttribute('data-lat')), parseFloat(el.getAttribute('data-lon')));
        document.getElementById('report-address').value = el.getAttribute('data-name');
        document.getElementById('selected-address').textContent = el.getAttribute('data-name');
        document.getElementById('location-info').style.display = 'flex';
        document.getElementById('address-search').value = el.getAttribute('data-name');
        c.classList.remove('open');
        MapManager.reverseGeo(parseFloat(el.getAttribute('data-lat')), parseFloat(el.getAttribute('data-lon')));
      });
    });
  },

  resetReportForm: function() {
    var f = document.getElementById('report-form'); if (f) f.reset();
    this.goStep(1);
    ['report-lat','report-lng','report-address','report-commune'].forEach(function(id) { document.getElementById(id).value = ''; });
    document.getElementById('location-info').style.display = 'none';
    document.getElementById('btn-step1-next').disabled = true;
    document.getElementById('btn-step2-next').disabled = true;
    var dc = document.getElementById('desc-count'); if (dc) dc.textContent = '0';
    ImageUpload.reset();
  },

  catGrid: function() {
    var grid = document.getElementById('category-grid'); if (!grid) return;
    var html = '';
    for (var k in App.categories) {
      var c = App.categories[k], fa = this.catIcons[c.icon] || 'fa-map-pin';
      html += '<label class="catc"><input type="radio" name="category" value="' + k + '"><span class="catc__ico"><i class="fas ' + fa + '"></i></span><span class="catc__name">' + c.label + '</span></label>';
    }
    grid.innerHTML = html;
    grid.querySelectorAll('input[name="category"]').forEach(function(inp) { inp.addEventListener('change', function() { document.getElementById('btn-step1-next').disabled = false; }); });
  },

  // === WIKI ===
  wikiTabs: function() {
    var self = this;
    document.querySelectorAll('.wiki-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        var t = tab.getAttribute('data-wtab');
        document.querySelectorAll('.wiki-tab').forEach(function(x) { x.classList.remove('active'); }); tab.classList.add('active');
        document.querySelectorAll('.wiki-panel').forEach(function(x) { x.classList.remove('active'); });
        var p = document.getElementById('wpanel-' + t); if (p) p.classList.add('active');
        if (t === 'community') self.loadCommunityArticles();
      });
    });
  },

  loadWikiStatic: async function() {
    try {
      var pages = await (await fetch('/api/wiki-static')).json();
      var nav = document.getElementById('wiki-nav'); if (!nav) return;
      if (!pages.length) { nav.innerHTML = '<p style="color:var(--text3);font-size:.75rem">Pas de docs</p>'; return; }
      var html = '';
      for (var i = 0; i < pages.length; i++) html += '<button class="wnav' + (i===0?' active':'') + '" data-slug="' + pages[i].slug + '">' + App.esc(pages[i].title) + '</button>';
      nav.innerHTML = html;
      nav.querySelectorAll('.wnav').forEach(function(b) { b.addEventListener('click', function() { nav.querySelectorAll('.wnav').forEach(function(x){x.classList.remove('active');}); b.classList.add('active'); UI.loadWikiPage(b.getAttribute('data-slug')); }); });
      if (pages.length) this.loadWikiPage(pages[0].slug);
    } catch(e) {}
  },

  loadWikiPage: async function(slug) {
    var c = document.getElementById('wiki-content'); if (!c) return;
    c.innerHTML = '<p class="wiki__load">Chargement...</p>';
    try { var r = await fetch('/api/wiki-static/' + slug); if (!r.ok) throw 0; c.innerHTML = marked.parse(await r.text()); } catch(e) { c.innerHTML = '<p style="color:var(--text3)">Non trouvé</p>'; }
  },

  loadCommunityArticles: async function() {
    var c = document.getElementById('community-articles-list'); if (!c) return;
    c.innerHTML = '<p class="wiki__load">Chargement...</p>';
    try {
      var cf = document.getElementById('wiki-cat-filter'), sf = document.getElementById('wiki-sort');
      var q = App.supabase.from('wiki_articles').select('*');
      if (cf && cf.value) q = q.eq('category', cf.value);
      if (sf && sf.value === 'popular') q = q.order('upvotes', {ascending:false}); else q = q.order('pinned', {ascending:false}).order('created_at', {ascending:false});
      var r = await q; if (r.error) throw r.error;
      if (!r.data || !r.data.length) { c.innerHTML = '<div class="empty" style="padding:40px"><i class="fas fa-pen-fancy fa-2x" style="color:var(--text3);margin-bottom:8px"></i><h3 style="font-size:.9rem">Pas encore d\'articles</h3></div>'; return; }
      var html = '';
      for (var i = 0; i < r.data.length; i++) {
        var a = r.data[i], ci = this.wikiCatIcons[a.category]||'📌', prev = (a.content||'').replace(/[#*`\[\]>|_~\-]/g,'').substring(0,150);
        var pin = a.pinned ? '<span style="background:var(--yellow);color:#000;padding:1px 6px;border-radius:10px;font-size:.6rem;font-weight:700;margin-left:6px"><i class="fas fa-thumbtack"></i> Épinglé</span>' : '';
        html += '<div class="wcard" onclick="UI.openArticle(\''+a.id+'\')"><div class="wcard__head"><span class="wcard__cat">'+ci+' '+(a.category||'general')+pin+'</span><span class="wcard__date">'+App.ago(a.created_at)+'</span></div><div class="wcard__title">'+App.esc(a.title)+'</div><div class="wcard__preview">'+App.esc(prev)+'</div><div class="wcard__foot"><span class="wcard__author"><i class="fas fa-user"></i> '+App.esc(a.author_name||'Anonyme')+'</span><span class="wcard__votes"><i class="fas fa-arrow-up"></i> '+(a.upvotes||0)+' · <i class="fas fa-eye"></i> '+(a.views||0)+'</span></div></div>';
      }
      c.innerHTML = html;
      if (cf && !cf._bound) { cf.addEventListener('change', function() { UI.loadCommunityArticles(); }); cf._bound = true; }
      if (sf && !sf._bound) { sf.addEventListener('change', function() { UI.loadCommunityArticles(); }); sf._bound = true; }
    } catch(e) { c.innerHTML = '<p style="color:var(--red)">Erreur</p>'; }
  },

  _countVotes: async function(table, fk, id) {
    try { var r = await App.supabase.from(table).select('id', {count:'exact',head:true}).eq(fk, id); return r.count || 0; } catch(e) { return 0; }
  },

  openArticle: async function(id) {
    var c = document.getElementById('wiki-article-detail'); if (!c) return;
    c.innerHTML = '<p class="wiki__load">Chargement...</p>';
    this.openModal('modal-wiki-article');
    try {
      if (!this._viewedArticles[id]) { this._viewedArticles[id] = true; var vr = await App.supabase.from('wiki_articles').select('views').eq('id',id).single(); if (vr.data) await App.supabase.from('wiki_articles').update({views:(vr.data.views||0)+1}).eq('id',id); }
      var r = await App.supabase.from('wiki_articles').select('*').eq('id',id).single(); if (r.error) throw r.error;
      var a = r.data, isAdmin = App.currentProfile && App.currentProfile.role === 'admin', isAuthor = App.currentUser && a.author_id === App.currentUser.id, hasVoted = false;
      if (App.currentUser) { var vr2 = await App.supabase.from('wiki_votes').select('id').eq('article_id',id).eq('user_id',App.currentUser.id).maybeSingle(); if (vr2.data) hasVoted = true; }
      var realVotes = await this._countVotes('wiki_votes','article_id',id);
      var ci = this.wikiCatIcons[a.category]||'📌';
      var pin = a.pinned ? ' <span style="background:var(--yellow);color:#000;padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:700"><i class="fas fa-thumbtack"></i> Épinglé</span>' : '';

      var html = '<div style="padding:20px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px"><span class="wcard__cat" style="font-size:.75rem">'+ci+' '+(a.category||'general')+pin+'</span><span style="font-size:.7rem;color:var(--text3)">'+App.ago(a.created_at)+'</span></div>' +
        '<h1 style="font-size:1.3rem;font-weight:700;margin-bottom:12px">'+App.esc(a.title)+'</h1>' +
        '<div style="display:flex;gap:12px;font-size:.78rem;color:var(--text2);margin-bottom:16px;flex-wrap:wrap">' +
        '<span style="cursor:pointer;text-decoration:underline dotted" onclick="UI.openPublicProfile(\''+a.author_id+'\')"><i class="fas fa-user" style="color:var(--green)"></i> '+App.esc(a.author_name||'Anonyme')+'</span>' +
        '<span><i class="fas fa-eye"></i> '+(a.views||0)+' vues</span><span><i class="fas fa-arrow-up" style="color:var(--orange)"></i> '+realVotes+' votes</span></div>' +
        '<div class="wiki__body" style="margin-bottom:16px">'+marked.parse(a.content||'')+'</div>';

      // Poll
      if (a.poll_data && typeof Polls !== 'undefined') html += Polls.renderPoll(a.poll_data, id);

      html += '<div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--border);margin-bottom:16px">' +
        '<button class="vote-btn'+(hasVoted?' voted':'')+'" onclick="UI.toggleArticleVote(\''+id+'\')"><i class="fas fa-arrow-up"></i> <span id="article-vote-count">'+realVotes+'</span> Voter</button>' +
        '<button class="btn btn--outline" onclick="Share.article({id:\''+id+'\',title:\''+App.esc(a.title).replace(/'/g,"\\'")+'\'})"><i class="fas fa-share-alt"></i> Partager</button>';
      if (isAdmin) html += '<button class="btn btn--outline" onclick="UI.togglePinArticle(\''+id+'\','+!a.pinned+')"><i class="fas fa-thumbtack"></i> '+(a.pinned?'Désépingler':'Épingler')+'</button>';
      if (isAdmin || isAuthor) html += '<button class="btn btn--danger" onclick="Auth.deleteWikiArticle(\''+id+'\')"><i class="fas fa-trash"></i> Supprimer</button>';
      html += '</div>';

      // Comments
      html += '<div class="comments" style="margin-top:0"><div class="comments__title" style="font-size:.9rem;margin-bottom:12px"><i class="fas fa-comments"></i> Discussion</div>';
      if (App.currentUser) html += '<div class="cmtform"><textarea id="wiki-comment-input-'+id+'" placeholder="Votre commentaire..." rows="2" style="flex:1"></textarea><button class="btn btn--primary" onclick="UI.addWikiComment(\''+id+'\',null)"><i class="fas fa-paper-plane"></i></button></div>';
      else html += '<p style="font-size:.78rem;color:var(--text3);margin-bottom:12px">Connectez-vous pour commenter</p>';
      html += '<div id="wiki-comments-'+id+'"><p class="wiki__load" style="font-size:.78rem">Chargement...</p></div></div></div>';

      c.innerHTML = html;
      this.loadWikiComments(id);
    } catch(e) { c.innerHTML = '<p style="color:var(--red);padding:20px">Erreur</p>'; }
  },

  togglePinArticle: async function(id, pin) {
    if (!App.currentProfile || App.currentProfile.role !== 'admin') { this.toast('Accès refusé','error'); return; }
    var r = await App.supabase.from('wiki_articles').update({pinned:pin,updated_at:new Date().toISOString()}).eq('id',id);
    if (r.error) this.toast('Erreur','error'); else { this.toast(pin?'Épinglé !':'Désépinglé','success'); this.openArticle(id); this.loadCommunityArticles(); }
  },

  toggleArticleVote: async function(id) {
    if (!App.currentUser) { this.toast('Connectez-vous','warning'); return; }
    try {
      var ex = await App.supabase.from('wiki_votes').select('id').eq('article_id',id).eq('user_id',App.currentUser.id).maybeSingle();
      if (ex.data) { await App.supabase.from('wiki_votes').delete().eq('id',ex.data.id); this.toast('Vote retiré','info'); }
      else { var ins = await App.supabase.from('wiki_votes').insert({article_id:id,user_id:App.currentUser.id}); if (ins.error) throw ins.error; this.toast('Merci !','success'); }
      var real = await this._countVotes('wiki_votes','article_id',id);
      await App.supabase.from('wiki_articles').update({upvotes:real}).eq('id',id);
      this.openArticle(id);
    } catch(e) { this.toast('Erreur','error'); }
  },

  // === THREADED COMMENTS ===
  loadWikiComments: async function(aid) {
    var c = document.getElementById('wiki-comments-'+aid); if (!c) return;
    try {
      var r = await App.supabase.from('wiki_comments').select('*, profiles(username)').eq('article_id',aid).order('created_at',{ascending:true});
      if (r.error) throw r.error;
      if (!r.data || !r.data.length) { c.innerHTML = '<p style="color:var(--text3);font-size:.78rem;padding:8px">Aucun commentaire</p>'; return; }
      var roots = [], map = {};
      for (var i = 0; i < r.data.length; i++) { if (!r.data[i].reply_to) roots.push(r.data[i]); else { if (!map[r.data[i].reply_to]) map[r.data[i].reply_to] = []; map[r.data[i].reply_to].push(r.data[i]); } }
      c.innerHTML = this._renderTree(roots, map, aid, 0);
    } catch(e) { c.innerHTML = '<p style="color:var(--red);font-size:.78rem">Erreur</p>'; }
  },

  _renderTree: function(comments, map, aid, depth) {
    var html = '', maxD = 4, indent = Math.min(depth,maxD)*20, isAdmin = App.currentProfile && App.currentProfile.role === 'admin';
    for (var i = 0; i < comments.length; i++) {
      var c = comments[i], n = (c.profiles&&c.profiles.username)||'Anonyme', ini = n.charAt(0).toUpperCase(), own = App.currentUser && c.user_id === App.currentUser.id;
      var border = depth > 0 ? 'border-left:2px solid var(--green);padding-left:8px;background:rgba(63,185,80,.02);' : '';
      html += '<div class="cmt" style="margin-left:'+indent+'px;'+border+'margin-bottom:6px"><div class="cmt__av">'+ini+'</div><div class="cmt__body" style="flex:1">' +
        '<div class="cmt__head"><span class="cmt__author" style="cursor:pointer" onclick="UI.openPublicProfile(\''+c.user_id+'\')">'+App.esc(n)+'</span><span class="cmt__date">'+App.ago(c.created_at)+'</span></div>' +
        '<div class="cmt__text">'+App.esc(c.content)+'</div><div style="display:flex;gap:8px;margin-top:4px">';
      if (App.currentUser && depth < maxD) html += '<button class="btn btn--ghost" style="font-size:.65rem;padding:2px 6px" onclick="UI.showReplyForm(\''+aid+'\',\''+c.id+'\')"><i class="fas fa-reply"></i> Répondre</button>';
      if (own || isAdmin) html += '<button class="btn btn--ghost" style="font-size:.65rem;padding:2px 6px;color:var(--red)" onclick="UI.deleteWikiComment(\''+aid+'\',\''+c.id+'\')"><i class="fas fa-trash"></i></button>';
      html += '</div><div id="reply-form-'+c.id+'"></div></div></div>';
      if (map[c.id]) html += this._renderTree(map[c.id], map, aid, depth+1);
    }
    return html;
  },

  showReplyForm: function(aid, pid) {
    var c = document.getElementById('reply-form-'+pid); if (!c) return;
    if (c.innerHTML.trim()) { c.innerHTML = ''; return; }
    c.innerHTML = '<div class="cmtform" style="margin-top:6px"><textarea id="reply-input-'+pid+'" placeholder="Réponse..." rows="2" style="flex:1;font-size:.78rem"></textarea><button class="btn btn--primary" style="font-size:.72rem" onclick="UI.addWikiComment(\''+aid+'\',\''+pid+'\')"><i class="fas fa-paper-plane"></i></button><button class="btn btn--ghost" style="font-size:.72rem" onclick="document.getElementById(\'reply-form-'+pid+'\').innerHTML=\'\'">Annuler</button></div>';
    setTimeout(function() { var t = document.getElementById('reply-input-'+pid); if (t) t.focus(); }, 50);
  },

  addWikiComment: async function(aid, pid) {
    if (!App.currentUser) { this.toast('Connectez-vous','warning'); return; }
    var iid = pid ? 'reply-input-'+pid : 'wiki-comment-input-'+aid;
    var inp = document.getElementById(iid); if (!inp) return;
    var content = inp.value.trim();
    if (!content || content.length < 2) { this.toast('Trop court','warning'); return; }
    try {
      var mod = await (await fetch('/api/moderate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'',description:content,context:'wiki'})})).json();
      if (mod.flagged && mod.reformulated && mod.cleaned) { content = mod.cleaned.description; this.toast('Reformulé','info'); }
      var d = {article_id:aid,user_id:App.currentUser.id,content:content}; if (pid) d.reply_to = pid;
      var r = await App.supabase.from('wiki_comments').insert(d); if (r.error) throw r.error;
      inp.value = ''; if (pid) { var rc = document.getElementById('reply-form-'+pid); if (rc) rc.innerHTML = ''; }
      this.toast('Ajouté','success'); this.loadWikiComments(aid);
    } catch(e) { this.toast('Erreur','error'); }
  },

  deleteWikiComment: async function(aid, cid) {
    if (!confirm('Supprimer ?')) return;
    await App.supabase.from('wiki_comments').delete().eq('reply_to',cid);
    await App.supabase.from('wiki_comments').delete().eq('id',cid);
    this.toast('Supprimé','success'); this.loadWikiComments(aid);
  },

  // === WIKI WRITE ===
  wikiWrite: function() {
    var self = this;
    var btn = document.getElementById('btn-new-article');
    if (btn) btn.addEventListener('click', function() {
      if (!App.currentUser) { self.toast('Connectez-vous','warning'); return; }
      document.getElementById('wiki-write-title').textContent = 'Écrire un article';
      document.getElementById('wa-title').value = '';
      document.getElementById('wa-category').value = 'general';
      document.getElementById('wa-content').value = '';
      document.getElementById('wa-char-count').textContent = '0';
      self._previewVisible = false;
      var prev = document.getElementById('wa-preview'); if (prev) { prev.style.display = 'none'; prev.innerHTML = ''; }
      var old = document.getElementById('md-toolbar'); if (old) old.remove();
      var wa = document.getElementById('wa-content'); if (wa) { wa.style.borderRadius = ''; wa.style.borderTop = ''; }
      // Remove old poll form
      var pf = document.getElementById('poll-form-container'); if (pf) pf.remove();
      self.openModal('modal-wiki-write');
      setTimeout(function() {
        self.initMarkdownToolbar();
        // Add poll button
        if (typeof Polls !== 'undefined' && !document.getElementById('poll-form-container')) {
          var waForm = document.getElementById('wiki-write-form');
          var lastDiv = waForm.querySelector('div:last-child');
          var pd = document.createElement('div'); pd.id = 'poll-form-container';
          pd.innerHTML = '<button type="button" class="btn btn--outline" style="margin-bottom:8px" onclick="Polls.toggleForm()"><i class="fas fa-poll"></i> Ajouter un sondage</button>' + Polls.getFormHtml();
          waForm.insertBefore(pd, lastDiv);
        }
      }, 200);
    });
    var wa = document.getElementById('wa-content');
    if (wa) wa.addEventListener('input', function() { document.getElementById('wa-char-count').textContent = wa.value.length; if (UI._previewVisible) UI.updateMarkdownPreview(); });
    var form = document.getElementById('wiki-write-form');
    if (form) form.addEventListener('submit', function(e) { e.preventDefault(); self.publishArticle(); });
  },

  initMarkdownToolbar: function() {
    var ta = document.getElementById('wa-content'); if (!ta) return;
    var old = document.getElementById('md-toolbar'); if (old) old.remove();
    var tb = document.createElement('div'); tb.id = 'md-toolbar';
    tb.style.cssText = 'display:flex;gap:2px;flex-wrap:wrap;padding:6px 8px;background:var(--bg3);border:1px solid var(--border);border-bottom:none;border-radius:var(--r) var(--r) 0 0';
    var btns = [
      {i:'fa-bold',t:'Gras',a:'bold'},{i:'fa-italic',t:'Italique',a:'italic'},{i:'fa-strikethrough',t:'Barré',a:'strike'},{sep:1},
      {i:'fa-heading',t:'H1',a:'h1'},{i:'fa-heading',t:'H2',a:'h2',s:1},{i:'fa-heading',t:'H3',a:'h3',ss:1},{sep:1},
      {i:'fa-list-ul',t:'Liste',a:'ul'},{i:'fa-list-ol',t:'Numéros',a:'ol'},{i:'fa-check-square',t:'Check',a:'checklist'},{sep:1},
      {i:'fa-quote-left',t:'Citation',a:'quote'},{i:'fa-code',t:'Code',a:'code'},{i:'fa-file-code',t:'Bloc',a:'codeblock'},{sep:1},
      {i:'fa-link',t:'Lien',a:'link'},{i:'fa-image',t:'Image',a:'image'},{i:'fa-table',t:'Tableau',a:'table'},{i:'fa-minus',t:'Séparateur',a:'hr'},{sep:1},
      {i:'fa-eye',t:'Aperçu',a:'preview',sp:1}
    ];
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (b.sep) { var s = document.createElement('div'); s.style.cssText = 'width:1px;height:20px;background:var(--border);margin:0 2px;align-self:center'; tb.appendChild(s); continue; }
      var btn = document.createElement('button'); btn.type = 'button'; btn.title = b.t;
      btn.style.cssText = 'width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:'+(b.sp?'var(--green2)':'var(--bg)')+';border:1px solid var(--border);border-radius:3px;cursor:pointer;color:'+(b.sp?'#fff':'var(--text2)')+';font-size:.7rem;transition:all .1s';
      var fs = b.ss?' style="font-size:.5rem"':(b.s?' style="font-size:.6rem"':'');
      btn.innerHTML = '<i class="fas '+b.i+'"'+fs+'></i>';
      (function(a){btn.addEventListener('click',function(e){e.preventDefault();UI.applyMarkdown(a);});})(b.a);
      tb.appendChild(btn);
    }
    ta.parentNode.insertBefore(tb, ta);
    ta.style.borderRadius = '0 0 var(--r) var(--r)';
    ta.style.borderTop = 'none';
  },

  applyMarkdown: function(a) {
    if (a === 'preview') { this.toggleMarkdownPreview(); return; }
    var ta = document.getElementById('wa-content'); if (!ta) return;
    var s = ta.selectionStart, e = ta.selectionEnd, t = ta.value, sel = t.substring(s,e), bef = t.substring(0,s), aft = t.substring(e), ins = '', co = 0;
    switch(a) {
      case 'bold': ins='**'+(sel||'gras')+'**'; co=sel?0:-2; break;
      case 'italic': ins='*'+(sel||'italique')+'*'; co=sel?0:-1; break;
      case 'strike': ins='~~'+(sel||'barré')+'~~'; co=sel?0:-2; break;
      case 'h1': ins='\n# '+(sel||'Titre')+'\n'; break;
      case 'h2': ins='\n## '+(sel||'Sous-titre')+'\n'; break;
      case 'h3': ins='\n### '+(sel||'Section')+'\n'; break;
      case 'ul': ins=sel?sel.split('\n').map(function(l){return '- '+l;}).join('\n'):'\n- Item 1\n- Item 2\n- Item 3\n'; break;
      case 'ol': ins=sel?sel.split('\n').map(function(l,i){return(i+1)+'. '+l;}).join('\n'):'\n1. Item 1\n2. Item 2\n3. Item 3\n'; break;
      case 'checklist': ins='\n- [ ] Tâche 1\n- [ ] Tâche 2\n- [x] Fait\n'; break;
      case 'quote': ins=sel?sel.split('\n').map(function(l){return '> '+l;}).join('\n'):'\n> Citation\n'; break;
      case 'code': ins='`'+(sel||'code')+'`'; co=sel?0:-1; break;
      case 'codeblock': ins='\n```\n'+(sel||'// code')+'\n```\n'; break;
      case 'link': ins=sel?'['+sel+'](https://)':'[lien](https://example.com)'; break;
      case 'image': ins='![desc](https://image.jpg)'; break;
      case 'table': ins='\n| Col 1 | Col 2 | Col 3 |\n|-------|-------|-------|\n| A | B | C |\n'; break;
      case 'hr': ins='\n---\n'; break;
      default: return;
    }
    ta.value = bef + ins + aft; ta.focus();
    ta.setSelectionRange(s+ins.length+co, s+ins.length+co);
    ta.dispatchEvent(new Event('input'));
  },

  toggleMarkdownPreview: function() {
    var p = document.getElementById('wa-preview'), ta = document.getElementById('wa-content');
    if (!p || !ta) return;
    this._previewVisible = !this._previewVisible;
    if (this._previewVisible) {
      p.innerHTML = ta.value ? marked.parse(ta.value) : '<p style="color:var(--text3);font-style:italic">Commencez à écrire...</p>';
      p.style.cssText = 'display:block;min-height:100px;max-height:300px;overflow-y:auto;padding:12px;margin-bottom:8px;border:1px solid var(--green);border-radius:var(--r);background:var(--bg)';
    } else { p.style.display = 'none'; p.innerHTML = ''; }
  },

  updateMarkdownPreview: function() {
    if (!this._previewVisible) return;
    var p = document.getElementById('wa-preview'), ta = document.getElementById('wa-content');
    if (p && ta) p.innerHTML = ta.value ? marked.parse(ta.value) : '<p style="color:var(--text3)">Écrivez...</p>';
  },

  publishArticle: async function() {
    if (!App.currentUser) { this.toast('Connectez-vous','warning'); return; }
    var title = document.getElementById('wa-title').value.trim(), cat = document.getElementById('wa-category').value, content = document.getElementById('wa-content').value.trim();
    if (!title || title.length < 3) { this.toast('Titre trop court','warning'); return; }
    if (!content || content.length < 10) { this.toast('Contenu trop court','warning'); return; }
    var btn = document.getElementById('btn-wiki-publish'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Publication...';
    try {
      var mod = await (await fetch('/api/moderate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:title,description:content,context:'wiki'})})).json();
      if (mod.flagged && mod.reformulated && mod.cleaned) { title = mod.cleaned.title; content = mod.cleaned.description; this.toast('Reformulé','info'); }
      var slug = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').substring(0,80)+'-'+Date.now().toString(36);
      var aName = (App.currentProfile&&App.currentProfile.username)||App.currentUser.email.split('@')[0];
      var insertData = {slug:slug,title:title,content:content,category:cat,author_id:App.currentUser.id,author_name:aName,upvotes:0,views:0,pinned:false};
      // Poll data
      if (typeof Polls !== 'undefined') { var pd = Polls.getData(); if (pd) insertData.poll_data = pd; }
      var r = await App.supabase.from('wiki_articles').insert(insertData); if (r.error) throw r.error;
      if (App.currentProfile) { await App.supabase.from('profiles').update({reputation:(App.currentProfile.reputation||0)+5}).eq('id',App.currentUser.id); App.currentProfile.reputation = (App.currentProfile.reputation||0)+5; }
      this._previewVisible = false; this.closeModal('modal-wiki-write'); this.toast('Publié ! +5 pts','success'); this.loadCommunityArticles();
    } catch(e) { this.toast('Erreur','error'); }
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publier';
  },

  // === TAG PROPOSALS ===
  community: function() {
    var self = this;
    var pb = document.getElementById('btn-propose-tag'), fc = document.getElementById('tag-proposal-form-container'), cb = document.getElementById('tp-cancel'), f = document.getElementById('tag-proposal-form');
    if (pb) pb.addEventListener('click', function() { if (!App.currentUser) { self.toast('Connectez-vous','warning'); return; } fc.style.display = fc.style.display==='none'?'block':'none'; });
    if (cb) cb.addEventListener('click', function() { fc.style.display = 'none'; });
    if (f) f.addEventListener('submit', function(e) { e.preventDefault(); self.submitTagProposal(); });
  },

  submitTagProposal: async function() {
    if (!App.currentUser) return;
    var n = document.getElementById('tp-name').value.trim(), ic = document.getElementById('tp-icon').value.trim()||'fa-tag', d = document.getElementById('tp-description').value.trim();
    if (!n||n.length<2) { this.toast('Nom trop court','warning'); return; }
    if (!d||d.length<5) { this.toast('Description trop courte','warning'); return; }
    var an = (App.currentProfile&&App.currentProfile.username)||'Anonyme';
    var r = await App.supabase.from('tag_proposals').insert({name:n,icon:ic,description:d,author_id:App.currentUser.id,author_name:an,upvotes:0});
    if (r.error) { this.toast('Erreur','error'); return; }
    this.toast('Envoyé !','success'); document.getElementById('tag-proposal-form').reset(); document.getElementById('tag-proposal-form-container').style.display = 'none'; this.loadTagProposals();
  },

  loadTagProposals: async function() {
    var c = document.getElementById('tag-proposals-list'); if (!c) return;
    try {
      var r = await App.supabase.from('tag_proposals').select('*').order('upvotes',{ascending:false}); if (r.error) throw r.error;
      if (!r.data||!r.data.length) { c.innerHTML = '<p style="color:var(--text3);font-size:.8rem;text-align:center;padding:16px">Aucune proposition</p>'; return; }
      var uv = {};
      if (App.currentUser) { var vr = await App.supabase.from('tag_votes').select('proposal_id').eq('user_id',App.currentUser.id); if (vr.data) for (var v=0;v<vr.data.length;v++) uv[vr.data[v].proposal_id]=true; }
      var isAdmin = App.currentProfile && App.currentProfile.role === 'admin', html = '';
      for (var i=0;i<r.data.length;i++) {
        var t = r.data[i], hv = uv[t.id]||false;
        var realCount = await this._countVotes('tag_votes','proposal_id',t.id);
        var sb = '';
        if (t.status==='approved') sb='<span style="background:var(--green-bg);color:var(--green);padding:2px 6px;border-radius:10px;font-size:.6rem;font-weight:700;margin-left:6px"><i class="fas fa-check"></i> Validé</span>';
        else if (t.status==='rejected') sb='<span style="background:var(--red-bg);color:var(--red);padding:2px 6px;border-radius:10px;font-size:.6rem;font-weight:700;margin-left:6px"><i class="fas fa-times"></i> Refusé</span>';
        html += '<div class="adm" style="align-items:flex-start"><div style="flex:1"><div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;flex-wrap:wrap"><i class="fas '+App.esc(t.icon)+'" style="color:var(--green)"></i><strong style="font-size:.82rem">'+App.esc(t.name)+'</strong>'+sb+'</div><p style="font-size:.72rem;color:var(--text2);margin-bottom:4px">'+App.esc(t.description)+'</p><span style="font-size:.65rem;color:var(--text3)">Par '+App.esc(t.author_name)+' • '+App.ago(t.created_at)+'</span></div>' +
          '<button class="vote-btn'+(hv?' voted':'')+'" onclick="UI.voteTagProposal(\''+t.id+'\')" id="tag-vote-btn-'+t.id+'"><i class="fas fa-arrow-up"></i> <span id="tag-vote-count-'+t.id+'">'+realCount+'</span></button>';
        if (isAdmin) {
          html += '<div style="display:flex;gap:4px">';
          if (t.status!=='approved') html+='<button class="btn btn--primary" style="font-size:.65rem;padding:3px 8px" onclick="UI.setTagStatus(\''+t.id+'\',\'approved\')"><i class="fas fa-check"></i></button>';
          if (t.status!=='rejected') html+='<button class="btn btn--outline" style="font-size:.65rem;padding:3px 8px;color:var(--orange)" onclick="UI.setTagStatus(\''+t.id+'\',\'rejected\')"><i class="fas fa-ban"></i></button>';
          html+='<button class="btn btn--danger" style="font-size:.65rem;padding:3px 8px" onclick="UI.deleteTagProposal(\''+t.id+'\')"><i class="fas fa-trash"></i></button></div>';
        }
        html += '</div>';
      }
      c.innerHTML = html;
    } catch(e) { c.innerHTML = '<p style="color:var(--red)">Erreur</p>'; }
  },

  voteTagProposal: async function(id) {
    if (!App.currentUser) { this.toast('Connectez-vous','warning'); return; }
    try {
      var ex = await App.supabase.from('tag_votes').select('id').eq('proposal_id',id).eq('user_id',App.currentUser.id).maybeSingle();
      if (ex.data) { await App.supabase.from('tag_votes').delete().eq('id',ex.data.id); this.toast('Vote retiré','info'); }
      else { var ins = await App.supabase.from('tag_votes').insert({proposal_id:id,user_id:App.currentUser.id}); if (ins.error) throw ins.error; this.toast('Vote ajouté !','success'); }
      var real = await this._countVotes('tag_votes','proposal_id',id);
      await App.supabase.from('tag_proposals').update({upvotes:real}).eq('id',id);
      var ce = document.getElementById('tag-vote-count-'+id); if (ce) ce.textContent = real;
      var be = document.getElementById('tag-vote-btn-'+id); if (be) { if (ex.data) be.classList.remove('voted'); else be.classList.add('voted'); }
    } catch(e) { this.toast('Erreur','error'); this.loadTagProposals(); }
  },

  setTagStatus: async function(id, status) {
    if (!App.currentProfile||App.currentProfile.role!=='admin') { this.toast('Accès refusé','error'); return; }
    var r = await App.supabase.from('tag_proposals').update({status:status}).eq('id',id);
    if (r.error) this.toast('Erreur','error'); else { this.toast(status==='approved'?'Validée !':'Refusée',status==='approved'?'success':'info'); this.loadTagProposals(); }
  },

  deleteTagProposal: async function(id) {
    if (!confirm('Supprimer ?')) return;
    await App.supabase.from('tag_votes').delete().eq('proposal_id',id);
    await App.supabase.from('tag_proposals').delete().eq('id',id);
    this.toast('Supprimé','success'); this.loadTagProposals();
  },

  // === PUBLIC PROFILE ===
  openPublicProfile: async function(userId) {
    var c = document.getElementById('public-profile-content'); if (!c) return;
    c.innerHTML = '<p class="wiki__load">Chargement...</p>';
    this.openModal('modal-public-profile');
    try {
      var pr = await App.supabase.from('profiles').select('*').eq('id',userId).single(); if (pr.error) throw pr.error;
      var p = pr.data, n = p.username||'Anonyme', ini = n.charAt(0).toUpperCase();
      var rc = await App.supabase.from('reports').select('id',{count:'exact',head:true}).eq('user_id',userId);
      var html = '<div style="padding:24px;text-align:center">' +
        '<div class="umenu__av-lg" style="width:64px;height:64px;font-size:1.8rem;margin:0 auto 12px;background:var(--green2)">'+ini+'</div>' +
        '<h2 style="font-size:1.1rem;margin-bottom:4px">'+App.esc(n)+'</h2>' +
        '<div style="font-size:.75rem;color:var(--text2);margin-bottom:16px">'+(p.commune?'<i class="fas fa-map-pin"></i> '+App.esc(p.commune)+' • ':'')+App.ago(p.created_at)+'</div>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px">' +
        '<div class="sc"><div class="sc__v" style="font-size:1.2rem">'+(rc.count||0)+'</div><div class="sc__l">Signalements</div></div>' +
        '<div class="sc"><div class="sc__v" style="font-size:1.2rem;color:var(--green)">'+(p.reputation||0)+'</div><div class="sc__l">Réputation</div></div>' +
        '<div class="sc"><div class="sc__v" style="font-size:1.2rem;color:var(--yellow)" id="pub-badge-count">...</div><div class="sc__l">Badges</div></div></div>' +
        '<div id="pub-badges-container"><p style="color:var(--text3);font-size:.78rem">Chargement badges...</p></div></div>';
      c.innerHTML = html;
      if (typeof Badges !== 'undefined') {
        Badges.getUnlocked(p, userId).then(function(res) {
          var bc = document.getElementById('pub-badges-container');
          var bcc = document.getElementById('pub-badge-count');
          if (bc) bc.innerHTML = Badges.renderBadges(res.unlocked, res.total, false);
          if (bcc) bcc.textContent = res.unlocked.length;
        });
      }
    } catch(e) { c.innerHTML = '<p style="color:var(--red);padding:20px">Erreur</p>'; }
  },

  // === UTILITIES ===
  contactEmail: function() {
    var el = document.getElementById('contact-email-link'), ed = document.getElementById('contact-email-display');
    if (App.config&&App.config.contactEmail) { if (el) el.href='mailto:'+App.config.contactEmail; if (ed) ed.textContent=App.config.contactEmail; }
    var rl = document.getElementById('repo-link'); if (rl&&App.config&&App.config.repoUrl) rl.href=App.config.repoUrl;
  },

  keyboardShortcuts: function() {
    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey&&e.shiftKey&&e.key==='N') { e.preventDefault(); var b=document.getElementById('btn-new-report'); if(b) b.click(); }
      var wa = document.getElementById('wa-content');
      if (wa && document.activeElement === wa) {
        if (e.ctrlKey&&e.key==='b') { e.preventDefault(); UI.applyMarkdown('bold'); }
        if (e.ctrlKey&&e.key==='i') { e.preventDefault(); UI.applyMarkdown('italic'); }
        if (e.ctrlKey&&e.key==='k') { e.preventDefault(); UI.applyMarkdown('link'); }
      }
    });
  },

  networkStatus: function() {
    window.addEventListener('offline', function() { UI.toast('Hors ligne','warning'); });
    window.addEventListener('online', function() { UI.toast('Reconnecté','success'); });
  },

  toast: function(msg, type) {
    type = type||'info';
    var icons = {success:'fa-check-circle',error:'fa-exclamation-circle',warning:'fa-exclamation-triangle',info:'fa-info-circle'};
    var c = document.getElementById('toast-container'); if (!c) return;
    var t = document.createElement('div'); t.className = 'toast toast--'+type;
    t.innerHTML = '<i class="toast__ico fas '+(icons[type]||icons.info)+'"></i><span class="toast__msg">'+App.esc(msg)+'</span><button class="toast__x" onclick="this.parentNode.remove()"><i class="fas fa-times"></i></button>';
    c.appendChild(t);
    setTimeout(function() { t.style.transition='all .3s'; t.style.opacity='0'; t.style.transform='translateX(60px)'; setTimeout(function(){if(t.parentNode)t.remove();},300); }, 4000);
  },

  showLoading: function() { var e=document.getElementById('loading-overlay'); if(e) e.classList.add('active'); },
  hideLoading: function() { var e=document.getElementById('loading-overlay'); if(e) e.classList.remove('active'); }
};
