var Reports = {
  viewMode: 'list',

  loadAll: async function() {
    if (!App.supabase) return;
    try {
      App.pagination.page = 0;
      App.pagination.hasMore = true;
      App.reports = [];
      await this._loadPage(0);
      if (typeof MapManager !== 'undefined') {
        MapManager.clear();
        for (var i = 0; i < App.reports.length; i++) MapManager.addReport(App.reports[i]);
      }
      this.renderList();
      this.updateStats();
      this._loadAllForMap();
    } catch(e) {
      console.error('loadAll error:', e);
      if (typeof UI !== 'undefined') UI.toast('Erreur de chargement', 'error');
    }
  },

  applyFilters: function() {
    this.loadAll();
  },

  _loadPage: async function(page) {
    var limit = App.pagination.limit;
    var from = page * limit;
    var to = from + limit - 1;
    var query = App.supabase
      .from('reports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (App.filters.category) query = query.eq('category', App.filters.category);
    if (App.filters.status) query = query.eq('status', App.filters.status);
    if (App.filters.commune) query = query.eq('commune', App.filters.commune);
    var result = await query;
    if (result.error) throw result.error;
    var newReports = result.data || [];
    if (page === 0) App.reports = newReports;
    else App.reports = App.reports.concat(newReports);
    App.pagination.page = page;
    App.pagination.hasMore = newReports.length === limit;
    App.pagination.total = result.count || App.reports.length;
    App.pagination.loading = false;
  },

  loadMore: async function() {
    if (App.pagination.loading || !App.pagination.hasMore) return;
    App.pagination.loading = true;
    var btn = document.getElementById('btn-load-more');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Chargement...'; }
    try {
      await this._loadPage(App.pagination.page + 1);
      this.renderList();
    } catch(e) {
      if (typeof UI !== 'undefined') UI.toast('Erreur de chargement', 'error');
    }
    App.pagination.loading = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-chevron-down"></i> Charger plus'; }
  },

  _loadAllForMap: async function() {
    if (!App.supabase) return;
    try {
      var query = App.supabase
        .from('reports')
        .select('id,category,title,latitude,longitude,address,commune,upvotes,status')
        .order('created_at', { ascending: false });
      if (App.filters.category) query = query.eq('category', App.filters.category);
      if (App.filters.status) query = query.eq('status', App.filters.status);
      if (App.filters.commune) query = query.eq('commune', App.filters.commune);
      var result = await query;
      if (result.data && typeof MapManager !== 'undefined') {
        MapManager.clear();
        for (var i = 0; i < result.data.length; i++) MapManager.addReport(result.data[i]);
      }
    } catch(e) { console.warn('_loadAllForMap error:', e); }
  },

  renderList: function() {
    var grid = document.getElementById('reports-grid');
    var empty = document.getElementById('list-empty');
    var countEl = document.getElementById('list-count');
    var header = document.getElementById('list-header');
    if (!grid) return;

    var sorted = App.reports.slice();
    var sortEl = document.getElementById('sort-reports');
    var sortVal = sortEl ? sortEl.value : 'newest';
    if (sortVal === 'oldest') {
      sorted.sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at); });
    } else if (sortVal === 'most-voted') {
      sorted.sort(function(a, b) { return (b.upvotes || 0) - (a.upvotes || 0); });
    }

    if (sorted.length === 0) {
      grid.innerHTML = '';
      grid.className = 'grid';
      if (empty) empty.style.display = 'block';
      if (header) header.style.display = 'none';
      if (countEl) countEl.textContent = '0';
      var oldMore = document.getElementById('load-more-container');
      if (oldMore) oldMore.remove();
      return;
    }

    if (empty) empty.style.display = 'none';
    if (header) header.style.display = 'flex';
    if (countEl) countEl.textContent = App.pagination.total || sorted.length;

    var isCards = this.viewMode === 'cards';
    grid.className = isCards ? 'grid--cards' : 'grid';

    var html = '';
    for (var i = 0; i < sorted.length; i++) {
      html += this._renderCard(sorted[i], isCards);
    }
    grid.innerHTML = html;

    var oldMore = document.getElementById('load-more-container');
    if (oldMore) oldMore.remove();
    if (App.pagination.hasMore) {
      var moreDiv = document.createElement('div');
      moreDiv.id = 'load-more-container';
      moreDiv.style.cssText = 'text-align:center;padding:20px';
      moreDiv.innerHTML = '<button class="btn btn--outline btn--lg" id="btn-load-more" onclick="Reports.loadMore()"><i class="fas fa-chevron-down"></i> Charger plus</button>';
      grid.parentNode.appendChild(moreDiv);
    }
  },

  _renderCard: function(r, isCards) {
    var cat = App.categories[r.category] || App.categories.other;
    var status = App.statuses[r.status] || App.statuses.pending;
    var fa = (typeof MapManager !== 'undefined') ? MapManager.getFaForCat(r.category) : 'fa-map-pin';
    var isAnon = !r.user_id;
    var hasImg = r.images && r.images.length > 0;
    var id = r.id;

    if (isCards) {
      var imgHtml = hasImg
        ? '<img class="card__img" src="' + r.images[0] + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
        : '<div class="card__ph"><i class="fas ' + fa + '"></i></div>';
      return '<div class="card" onclick="Reports.openDetail(\'' + id + '\')">' +
        imgHtml +
        '<div class="card__body">' +
          '<div class="card__row">' +
            '<span class="badge badge--cat"><i class="fas ' + fa + '"></i> ' + App.esc(cat.label) + '</span>' +
            '<span class="badge badge--' + r.status + '">' + App.esc(status.label) + '</span>' +
          '</div>' +
          '<div class="card__title">' + App.esc(r.title) + '</div>' +
          '<div class="card__addr"><i class="fas fa-map-pin"></i> ' + App.esc(r.commune || 'Guadeloupe') + '</div>' +
          (isAnon ? '<div style="font-size:.65rem;color:var(--text3)"><i class="fas fa-user-secret"></i> Anonyme</div>' : '') +
          (!hasImg ? '<div style="font-size:.6rem;color:var(--orange2);margin-top:2px"><i class="fas fa-camera"></i> Pas de photo</div>' : '') +
          '<div class="card__foot">' +
            '<span class="card__votes"><i class="fas fa-arrow-up"></i> ' + (r.upvotes || 0) + '</span>' +
            '<span class="card__date">' + App.ago(r.created_at) + '</span>' +
          '</div>' +
        '</div></div>';
    } else {
      return '<div class="card" onclick="Reports.openDetail(\'' + id + '\')">' +
        '<div class="card__indicator card__indicator--' + r.status + '"></div>' +
        '<div class="card__body">' +
          '<div class="card__row">' +
            '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;flex-wrap:wrap">' +
              '<span class="badge badge--cat"><i class="fas ' + fa + '"></i> ' + App.esc(cat.label) + '</span>' +
              '<span class="card__title" style="margin:0;flex:1;min-width:0">' + App.esc(r.title) + '</span>' +
              (isAnon ? '<span style="font-size:.6rem;color:var(--text3)"><i class="fas fa-user-secret"></i></span>' : '') +
              (hasImg ? '<span style="font-size:.6rem;color:var(--green2)"><i class="fas fa-image"></i></span>' : '') +
            '</div>' +
            '<span class="badge badge--' + r.status + '">' + App.esc(status.label) + '</span>' +
          '</div>' +
          '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:4px">' +
            '<span class="card__addr"><i class="fas fa-map-pin"></i> ' + App.esc(r.commune || 'Guadeloupe') + '</span>' +
            '<span class="card__votes"><i class="fas fa-arrow-up"></i> ' + (r.upvotes || 0) + '</span>' +
            '<span class="card__date">' + App.ago(r.created_at) + '</span>' +
          '</div>' +
        '</div></div>';
    }
  },

  updateStats: async function() {
    var total = 0, pending = 0, inProgress = 0, resolved = 0;
    try {
      if (App.supabase) {
        var allResult = await App.supabase.from('reports').select('status');
        if (allResult.data) {
          total = allResult.data.length;
          for (var i = 0; i < allResult.data.length; i++) {
            var s = allResult.data[i].status;
            if (s === 'pending') pending++;
            else if (s === 'in_progress' || s === 'acknowledged') inProgress++;
            else if (s === 'resolved') resolved++;
          }
        }
      }
    } catch(e) {
      total = App.reports.length;
      for (var j = 0; j < App.reports.length; j++) {
        var st = App.reports[j].status;
        if (st === 'pending') pending++;
        else if (st === 'in_progress' || st === 'acknowledged') inProgress++;
        else if (st === 'resolved') resolved++;
      }
    }

    var els = {
      'stat-total': total, 'stat-pending': pending,
      'stat-progress': inProgress, 'stat-resolved': resolved,
      'stats-total': total, 'stats-pending': pending,
      'stats-in-progress': inProgress, 'stats-resolved': resolved
    };
    for (var id in els) {
      var el = document.getElementById(id);
      if (el) el.textContent = els[id];
    }

    if (total > 0) {
      var bp = document.getElementById('bar-pending');
      var bi = document.getElementById('bar-progress');
      var br = document.getElementById('bar-resolved');
      if (bp) bp.style.width = Math.round((pending / total) * 100) + '%';
      if (bi) bi.style.width = Math.round((inProgress / total) * 100) + '%';
      if (br) br.style.width = Math.round((resolved / total) * 100) + '%';
    }

    this.renderCharts();
    this.renderLeaderboard();
    this.renderMairies();
  },

  renderCharts: function() {
    var catCounts = {}, comCounts = {};
    for (var i = 0; i < App.reports.length; i++) {
      var r = App.reports[i];
      catCounts[r.category] = (catCounts[r.category] || 0) + 1;
      var com = r.commune || 'Non défini';
      comCounts[com] = (comCounts[com] || 0) + 1;
    }
    this._renderBar('chart-categories', catCounts, function(k) {
      return (App.categories[k] || App.categories.other).label;
    }, 'cat');
    this._renderBar('chart-communes', comCounts, function(k) { return k; }, 'com');
  },

  _renderBar: function(elId, counts, labelFn, type) {
    var el = document.getElementById(elId);
    if (!el) return;
    var sorted = Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; }).slice(0, 10);
    var max = sorted.length > 0 ? counts[sorted[0]] : 1;
    var cls = type === 'cat' ? 'bar__fill--cat' : 'bar__fill--com';
    if (!sorted.length) {
      el.innerHTML = '<p style="color:var(--text3);font-size:.8rem;text-align:center;padding:20px">Pas encore de données</p>';
      return;
    }
    var html = '';
    for (var i = 0; i < sorted.length; i++) {
      var k = sorted[i];
      var pct = Math.round((counts[k] / max) * 100);
      html += '<div class="bar">' +
        '<span class="bar__label">' + App.esc(labelFn(k)) + '</span>' +
        '<div class="bar__track">' +
          '<div class="bar__fill ' + cls + '" style="width:' + pct + '%">' +
            '<span class="bar__val">' + counts[k] + '</span>' +
          '</div>' +
        '</div></div>';
    }
    el.innerHTML = html;
  },

  renderMairies: function() {
    var grid = document.getElementById('mairie-grid');
    if (!grid) return;
    var cs = {};
    for (var i = 0; i < App.reports.length; i++) {
      var r = App.reports[i];
      var c = r.commune || 'Non défini';
      if (!cs[c]) cs[c] = { total: 0, resolved: 0, pending: 0 };
      cs[c].total++;
      if (r.status === 'resolved') cs[c].resolved++;
      else if (r.status === 'pending') cs[c].pending++;
    }
    var keys = Object.keys(cs).sort(function(a, b) { return cs[b].total - cs[a].total; });
    if (!keys.length) {
      grid.innerHTML = '<p style="color:var(--text3);font-size:.82rem">Aucune donnée</p>';
      return;
    }
    var html = '';
    for (var j = 0; j < Math.min(keys.length, 12); j++) {
      var n = keys[j], s = cs[n];
      var rate = s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0;
      html += '<div class="mairie-card">' +
        '<div class="mairie-card__name"><i class="fas fa-landmark"></i> ' + App.esc(n) + '</div>' +
        '<div class="mairie-card__stats">' +
          '<span><i class="fas fa-flag" style="color:var(--blue2)"></i> ' + s.total + '</span>' +
          '<span><i class="fas fa-clock" style="color:var(--orange2)"></i> ' + s.pending + '</span>' +
          '<span><i class="fas fa-check" style="color:var(--green2)"></i> ' + s.resolved + '</span>' +
        '</div>' +
        '<div class="mairie-card__bar"><div class="mairie-card__bar-fill" style="width:' + rate + '%"></div></div>' +
        '<div class="mairie-card__rate">' + rate + '% résolu</div>' +
      '</div>';
    }
    grid.innerHTML = html;
  },

  renderLeaderboard: async function() {
    var el = document.getElementById('leaderboard-list');
    if (!el || !App.supabase) return;
    try {
      var result = await App.supabase
        .from('profiles')
        .select('id,username,reports_count,reputation')
        .order('reputation', { ascending: false })
        .limit(10);
      if (!result.data || !result.data.length) {
        el.innerHTML = '<p style="color:var(--text3);font-size:.82rem;text-align:center;padding:20px">Pas encore de contributeurs</p>';
        return;
      }
      var html = '';
      for (var i = 0; i < result.data.length; i++) {
        var u = result.data[i];
        var rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
        html += '<div class="lb" onclick="UI.openPublicProfile(\'' + u.id + '\')">' +
          '<span class="lb__rank">' + rankIcon + '</span>' +
          '<div class="lb__av">' + (u.username ? u.username.charAt(0).toUpperCase() : '?') + '</div>' +
          '<div class="lb__info">' +
            '<div class="lb__name">' + App.esc(u.username || 'Anonyme') + '</div>' +
            '<div class="lb__sub">' + (u.reports_count || 0) + ' signalements</div>' +
          '</div>' +
          '<span class="lb__pts"><i class="fas fa-star"></i> ' + (u.reputation || 0) + '</span>' +
        '</div>';
      }
      el.innerHTML = html;
    } catch(e) { console.warn('leaderboard error:', e); }
  },

  openDetail: async function(id) {
    var report = App.reports.find(function(r) { return r.id === id; });
    if (!report && App.supabase) {
      try {
        var r = await App.supabase.from('reports').select('*').eq('id', id).single();
        if (r.data) report = r.data;
      } catch(e) {}
    }
    if (!report) return;

    var container = document.getElementById('report-detail');
    if (!container) return;

    var cat = App.categories[report.category] || App.categories.other;
    var status = App.statuses[report.status] || App.statuses.pending;
    var priority = App.priorities[report.priority] || App.priorities.medium;
    var fa = (typeof MapManager !== 'undefined') ? MapManager.getFaForCat(report.category) : 'fa-map-pin';
    var isAnon = !report.user_id;
    var isOwner = App.currentUser && report.user_id === App.currentUser.id;
    var isAdmin = App.isAdmin();

    var galHtml = '';
    if (report.images && report.images.length > 0) {
      galHtml = '<div class="det__gal">';
      if (report.images.length === 1) {
        galHtml += '<img src="' + report.images[0] + '" alt="" onerror="this.style.display=\'none\'">';
      } else {
        galHtml += '<div style="display:flex;overflow-x:auto;gap:4px;scroll-snap-type:x mandatory">';
        for (var gi = 0; gi < report.images.length; gi++) {
          galHtml += '<img src="' + report.images[gi] + '" alt="" style="min-width:100%;height:300px;object-fit:cover;scroll-snap-align:start" onerror="this.style.display=\'none\'">';
        }
        galHtml += '</div>';
      }
      galHtml += '</div>';
    } else {
      galHtml = '<div class="det__gal det__gal--ph"><i class="fas ' + fa + '"></i></div>';
    }

    var authorName = isAnon ? 'Anonyme' : 'Citoyen';
    if (!isAnon && report.user_id && App.supabase) {
      try {
        var pr = await App.supabase.from('profiles').select('username').eq('id', report.user_id).single();
        if (pr.data && pr.data.username) authorName = pr.data.username;
      } catch(e) {}
    }

    var hasVoted = false;
    if (App.currentUser && App.supabase) {
      try {
        var vr = await App.supabase.from('votes').select('id').eq('report_id', id).eq('user_id', App.currentUser.id).maybeSingle();
        if (vr.data) hasVoted = true;
      } catch(e) {}
    }

    var html = galHtml + '<div class="det__body">';
    html += '<div class="det__badges">' +
      '<span class="badge badge--cat"><i class="fas ' + fa + '"></i> ' + App.esc(cat.label) + '</span>' +
      '<span class="badge badge--' + report.status + '">' + App.esc(status.label) + '</span>' +
      '<span class="badge" style="background:' + priority.color + '18;color:' + priority.color + '">' + App.esc(priority.label) + '</span>' +
      (isAnon ? '<span class="badge" style="background:var(--bg4);color:var(--text3)"><i class="fas fa-user-secret"></i> Anonyme</span>' : '') +
    '</div>';
    html += '<h2 class="det__title">' + App.esc(report.title) + '</h2>';
    html += '<div class="det__meta">' +
      (isAnon
        ? '<span><i class="fas fa-user-secret"></i> Anonyme</span>'
        : '<span style="cursor:pointer;text-decoration:underline dotted" onclick="UI.openPublicProfile(\'' + report.user_id + '\')"><i class="fas fa-user"></i> ' + App.esc(authorName) + '</span>') +
      '<span><i class="fas fa-map-pin"></i> ' + App.esc(report.commune || 'Guadeloupe') + '</span>' +
      '<span><i class="fas fa-clock"></i> ' + App.ago(report.created_at) + '</span>' +
    '</div>';
    html += '<p class="det__desc">' + App.esc(report.description) + '</p>';

    if (report.admin_response) {
      html += '<div style="background:var(--blue-bg);border:1px solid rgba(59,130,246,.2);border-radius:var(--r);padding:14px;margin-bottom:20px">' +
        '<div style="font-size:.78rem;font-weight:700;color:var(--blue2);margin-bottom:6px"><i class="fas fa-shield-alt"></i> Réponse officielle</div>' +
        '<p style="font-size:.85rem;line-height:1.7">' + App.esc(report.admin_response) + '</p></div>';
    }

    if (App.currentUser && (isOwner || isAdmin)) {
      html += '<div style="background:var(--bg3);border-radius:var(--r);padding:12px;margin-bottom:16px;border:1px solid var(--border)">' +
        '<div style="font-size:.75rem;font-weight:700;margin-bottom:8px;color:var(--text2)"><i class="fas fa-exchange-alt"></i> Changer le statut</div>' +
        '<div style="display:flex;gap:5px;flex-wrap:wrap">';
      var statLabels = { pending: 'Attente', acknowledged: 'Vu', in_progress: 'En cours', resolved: 'Résolu' };
      var statKeys = ['pending', 'acknowledged', 'in_progress', 'resolved'];
      for (var si = 0; si < statKeys.length; si++) {
        var sk = statKeys[si];
        html += '<button class="btn btn--sm' + (report.status === sk ? ' btn--primary' : ' btn--outline') + '" onclick="Reports.changeStatus(\'' + id + '\',\'' + sk + '\')">' + statLabels[sk] + '</button>';
      }
      html += '</div></div>';
    }

    html += '<div class="det__actions">' +
      '<button class="vote-btn' + (hasVoted ? ' voted' : '') + '" onclick="Reports.toggleVote(\'' + id + '\')">' +
        '<i class="fas fa-arrow-up"></i> <span id="vote-count-' + id + '">' + (report.upvotes || 0) + '</span> Soutenir' +
      '</button>' +
      '<button class="btn btn--outline" onclick="if(typeof Share!==\'undefined\')Share.shareReport(\'' + id + '\')"><i class="fas fa-share-alt"></i> Partager</button>' +
      '<button class="btn btn--outline" onclick="UI.closeModal(\'modal-detail\');if(typeof MapManager!==\'undefined\')MapManager.flyTo(' + report.latitude + ',' + report.longitude + ')"><i class="fas fa-map"></i> Carte</button>';
    if (isOwner) {
      html += '<button class="btn btn--outline" onclick="Reports.startEdit(\'' + id + '\')"><i class="fas fa-pen"></i> Modifier</button>';
    }
    if (isOwner || isAdmin) {
      html += '<button class="btn btn--danger" onclick="Reports.deleteFromDetail(\'' + id + '\')"><i class="fas fa-trash"></i></button>';
    }
    html += '</div>';

    if (isOwner) {
      html += '<div id="edit-form-' + id + '" style="display:none;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:14px;margin-bottom:16px">' +
        '<h4 style="font-size:.85rem;margin-bottom:10px"><i class="fas fa-pen" style="color:var(--blue2)"></i> Modifier</h4>' +
        '<div class="field"><label>Titre</label><input type="text" class="inp" id="edit-title-' + id + '" value="' + App.esc(report.title) + '" maxlength="150"></div>' +
        '<div class="field"><label>Description</label><textarea class="inp" id="edit-desc-' + id + '" rows="4" maxlength="2000">' + App.esc(report.description) + '</textarea></div>' +
        '<div style="display:flex;gap:6px">' +
          '<button class="btn btn--primary" onclick="Reports.saveEdit(\'' + id + '\')"><i class="fas fa-save"></i> Sauvegarder</button>' +
          '<button class="btn btn--ghost" onclick="Reports.cancelEdit(\'' + id + '\')">Annuler</button>' +
        '</div></div>';
    }

    html += '<div class="comments">' +
      '<div class="comments__title"><i class="fas fa-comments"></i> Commentaires</div>';
    if (App.currentUser) {
      html += '<div class="cmtform">' +
        '<textarea id="comment-input-' + id + '" placeholder="Votre commentaire..." rows="2"></textarea>' +
        '<button class="btn btn--primary" onclick="Reports.addComment(\'' + id + '\')"><i class="fas fa-paper-plane"></i></button>' +
      '</div>';
    } else {
      html += '<p style="font-size:.78rem;color:var(--text3);margin-bottom:10px"><i class="fas fa-lock"></i> Connectez-vous pour commenter</p>';
    }
    html += '<div id="comments-list-' + id + '"></div></div></div>';

    container.innerHTML = html;
    UI.openModal('modal-detail');
    this.loadComments(id);
  },

  _editPhotos: [],

  startEdit: function(id) {
    this._editPhotos = [];
    var form = document.getElementById('edit-form-' + id);
    if (form) { form.style.display = 'block'; form.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  },

  cancelEdit: function(id) {
    this._editPhotos = [];
    var form = document.getElementById('edit-form-' + id);
    if (form) form.style.display = 'none';
  },

  saveEdit: async function(id) {
    var titleInput = document.getElementById('edit-title-' + id);
    var descInput = document.getElementById('edit-desc-' + id);
    if (!titleInput || !descInput) return;
    var title = titleInput.value.trim();
    var desc = descInput.value.trim();
    if (title.length < 5) { UI.toast('Titre trop court', 'warning'); return; }
    if (desc.length < 10) { UI.toast('Description trop courte', 'warning'); return; }
    try {
      var modResp = await fetch('/api/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title, description: desc }) });
      var modData = await modResp.json();
      if (modData.flagged && modData.cleaned) { title = modData.cleaned.title; desc = modData.cleaned.description; }
    } catch(e) {}
    var result = await App.supabase.from('reports').update({ title: title, description: desc, updated_at: new Date().toISOString() }).eq('id', id);
    if (result.error) { UI.toast('Erreur: ' + result.error.message, 'error'); return; }
    var report = App.reports.find(function(r) { return r.id === id; });
    if (report) { report.title = title; report.description = desc; }
    UI.toast('Modifié ✅', 'success');
    this.renderList();
    this.openDetail(id);
  },

  loadComments: async function(reportId) {
    var el = document.getElementById('comments-list-' + reportId);
    if (!el || !App.supabase) return;
    try {
      var result = await App.supabase
        .from('comments')
        .select('*, profiles(username)')
        .eq('report_id', reportId)
        .order('created_at', { ascending: true });
      if (!result.data || !result.data.length) {
        el.innerHTML = '<p style="color:var(--text3);font-size:.8rem;padding:8px">Aucun commentaire — soyez le premier !</p>';
        return;
      }
      var html = '';
      for (var i = 0; i < result.data.length; i++) {
        var c = result.data[i];
        var name = (c.profiles && c.profiles.username) || 'Anonyme';
        html += '<div class="cmt" id="cmt-' + c.id + '">' +
          '<div class="cmt__av">' + name.charAt(0).toUpperCase() + '</div>' +
          '<div class="cmt__body">' +
            '<div class="cmt__head">' +
              '<span class="cmt__author" onclick="UI.openPublicProfile(\'' + c.user_id + '\')">' + App.esc(name) + '</span>' +
              '<span class="cmt__date">' + App.ago(c.created_at) + '</span>' +
            '</div>' +
            '<div class="cmt__text">' + App.esc(c.content) + '</div>' +
            (App.currentUser ? '<button style="font-size:.62rem;color:var(--text3);background:none;border:none;cursor:pointer;margin-top:3px" onclick="Reports.showReplyBox(\'' + reportId + '\',\'' + c.id + '\',\'' + App.esc(name) + '\')"><i class="fas fa-reply"></i> Répondre</button>' : '') +
          '</div></div>' +
          '<div id="reply-box-' + c.id + '"></div>';
      }
      el.innerHTML = html;
    } catch(e) {
      el.innerHTML = '<p style="color:var(--text3)">Erreur de chargement</p>';
    }
  },

  showReplyBox: function(reportId, commentId, authorName) {
    var container = document.getElementById('reply-box-' + commentId);
    if (!container) return;
    if (container.innerHTML) { container.innerHTML = ''; return; }
    container.innerHTML = '<div class="cmtform" style="margin-left:36px;margin-bottom:8px">' +
      '<textarea id="reply-input-' + commentId + '" placeholder="Répondre à ' + authorName + '..." rows="2" style="font-size:.78rem"></textarea>' +
      '<button class="btn btn--primary btn--sm" onclick="Reports.submitReply(\'' + reportId + '\',\'' + commentId + '\',\'' + authorName + '\')"><i class="fas fa-reply"></i></button>' +
    '</div>';
    var input = document.getElementById('reply-input-' + commentId);
    if (input) input.focus();
  },

  submitReply: async function(reportId, parentCommentId, parentAuthor) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    var input = document.getElementById('reply-input-' + parentCommentId);
    if (!input) return;
    var content = ('@' + parentAuthor + ' ' + input.value.trim()).trim();
    if (content.length < 3) { UI.toast('Trop court', 'warning'); return; }
    try {
      var result = await App.supabase.from('comments').insert({ report_id: reportId, user_id: App.currentUser.id, content: content });
      if (result.error) throw result.error;
      UI.toast('Réponse ajoutée', 'success');
      this.loadComments(reportId);
    } catch(e) { UI.toast('Erreur', 'error'); }
  },

  addComment: async function(reportId) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    var input = document.getElementById('comment-input-' + reportId);
    if (!input) return;
    var content = input.value.trim();
    if (!content || content.length < 2) { UI.toast('Trop court', 'warning'); return; }
    if (content.length > 1000) { UI.toast('Trop long (max 1000)', 'warning'); return; }
    try {
      var modResp = await fetch('/api/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '', description: content }) });
      var modData = await modResp.json();
      if (modData.flagged && modData.cleaned) { content = modData.cleaned.description; }
    } catch(e) {}
    try {
      var result = await App.supabase.from('comments').insert({ report_id: reportId, user_id: App.currentUser.id, content: content });
      if (result.error) throw result.error;
      input.value = '';
      UI.toast('Commentaire ajouté', 'success');
      App.trackEvent('comment_added');
      try { fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId: reportId, type: 'comment', content: content }) }); } catch(e) {}
      this.loadComments(reportId);
    } catch(e) { UI.toast('Erreur', 'error'); }
  },

  changeStatus: async function(reportId, newStatus) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    var updates = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString();
    try {
      var result = await App.supabase.from('reports').update(updates).eq('id', reportId);
      if (result.error) throw result.error;
      var report = App.reports.find(function(r) { return r.id === reportId; });
      if (report) report.status = newStatus;
      UI.toast('Statut mis à jour', 'success');
      this.renderList();
      this.updateStats();
      this.openDetail(reportId);
    } catch(e) { UI.toast('Erreur', 'error'); }
  },

  toggleVote: async function(id) {
    if (!App.currentUser) { UI.toast('Connectez-vous pour voter', 'warning'); return; }
    try {
      var ex = await App.supabase.from('votes').select('id').eq('report_id', id).eq('user_id', App.currentUser.id).maybeSingle();
      if (ex.data) {
        await App.supabase.from('votes').delete().eq('id', ex.data.id);
        UI.toast('Vote retiré', 'info');
      } else {
        await App.supabase.from('votes').insert({ report_id: id, user_id: App.currentUser.id });
        UI.toast('Merci pour votre soutien !', 'success');
        App.trackEvent('report_voted');
      }
      var all = await App.supabase.from('votes').select('id', { count: 'exact' }).eq('report_id', id);
      var count = all.count || 0;
      await App.supabase.from('reports').update({ upvotes: count }).eq('id', id);
      var report = App.reports.find(function(r) { return r.id === id; });
      if (report) report.upvotes = count;
      var countEl = document.getElementById('vote-count-' + id);
      if (countEl) countEl.textContent = count;
      var voteBtn = document.querySelector('.vote-btn');
      if (voteBtn) voteBtn.classList.toggle('voted', !ex.data);
    } catch(e) { UI.toast('Erreur', 'error'); }
  },

  deleteFromDetail: async function(id) {
    if (!confirm('Supprimer ce signalement ? Les points seront retirés.')) return;
    var report = App.reports.find(function(r) { return r.id === id; });
    if (!report) return;
    var isOwner = App.currentUser && report.user_id === App.currentUser.id;
    var isAdmin = App.isAdmin();
    if (!isOwner && !isAdmin) { UI.toast('Non autorisé', 'error'); return; }
    try {
      await App.supabase.from('comments').delete().eq('report_id', id);
      await App.supabase.from('votes').delete().eq('report_id', id);
      await App.supabase.from('reports').delete().eq('id', id);
      if (report.user_id) {
        try {
          var op = await App.supabase.from('profiles').select('reputation,reports_count').eq('id', report.user_id).single();
          if (op.data) {
            await App.supabase.from('profiles').update({
              reputation: Math.max(0, (op.data.reputation || 0) - 10),
              reports_count: Math.max(0, (op.data.reports_count || 0) - 1)
            }).eq('id', report.user_id);
          }
          if (App.currentUser && report.user_id === App.currentUser.id && App.currentProfile) {
            App.currentProfile.reputation = Math.max(0, (App.currentProfile.reputation || 0) - 10);
            App.currentProfile.reports_count = Math.max(0, (App.currentProfile.reports_count || 0) - 1);
            if (typeof Auth !== 'undefined') Auth.updateUI(true);
          }
        } catch(e) {}
      }
      UI.toast('Signalement supprimé', 'success');
      UI.closeModal('modal-detail');
      App.reports = App.reports.filter(function(r) { return r.id !== id; });
      if (typeof MapManager !== 'undefined') MapManager.removeReport(id);
      this.renderList();
      this.updateStats();
    } catch(e) { UI.toast('Erreur lors de la suppression', 'error'); }
  },

  submitReport: async function(anonymous) {
    var isAnonymous = anonymous === true || !App.currentUser;
    var category = document.querySelector('input[name="category"]:checked');
    var titleEl = document.getElementById('report-title');
    var descEl = document.getElementById('report-description');
    var latEl = document.getElementById('report-lat');
    var lngEl = document.getElementById('report-lng');
    var addrEl = document.getElementById('report-address');
    var comEl = document.getElementById('report-commune');
    var priorityEl = document.querySelector('input[name="priority"]:checked');

    if (!category) { UI.toast('Choisissez une catégorie', 'warning'); UI._goStep(1); return; }
    var title = titleEl ? titleEl.value.trim() : '';
    var description = descEl ? descEl.value.trim() : '';
    var lat = latEl ? parseFloat(latEl.value) : NaN;
    var lng = lngEl ? parseFloat(lngEl.value) : NaN;
    var address = addrEl ? addrEl.value : '';
    var commune = comEl ? comEl.value : '';

    if (!title || title.length < 5) { UI.toast('Titre trop court (min 5 caractères)', 'warning'); UI._goStep(3); return; }
    if (!description || description.length < 10) { UI.toast('Description trop courte (min 10 caractères)', 'warning'); UI._goStep(3); return; }
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) { UI.toast('Sélectionnez un emplacement sur la carte', 'warning'); UI._goStep(2); return; }
    if (typeof MapManager !== 'undefined' && !MapManager.isInGuadeloupe(lat, lng)) { UI.toast('Emplacement hors Guadeloupe', 'error'); return; }

    var btn = document.getElementById('btn-submit-report');
    var anonBtn = document.getElementById('btn-submit-anon');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Envoi...'; }
    if (anonBtn) anonBtn.disabled = true;

    try {
      if (!isAnonymous && App.currentUser) {
        try {
          var fr = await fetch('/api/check-farm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: App.currentUser.id }) });
          var fd = await fr.json();
          if (!fd.allowed) { UI.toast(fd.reason || 'Limite atteinte', 'warning'); return; }
        } catch(e) {}
      }

      try {
        var mr = await fetch('/api/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title, description: description }) });
        var md = await mr.json();
        if (md.flagged && md.cleaned) { title = md.cleaned.title; description = md.cleaned.description; UI.toast('Contenu reformulé automatiquement', 'info'); }
      } catch(e) {}

      var imageUrls = [];
      if (typeof ImageUpload !== 'undefined') {
         try { imageUrls = await ImageUpload.uploadAll(); } catch(e) { console.warn('Upload error:', e); }
      }

      var reportData = {
        category: category.value,
        title: title,
        description: description,
        latitude: lat,
        longitude: lng,
        address: address,
        commune: commune,
        images: imageUrls,
        priority: priorityEl ? priorityEl.value : 'medium',
        status: 'pending',
        upvotes: 0
      };

      if (isAnonymous) {
        var ar = await fetch('/api/report-anonymous', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reportData) });
        var ad = await ar.json();
        if (ad.error) throw new Error(ad.error);
      } else {
        reportData.user_id = App.currentUser.id;
        var result = await App.supabase.from('reports').insert(reportData).select().single();
        if (result.error) throw result.error;
        if (App.currentProfile) {
          var newCount = (App.currentProfile.reports_count || 0) + 1;
          var newRep = (App.currentProfile.reputation || 0) + 10;
          await App.supabase.from('profiles').update({ reports_count: newCount, reputation: newRep }).eq('id', App.currentUser.id);
          App.currentProfile.reports_count = newCount;
          App.currentProfile.reputation = newRep;
          if (typeof Auth !== 'undefined') Auth.updateUI(true);
        }
      }

      UI.closeModal('modal-report');
      UI.toast(isAnonymous ? 'Signalement anonyme envoyé ! 🎉' : 'Signalement créé ! +10 pts 🎉', 'success');
      App.trackEvent('report_created', { category: category.value, anonymous: isAnonymous });
      if (typeof ImageUpload !== 'undefined') ImageUpload.reset();
      await this.loadAll();
    } catch(e) {
      console.error('submitReport error:', e);
      UI.toast('Erreur : ' + (e.message || 'Échec de l\'envoi'), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer'; }
      if (anonBtn) anonBtn.disabled = false;
    }
  },

  handleNew: function(r) {
    if (!App.reports.find(function(x) { return x.id === r.id; })) {
      App.reports.unshift(r);
      if (typeof MapManager !== 'undefined') MapManager.addReport(r);
      this.renderList();
      this.updateStats();
      UI.toast('Nouveau signalement reçu', 'info');
    }
  },

  handleUpdate: function(r) {
    for (var i = 0; i < App.reports.length; i++) {
      if (App.reports[i].id === r.id) { App.reports[i] = r; break; }
    }
    if (typeof MapManager !== 'undefined') { MapManager.removeReport(r.id); MapManager.addReport(r); }
    this.renderList();
    this.updateStats();
  },

  handleDelete: function(r) {
    App.reports = App.reports.filter(function(x) { return x.id !== r.id; });
    if (typeof MapManager !== 'undefined') MapManager.removeReport(r.id);
    this.renderList();
    this.updateStats();
  }
};
