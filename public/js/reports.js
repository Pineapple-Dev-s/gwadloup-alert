const Reports = {
  async loadAll() {
    try {
      var q = App.supabase.from('reports').select('*, profiles:user_id(username)').order('created_at', { ascending: false });
      if (App.filters.category) q = q.eq('category', App.filters.category);
      if (App.filters.status) q = q.eq('status', App.filters.status);
      if (App.filters.commune) q = q.ilike('commune', '%' + App.filters.commune + '%');
      var result = await q;
      if (result.error) throw result.error;
      App.reports = result.data || [];
      MapManager.clear();
      App.reports.forEach(function(r) { MapManager.addReport(r); });
      this.renderList();
      this.updateStats();
    } catch (e) {
      console.error('Load:', e);
      UI.toast('Erreur de chargement', 'error');
    }
  },

  renderList() {
    var grid = document.getElementById('reports-grid');
    var empty = document.getElementById('list-empty');
    var count = document.getElementById('list-count');
    count.textContent = App.reports.length + ' résultat' + (App.reports.length > 1 ? 's' : '');

    if (App.reports.length === 0) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    grid.innerHTML = App.reports.map(function(r) {
      var cat = App.categories[r.category] || App.categories.other;
      var st = App.statuses[r.status] || App.statuses.pending;
      var hasImg = r.images && r.images.length > 0;
      return '<div class="card" onclick="Reports.openDetail(\'' + r.id + '\')">' +
        (hasImg
          ? '<img class="card__img" src="' + r.images[0] + '" alt="" loading="lazy">'
          : '<div class="card__ph">' + cat.emoji + '</div>') +
        '<div class="card__body">' +
        '<div class="card__row"><span class="badge badge--cat">' + cat.emoji + ' ' + cat.label + '</span><span class="badge badge--' + r.status + '">' + st.icon + ' ' + st.label + '</span></div>' +
        '<div class="card__title">' + App.esc(r.title) + '</div>' +
        '<div class="card__addr">' + (r.commune || r.address || 'Guadeloupe') + '</div>' +
        '<div class="card__foot"><span class="card__votes"><i class="fas fa-arrow-up"></i> ' + (r.upvotes || 0) + '</span><span class="card__date">' + App.ago(r.created_at) + '</span></div>' +
        '</div></div>';
    }).join('');
  },

  updateStats() {
    var t = App.reports.length;
    var p = 0, a = 0, ip = 0, rs = 0;
    App.reports.forEach(function(r) {
      if (r.status === 'pending') p++;
      if (r.status === 'acknowledged') a++;
      if (r.status === 'in_progress') ip++;
      if (r.status === 'resolved') rs++;
    });

    var setT = function(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    setT('stat-total', t);
    setT('stat-pending', p);
    setT('stat-progress', ip + a);
    setT('stat-resolved', rs);
    setT('stats-total', t);
    setT('stats-pending', p);
    setT('stats-in-progress', ip);
    setT('stats-resolved', rs);

    this.renderCharts();
    this.renderLeaderboard();
  },

  renderCharts() {
    // Categories
    var cc = {};
    App.reports.forEach(function(r) { cc[r.category] = (cc[r.category] || 0) + 1; });
    var sorted = Object.entries(cc).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 8);
    var max = sorted.length > 0 ? sorted[0][1] : 1;
    var catEl = document.getElementById('chart-categories');
    if (catEl) {
      catEl.innerHTML = sorted.map(function(item) {
        var c = App.categories[item[0]] || App.categories.other;
        var pct = (item[1] / max) * 100;
        return '<div class="bar"><span class="bar__label">' + c.emoji + ' ' + c.label + '</span><div class="bar__track"><div class="bar__fill" style="width:' + pct + '%"><span class="bar__val">' + item[1] + '</span></div></div></div>';
      }).join('') || '<p style="color:var(--text3);text-align:center;padding:12px">Aucune donnée</p>';
    }

    // Communes
    var cm = {};
    App.reports.forEach(function(r) { if (r.commune) cm[r.commune] = (cm[r.commune] || 0) + 1; });
    var sc = Object.entries(cm).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 8);
    var mx = sc.length > 0 ? sc[0][1] : 1;
    var comEl = document.getElementById('chart-communes');
    if (comEl) {
      comEl.innerHTML = sc.map(function(item) {
        var pct = (item[1] / mx) * 100;
        return '<div class="bar"><span class="bar__label">' + App.esc(item[0]) + '</span><div class="bar__track"><div class="bar__fill" style="width:' + pct + '%"><span class="bar__val">' + item[1] + '</span></div></div></div>';
      }).join('') || '<p style="color:var(--text3);text-align:center;padding:12px">Aucune donnée</p>';
    }
  },

  async renderLeaderboard() {
    try {
      var result = await App.supabase.from('profiles').select('username, reports_count, reputation').order('reputation', { ascending: false }).limit(10);
      var data = result.data;
      var el = document.getElementById('leaderboard-list');
      if (!el) return;
      if (!data || data.length === 0) {
        el.innerHTML = '<p style="color:var(--text3);text-align:center;padding:12px">Aucun contributeur</p>';
        return;
      }
      el.innerHTML = data.map(function(u, i) {
        return '<div class="lb"><span class="lb__rank">' + (i + 1) + '</span><div class="lb__av">' + u.username.charAt(0).toUpperCase() + '</div><div class="lb__info"><div class="lb__name">' + App.esc(u.username) + '</div><div class="lb__sub">' + u.reports_count + ' signalement' + (u.reports_count > 1 ? 's' : '') + '</div></div><span class="lb__pts">' + u.reputation + ' pts</span></div>';
      }).join('');
    } catch (e) {
      console.error('Leaderboard:', e);
    }
  },

  async openDetail(id) {
    var r = null;
    for (var i = 0; i < App.reports.length; i++) {
      if (App.reports[i].id === id) { r = App.reports[i]; break; }
    }
    if (!r) return;

    var cat = App.categories[r.category] || App.categories.other;
    var st = App.statuses[r.status] || App.statuses.pending;
    var pri = App.priorities[r.priority] || App.priorities.medium;

    // Load comments
    var commentsResult = await App.supabase.from('comments').select('*, profiles:user_id(username)').eq('report_id', id).order('created_at', { ascending: true });
    var comments = commentsResult.data || [];

    // Check vote
    var hasVoted = false;
    if (App.currentUser) {
      var voteResult = await App.supabase.from('votes').select('id').eq('report_id', id).eq('user_id', App.currentUser.id).maybeSingle();
      hasVoted = !!(voteResult.data);
    }

    var el = document.getElementById('report-detail');

    // Gallery
    var gallery = '';
    if (r.images && r.images.length > 0) {
      gallery = '<div class="det__gal"><img src="' + r.images[0] + '" alt="" id="detail-main-img"></div>';
    } else {
      gallery = '<div class="det__gal"><div class="det__gal--ph">' + cat.emoji + '</div></div>';
    }

    // Extra images
    var extraImgs = '';
    if (r.images && r.images.length > 1) {
      extraImgs = '<div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">';
      r.images.forEach(function(img) {
        extraImgs += '<img src="' + img + '" style="width:56px;height:56px;object-fit:cover;border-radius:var(--r);cursor:pointer;border:1px solid var(--border)" onclick="document.getElementById(\'detail-main-img\').src=\'' + img + '\'">';
      });
      extraImgs += '</div>';
    }

    // Comments HTML
    var cmtsHtml = comments.map(function(c) {
      var uname = (c.profiles && c.profiles.username) ? c.profiles.username : '?';
      return '<div class="cmt"><div class="cmt__av">' + uname.charAt(0).toUpperCase() + '</div><div class="cmt__body"><div class="cmt__head"><span class="cmt__author">' + App.esc(uname) + '</span><span class="cmt__date">' + App.ago(c.created_at) + '</span></div><div class="cmt__text">' + App.esc(c.content) + '</div></div></div>';
    }).join('');

    var authorName = (r.profiles && r.profiles.username) ? r.profiles.username : '?';

    el.innerHTML = gallery +
      '<div class="det__body">' +
      '<div class="det__badges">' +
      '<span class="badge badge--cat">' + cat.emoji + ' ' + cat.label + '</span>' +
      '<span class="badge badge--' + r.status + '">' + st.icon + ' ' + st.label + '</span>' +
      '<span class="badge" style="background:' + pri.color + '22;color:' + pri.color + '">Priorité ' + pri.label + '</span>' +
      '</div>' +
      '<h2 class="det__title">' + App.esc(r.title) + '</h2>' +
      '<div class="det__meta">' +
      '<span><i class="fas fa-user"></i> ' + App.esc(authorName) + '</span>' +
      '<span><i class="fas fa-map-marker-alt"></i> ' + (r.commune || 'Guadeloupe') + '</span>' +
      '<span><i class="fas fa-calendar"></i> ' + new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + '</span>' +
      '</div>' +
      extraImgs +
      '<div class="det__desc">' + App.esc(r.description) + '</div>' +
      (r.admin_response ? '<div style="background:var(--blue-bg);padding:10px;border-radius:var(--r);margin-bottom:12px;border:1px solid rgba(88,166,255,.2)"><strong style="color:var(--blue)"><i class="fas fa-reply"></i> Réponse officielle :</strong><p style="margin-top:4px;font-size:.82rem">' + App.esc(r.admin_response) + '</p></div>' : '') +
      '<div class="det__actions">' +
      '<button class="vote-btn ' + (hasVoted ? 'voted' : '') + '" id="vb-' + r.id + '" onclick="Reports.toggleVote(\'' + r.id + '\')"><i class="fas fa-arrow-up"></i> <span id="vc-' + r.id + '">' + (r.upvotes || 0) + '</span> Soutenir</button>' +
      '<button class="btn btn--outline" onclick="MapManager.flyTo(' + r.latitude + ',' + r.longitude + ');UI.closeModal(\'modal-detail\')"><i class="fas fa-map"></i> Carte</button>' +
      '</div>' +
      '<div class="comments">' +
      '<div class="comments__title"><i class="fas fa-comments"></i> Commentaires (' + comments.length + ')</div>' +
      (App.currentUser
        ? '<div class="cmtform"><textarea id="ci-' + r.id + '" placeholder="Votre commentaire..." rows="2"></textarea><button class="btn btn--primary" onclick="Reports.addComment(\'' + r.id + '\')"><i class="fas fa-paper-plane"></i></button></div>'
        : '<p style="text-align:center;color:var(--text2);font-size:.78rem;margin-bottom:10px"><a href="#" onclick="event.preventDefault();UI.closeModal(\'modal-detail\');UI.openModal(\'modal-login\')">Connectez-vous</a> pour commenter</p>') +
      (cmtsHtml || '<p style="color:var(--text3);text-align:center;padding:12px;font-size:.78rem">Aucun commentaire</p>') +
      '</div></div>';

    UI.openModal('modal-detail');
  },

  async toggleVote(id) {
    if (!App.currentUser) {
      UI.toast('Connectez-vous', 'warning');
      UI.openModal('modal-login');
      return;
    }
    var btn = document.getElementById('vb-' + id);
    var cnt = document.getElementById('vc-' + id);
    if (!btn || !cnt) return;
    var isVoted = btn.classList.contains('voted');

    try {
      if (isVoted) {
        await App.supabase.from('votes').delete().eq('report_id', id).eq('user_id', App.currentUser.id);
        btn.classList.remove('voted');
        cnt.textContent = parseInt(cnt.textContent) - 1;
      } else {
        await App.supabase.from('votes').insert({ report_id: id, user_id: App.currentUser.id });
        btn.classList.add('voted');
        cnt.textContent = parseInt(cnt.textContent) + 1;
      }
      // Update local
      for (var i = 0; i < App.reports.length; i++) {
        if (App.reports[i].id === id) {
          App.reports[i].upvotes = parseInt(cnt.textContent);
          break;
        }
      }
    } catch (e) {
      UI.toast('Erreur de vote', 'error');
    }
  },

  async addComment(id) {
    if (!App.currentUser) return;
    var textarea = document.getElementById('ci-' + id);
    if (!textarea) return;
    var content = textarea.value.trim();
    if (content.length < 2) { UI.toast('Trop court', 'warning'); return; }
    try {
      await App.supabase.from('comments').insert({ report_id: id, user_id: App.currentUser.id, content: content });
      UI.toast('Commentaire ajouté', 'success');
      this.openDetail(id);
    } catch (e) {
      UI.toast('Erreur', 'error');
    }
  },

  async submitReport() {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    var btn = document.getElementById('btn-submit-report');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Envoi...';

    try {
      // Upload photos
      var imageUrls = [];
      if (ImageUpload.files.length > 0) {
        imageUrls = await ImageUpload.uploadAll();
      }

      var catInput = document.querySelector('input[name="category"]:checked');
      if (!catInput) throw new Error('Choisissez une catégorie');
      var category = catInput.value;

      var title = document.getElementById('report-title').value.trim();
      var description = document.getElementById('report-description').value.trim();
      var lat = parseFloat(document.getElementById('report-lat').value);
      var lng = parseFloat(document.getElementById('report-lng').value);
      var address = document.getElementById('report-address').value;
      var commune = document.getElementById('report-commune').value;

      var prioInput = document.querySelector('input[name="priority"]:checked');
      var priority = prioInput ? prioInput.value : 'medium';

      if (!title || title.length < 5) throw new Error('Titre trop court (min 5)');
      if (!description || description.length < 10) throw new Error('Description trop courte (min 10)');
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) throw new Error('Choisissez un lieu sur la carte');

      var result = await App.supabase.from('reports').insert({
        user_id: App.currentUser.id,
        category: category,
        title: title,
        description: description,
        latitude: lat,
        longitude: lng,
        address: address,
        commune: commune,
        images: imageUrls,
        priority: priority,
        status: 'pending'
      }).select().single();

      if (result.error) throw result.error;

      UI.closeModal('modal-report');
      UI.toast('Signalement envoyé ! Merci 🙌', 'success');
      this.resetForm();
      await this.loadAll();
      if (result.data) MapManager.flyTo(result.data.latitude, result.data.longitude);
    } catch (e) {
      console.error('Submit:', e);
      UI.toast(e.message || 'Erreur d\'envoi', 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer';
  },

  resetForm() {
    var form = document.getElementById('report-form');
    if (form) form.reset();
    ImageUpload.reset();

    // Reset steps
    document.querySelectorAll('.fstep').forEach(function(s) { s.classList.remove('active'); });
    var step1 = document.getElementById('step-1');
    if (step1) step1.classList.add('active');

    document.querySelectorAll('.steps__i').forEach(function(s) {
      s.classList.remove('active', 'done');
    });
    var firstStep = document.querySelector('.steps__i[data-step="1"]');
    if (firstStep) firstStep.classList.add('active');

    var s1btn = document.getElementById('btn-step1-next');
    if (s1btn) s1btn.disabled = true;
    var s2btn = document.getElementById('btn-step2-next');
    if (s2btn) s2btn.disabled = true;

    var locInfo = document.getElementById('location-info');
    if (locInfo) locInfo.style.display = 'none';

    var descCount = document.getElementById('desc-count');
    if (descCount) descCount.textContent = '0';

    // Remove minimap marker
    if (MapManager.miniMapMarker && MapManager.miniMap) {
      try { MapManager.miniMap.removeLayer(MapManager.miniMapMarker); } catch (e) { }
      MapManager.miniMapMarker = null;
    }
  },

  handleNew(r) {
    var found = false;
    for (var i = 0; i < App.reports.length; i++) {
      if (App.reports[i].id === r.id) { found = true; break; }
    }
    if (!found) {
      App.reports.unshift(r);
      MapManager.addReport(r);
      this.renderList();
      this.updateStats();
    }
  },

  handleUpdate(r) {
    for (var i = 0; i < App.reports.length; i++) {
      if (App.reports[i].id === r.id) {
        App.reports[i] = Object.assign({}, App.reports[i], r);
        break;
      }
    }
    MapManager.removeReport(r.id);
    MapManager.addReport(r);
    this.renderList();
    this.updateStats();
  },

  handleDelete(r) {
    App.reports = App.reports.filter(function(x) { return x.id !== r.id; });
    MapManager.removeReport(r.id);
    this.renderList();
    this.updateStats();
  }
};
