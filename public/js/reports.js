var Reports = {
  viewMode: 'list',

  loadAll: async function() {
    try {
      App.pagination.page = 0;
      App.pagination.hasMore = true;
      App.reports = [];
      await this._loadPage(0);
      MapManager.clear();
      for (var i = 0; i < App.reports.length; i++) MapManager.addReport(App.reports[i]);
      this.renderList();
      this.updateStats();
      this._loadAllForMap();
    } catch (e) {
      console.error('Load reports error:', e);
      if (typeof UI !== 'undefined') UI.toast('Erreur de chargement', 'error');
    }
  },

  _loadPage: async function(page) {
    var limit = App.pagination.limit;
    var from = page * limit;
    var to = from + limit - 1;
    var query = App.supabase.from('reports').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
    if (App.filters.category) query = query.eq('category', App.filters.category);
    if (App.filters.status) query = query.eq('status', App.filters.status);
    if (App.filters.commune) query = query.eq('commune', App.filters.commune);
    var result = await query;
    if (result.error) throw result.error;
    var newReports = result.data || [];
    if (page === 0) {
      App.reports = newReports;
    } else {
      App.reports = App.reports.concat(newReports);
    }
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
      if (typeof UI !== 'undefined') UI.toast('Erreur', 'error');
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-chevron-down"></i> Charger plus'; }
  },

  _loadAllForMap: async function() {
    try {
      var query = App.supabase.from('reports').select('id,category,title,latitude,longitude,address,commune,upvotes,status').order('created_at', { ascending: false });
      if (App.filters.category) query = query.eq('category', App.filters.category);
      if (App.filters.status) query = query.eq('status', App.filters.status);
      if (App.filters.commune) query = query.eq('commune', App.filters.commune);
      var result = await query;
      if (result.data) {
        MapManager.clear();
        for (var i = 0; i < result.data.length; i++) MapManager.addReport(result.data[i]);
      }
    } catch(e) {}
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
    if (sortVal === 'oldest') sorted.sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at); });
    else if (sortVal === 'most-voted') sorted.sort(function(a, b) { return (b.upvotes || 0) - (a.upvotes || 0); });
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
    if (countEl) countEl.textContent = (App.pagination.total || sorted.length);
    var isCards = this.viewMode === 'cards';
    grid.className = isCards ? 'grid--cards' : 'grid';
    var html = '';
    for (var i = 0; i < sorted.length; i++) {
      var r = sorted[i];
      var cat = App.categories[r.category] || App.categories.other;
      var status = App.statuses[r.status] || App.statuses.pending;
      var fa = MapManager.getFaForCat(r.category);
      var isAnon = !r.user_id;
      if (isCards) {
        var imgHtml = (r.images && r.images.length > 0)
          ? '<img class="card__img" src="' + r.images[0] + '" alt="" loading="lazy" onerror="this.onerror=null;this.parentNode.innerHTML=\'<div class=card__ph><i class=fas&#32;' + fa + '></i></div>\'">'
          : '<div class="card__ph"><i class="fas ' + fa + '"></i></div>';
        html += '<div class="card" onclick="Reports.openDetail(\'' + r.id + '\')">' + imgHtml +
          '<div class="card__body"><div class="card__row">' +
          '<span class="badge badge--cat"><i class="fas ' + fa + '"></i> ' + cat.label + '</span>' +
          '<span class="badge badge--' + r.status + '">' + status.label + '</span></div>' +
          '<div class="card__title">' + App.esc(r.title) + '</div>' +
          '<div class="card__addr"><i class="fas fa-map-pin"></i> ' + (r.address ? App.esc(r.address.substring(0, 45)) : r.commune || 'Guadeloupe') + '</div>' +
          (isAnon ? '<div style="font-size:.65rem;color:var(--text3);margin-top:2px"><i class="fas fa-user-secret"></i> Anonyme</div>' : '') +
          '<div class="card__foot"><span class="card__votes"><i class="fas fa-arrow-up"></i> ' + (r.upvotes || 0) + '</span>' +
          '<span class="card__date"><i class="fas fa-clock"></i> ' + App.ago(r.created_at) + '</span></div></div></div>';
      } else {
        html += '<div class="card" onclick="Reports.openDetail(\'' + r.id + '\')">' +
          '<div class="card__indicator card__indicator--' + r.status + '"></div>' +
          '<div class="card__body"><div class="card__row">' +
          '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">' +
          '<span class="badge badge--cat"><i class="fas ' + fa + '"></i> ' + cat.label + '</span>' +
          '<span class="card__title" style="margin:0">' + App.esc(r.title) + '</span>' +
          (isAnon ? '<span style="font-size:.6rem;color:var(--text3)" title="Anonyme"><i class="fas fa-user-secret"></i></span>' : '') +
          '</div>' +
          '<span class="badge badge--' + r.status + '">' + status.label + '</span></div>' +
          '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
          '<span class="card__addr"><i class="fas fa-map-pin"></i> ' + (r.commune || 'Guadeloupe') + '</span>' +
          '<span class="card__votes"><i class="fas fa-arrow-up"></i> ' + (r.upvotes || 0) + '</span>' +
          '<span class="card__date">' + App.ago(r.created_at) + '</span></div></div></div>';
      }
    }
    grid.innerHTML = html;
    var oldMore = document.getElementById('load-more-container');
    if (oldMore) oldMore.remove();
    if (App.pagination.hasMore) {
      var moreDiv = document.createElement('div');
      moreDiv.id = 'load-more-container';
      moreDiv.style.cssText = 'text-align:center;padding:20px';
      moreDiv.innerHTML = '<button class="btn btn--outline btn--lg" id="btn-load-more" onclick="Reports.loadMore()"><i class="fas fa-chevron-down"></i> Charger plus</button>' +
        '<p style="font-size:.72rem;color:var(--text3);margin-top:6px">' + App.reports.length + ' sur ' + (App.pagination.total || '?') + '</p>';
      grid.parentNode.appendChild(moreDiv);
    }
  },

  updateStats: function() {
    var total = App.pagination.total || App.reports.length, pending = 0, inProgress = 0, resolved = 0;
    for (var i = 0; i < App.reports.length; i++) {
      var s = App.reports[i].status;
      if (s === 'pending') pending++;
      else if (s === 'in_progress' || s === 'acknowledged') inProgress++;
      else if (s === 'resolved') resolved++;
    }
    var ids = { 'stat-total': total, 'stat-pending': pending, 'stat-progress': inProgress, 'stat-resolved': resolved, 'stats-total': total, 'stats-pending': pending, 'stats-in-progress': inProgress, 'stats-resolved': resolved };
    for (var id in ids) { var el = document.getElementById(id); if (el) el.textContent = ids[id]; }
    var barPending = document.getElementById('bar-pending');
    var barProgress = document.getElementById('bar-progress');
    var barResolved = document.getElementById('bar-resolved');
    if (total > 0) {
      if (barPending) barPending.style.width = Math.round((pending / total) * 100) + '%';
      if (barProgress) barProgress.style.width = Math.round((inProgress / total) * 100) + '%';
      if (barResolved) barResolved.style.width = Math.round((resolved / total) * 100) + '%';
    }
    this.renderCharts();
    this.renderLeaderboard();
    this.renderMairies();
  },

  renderCharts: function() {
    var catCounts = {}, comCounts = {};
    for (var i = 0; i < App.reports.length; i++) {
      var cat = App.reports[i].category; catCounts[cat] = (catCounts[cat] || 0) + 1;
      var com = App.reports[i].commune || 'Non défini'; comCounts[com] = (comCounts[com] || 0) + 1;
    }
    this._renderBarChart('chart-categories', catCounts, function(k) { return (App.categories[k] || App.categories.other).label; }, 'cat');
    this._renderBarChart('chart-communes', comCounts, function(k) { return k; }, 'com');
  },

  _renderBarChart: function(elId, counts, labelFn, type) {
    var el = document.getElementById(elId); if (!el) return;
    var sorted = Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; }).slice(0, 10);
    var max = sorted.length > 0 ? counts[sorted[0]] : 1;
    var fillClass = type === 'cat' ? 'bar__fill--cat' : 'bar__fill--com';
    var html = '';
    for (var i = 0; i < sorted.length; i++) {
      var k = sorted[i], pct = Math.round((counts[k] / max) * 100);
      html += '<div class="bar"><span class="bar__label">' + labelFn(k) + '</span><div class="bar__track"><div class="bar__fill ' + fillClass + '" style="width:' + pct + '%"><span class="bar__val">' + counts[k] + '</span></div></div></div>';
    }
    el.innerHTML = html || '<p style="color:var(--text3);font-size:.82rem;text-align:center;padding:20px">Pas encore de données</p>';
  },

  renderMairies: function() {
    var grid = document.getElementById('mairie-grid');
    if (!grid) return;
    var communeStats = {};
    for (var i = 0; i < App.reports.length; i++) {
      var r = App.reports[i], c = r.commune || 'Non défini';
      if (!communeStats[c]) communeStats[c] = { total: 0, resolved: 0, pending: 0, inProgress: 0 };
      communeStats[c].total++;
      if (r.status === 'resolved') communeStats[c].resolved++;
      else if (r.status === 'pending') communeStats[c].pending++;
      else communeStats[c].inProgress++;
    }
    var communes = Object.keys(communeStats).sort(function(a, b) { return communeStats[b].total - communeStats[a].total; });
    if (communes.length === 0) { grid.innerHTML = '<p style="color:var(--text3);font-size:.82rem">Aucune donnée</p>'; return; }
    var html = '', maxToShow = Math.min(communes.length, 12);
    for (var i = 0; i < maxToShow; i++) {
      var name = communes[i], s = communeStats[name];
      var rate = s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0;
      html += '<div class="mairie-card"><div class="mairie-card__name"><i class="fas fa-landmark"></i> ' + App.esc(name) + '</div>' +
        '<div class="mairie-card__stats"><span><i class="fas fa-flag" style="color:var(--blue)"></i> ' + s.total + '</span><span><i class="fas fa-clock" style="color:var(--orange)"></i> ' + s.pending + '</span><span><i class="fas fa-check" style="color:var(--green)"></i> ' + s.resolved + '</span></div>' +
        '<div class="mairie-card__bar"><div class="mairie-card__bar-fill" style="width:' + rate + '%"></div></div>' +
        '<div class="mairie-card__rate">' + rate + '% résolu</div></div>';
    }
    grid.innerHTML = html;
  },

  renderLeaderboard: async function() {
    var el = document.getElementById('leaderboard-list'); if (!el) return;
    try {
      var result = await App.supabase.from('profiles').select('id, username, reports_count, reputation').order('reputation', { ascending: false }).limit(10);
      if (!result.data || result.data.length === 0) { el.innerHTML = '<p style="color:var(--text3);font-size:.82rem;text-align:center;padding:20px">Pas encore de contributeurs</p>'; return; }
      var html = '';
      for (var i = 0; i < result.data.length; i++) {
        var u = result.data[i], initial = u.username ? u.username.charAt(0).toUpperCase() : '?';
        html += '<div class="lb" onclick="UI.openPublicProfile(\'' + u.id + '\')">' +
          '<span class="lb__rank">' + (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)) + '</span>' +
          '<div class="lb__av">' + initial + '</div>' +
          '<div class="lb__info"><div class="lb__name">' + App.esc(u.username || 'Anonyme') + '</div>' +
          '<div class="lb__sub">' + (u.reports_count || 0) + ' signalements</div></div>' +
          '<span class="lb__pts"><i class="fas fa-star"></i> ' + (u.reputation || 0) + '</span></div>';
      }
      el.innerHTML = html;
    } catch (e) { el.innerHTML = '<p style="color:var(--text3);font-size:.82rem">Erreur</p>'; }
  },

  openDetail: async function(id) {
    var report = App.reports.find(function(r) { return r.id === id; });
    if (!report) {
      try {
        var result = await App.supabase.from('reports').select('*').eq('id', id).single();
        if (result.data) report = result.data;
      } catch(e) {}
    }
    if (!report) return;
    var container = document.getElementById('report-detail');
    if (!container) return;
    var cat = App.categories[report.category] || App.categories.other;
    var status = App.statuses[report.status] || App.statuses.pending;
    var priority = App.priorities[report.priority] || App.priorities.medium;
    var fa = MapManager.getFaForCat(report.category);
    var galHtml;
    if (report.images && report.images.length > 0) {
      galHtml = '<div class="det__gal">';
      if (report.images.length === 1) {
        galHtml += '<img src="' + report.images[0] + '" alt="" onerror="this.onerror=null;this.style.display=\'none\'">';
      } else {
        galHtml += '<div style="display:flex;overflow-x:auto;gap:4px;scroll-snap-type:x mandatory">';
        for (var gi = 0; gi < report.images.length; gi++) {
          galHtml += '<img src="' + report.images[gi] + '" alt="" style="min-width:100%;height:300px;object-fit:cover;scroll-snap-align:start" onerror="this.onerror=null;this.style.display=\'none\'">';
        }
        galHtml += '</div>';
      }
      galHtml += '</div>';
    } else {
      galHtml = '<div class="det__gal det__gal--ph"><i class="fas ' + fa + '"></i></div>';
    }
    var isAnonymous = !report.user_id;
    var authorName = isAnonymous ? 'Anonyme' : 'Citoyen';
    var authorId = report.user_id;
    if (!isAnonymous && report.user_id) {
      try {
        var profileResult = await App.supabase.from('profiles').select('username').eq('id', report.user_id).single();
        if (profileResult.data) authorName = profileResult.data.username;
      } catch (e) {}
    }
    var hasVoted = false;
    if (App.currentUser) {
      try {
        var voteResult = await App.supabase.from('votes').select('id').eq('report_id', id).eq('user_id', App.currentUser.id).maybeSingle();
        if (voteResult.data) hasVoted = true;
      } catch (e) {}
    }
    var isOwner = App.currentUser && report.user_id === App.currentUser.id;
    var isAdmin = App.currentProfile && App.currentProfile.role === 'admin';
    var html = galHtml + '<div class="det__body">' +
      '<div class="det__badges"><span class="badge badge--cat"><i class="fas ' + fa + '"></i> ' + cat.label + '</span>' +
      '<span class="badge badge--' + report.status + '">' + status.label + '</span>' +
      '<span class="badge" style="background:' + priority.color + '18;color:' + priority.color + '">' + priority.label + '</span>' +
      (isAnonymous ? '<span class="badge" style="background:var(--bg4);color:var(--text3)"><i class="fas fa-user-secret"></i> Anonyme</span>' : '') +
      '</div>' +
      '<h2 class="det__title">' + App.esc(report.title) + '</h2>' +
      '<div class="det__meta">';
    if (isAnonymous) {
      html += '<span><i class="fas fa-user-secret"></i> Signalement anonyme</span>';
    } else {
      html += '<span style="cursor:pointer;text-decoration:underline dotted" onclick="UI.openPublicProfile(\'' + authorId + '\')"><i class="fas fa-user"></i> ' + App.esc(authorName) + '</span>';
    }
    html += '<span><i class="fas fa-map-pin"></i> ' + (report.commune || 'Guadeloupe') + '</span>' +
      '<span><i class="fas fa-clock"></i> ' + App.ago(report.created_at) + '</span></div>' +
      '<p class="det__desc">' + App.esc(report.description) + '</p>';
    if (report.admin_response) {
      html += '<div style="background:var(--blue-bg);border:1px solid rgba(88,166,255,.2);border-radius:var(--r);padding:14px;margin-bottom:20px">' +
        '<div style="font-size:.78rem;font-weight:700;color:var(--blue);margin-bottom:6px;display:flex;align-items:center;gap:6px"><i class="fas fa-shield-alt"></i> Réponse officielle</div>' +
        '<p style="font-size:.85rem;color:var(--text);line-height:1.7">' + App.esc(report.admin_response) + '</p></div>';
    }
    if (App.currentUser && (isOwner || isAdmin)) {
      html += '<div style="background:var(--bg3);border-radius:var(--r);padding:14px;margin-bottom:20px;border:1px solid var(--border)">' +
        '<div style="font-size:.78rem;font-weight:600;margin-bottom:8px;color:var(--text2)"><i class="fas fa-exchange-alt"></i> Mettre à jour le statut</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">';
      var statuses = ['pending', 'acknowledged', 'in_progress', 'resolved'];
      var statusLabels = { pending: 'En attente', acknowledged: 'Vu', in_progress: 'En cours', resolved: 'Résolu' };
      for (var i = 0; i < statuses.length; i++) {
        html += '<button class="btn btn--outline' + (report.status === statuses[i] ? ' btn--primary' : '') + '" onclick="Reports.changeStatus(\'' + id + '\',\'' + statuses[i] + '\')" style="font-size:.75rem">' + statusLabels[statuses[i]] + '</button>';
      }
      html += '</div></div>';
    }
    html += '<div class="det__actions">' +
      '<button class="vote-btn' + (hasVoted ? ' voted' : '') + '" onclick="Reports.toggleVote(\'' + id + '\')"><i class="fas fa-arrow-up"></i> <span>' + (report.upvotes || 0) + '</span> Soutenir</button>' +
      '<button class="btn btn--outline" onclick="Share.shareReport(\'' + id + '\')"><i class="fas fa-share-alt"></i> Partager</button>' +
      '<button class="btn btn--outline" onclick="UI.closeModal(\'modal-detail\');MapManager.flyTo(' + report.latitude + ',' + report.longitude + ')"><i class="fas fa-map"></i> Carte</button>';
    if (isOwner || isAdmin) html += '<button class="btn btn--danger" onclick="Reports.deleteFromDetail(\'' + id + '\')"><i class="fas fa-trash"></i> Supprimer</button>';
    html += '</div>';
    html += '<div class="comments"><div class="comments__title"><i class="fas fa-comments"></i> Commentaires</div>';
    if (App.currentUser) html += '<div class="cmtform"><textarea id="comment-input-' + id + '" placeholder="Votre commentaire..." rows="2"></textarea><button class="btn btn--primary" onclick="Reports.addComment(\'' + id + '\')"><i class="fas fa-paper-plane"></i></button></div>';
    html += '<div id="comments-list-' + id + '"></div></div></div>';
    container.innerHTML = html;
    UI.openModal('modal-detail');
    this.loadComments(id);
  },

  deleteFromDetail: async function(id) {
    var report = App.reports.find(function(r) { return r.id === id; });
    if (!report) return;
    var isOwner = App.currentUser && report.user_id === App.currentUser.id;
    var isAdmin = App.currentProfile && App.currentProfile.role === 'admin';
    if (!isOwner && !isAdmin) { UI.toast('Non autorisé', 'error'); return; }
    if (!confirm('Supprimer ce signalement ? Les points associés seront retirés.')) return;
    try {
      // Mark delete for cooldown
      if (isOwner) {
        await fetch('/api/mark-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: App.currentUser.id }) });
      }

      // Delete related data
      await App.supabase.from('comments').delete().eq('report_id', id);
      await App.supabase.from('votes').delete().eq('report_id', id);

      // Delete the report
      var result = await App.supabase.from('reports').delete().eq('id', id);
      if (result.error) { UI.toast('Erreur: ' + result.error.message, 'error'); return; }

      // REMOVE POINTS: -10 reputation and -1 reports_count for the owner
      if (isOwner && App.currentProfile) {
        var newRep = Math.max(0, (App.currentProfile.reputation || 0) - 10);
        var newCount = Math.max(0, (App.currentProfile.reports_count || 0) - 1);
        await App.supabase.from('profiles').update({
          reputation: newRep,
          reports_count: newCount
        }).eq('id', App.currentUser.id);
        App.currentProfile.reputation = newRep;
        App.currentProfile.reports_count = newCount;

        // Update UI display
        if (typeof Auth !== 'undefined') Auth.updateUI(true);
      }

      // If admin deletes someone else's report, also remove their points
      if (isAdmin && !isOwner && report.user_id) {
        try {
          var ownerProfile = await App.supabase.from('profiles').select('reputation, reports_count').eq('id', report.user_id).single();
          if (ownerProfile.data) {
            await App.supabase.from('profiles').update({
              reputation: Math.max(0, (ownerProfile.data.reputation || 0) - 10),
              reports_count: Math.max(0, (ownerProfile.data.reports_count || 0) - 1)
            }).eq('id', report.user_id);
          }
        } catch(e) { console.warn('Could not remove points from report owner:', e); }
      }

      UI.toast('Supprimé — points retirés', 'success');
      UI.closeModal('modal-detail');
      App.reports = App.reports.filter(function(r) { return r.id !== id; });
      MapManager.removeReport(id);
      this.renderList();
      this.updateStats();
    } catch (e) {
      console.error('Delete error:', e);
      UI.toast('Erreur', 'error');
    }
  },

  loadComments: async function(reportId) {
    var el = document.getElementById('comments-list-' + reportId);
    if (!el) return;
    try {
      var result = await App.supabase.from('comments').select('*, profiles(username)').eq('report_id', reportId).order('created_at', { ascending: true });
      if (!result.data || result.data.length === 0) { el.innerHTML = '<p style="color:var(--text3);font-size:.8rem;padding:10px">Aucun commentaire</p>'; return; }
      var html = '';
      for (var i = 0; i < result.data.length; i++) {
        var c = result.data[i], name = (c.profiles && c.profiles.username) || 'Anonyme';
        html += '<div class="cmt"><div class="cmt__av">' + name.charAt(0).toUpperCase() + '</div><div class="cmt__body"><div class="cmt__head"><span class="cmt__author" onclick="UI.openPublicProfile(\'' + c.user_id + '\')">' + App.esc(name) + '</span><span class="cmt__date">' + App.ago(c.created_at) + '</span></div><div class="cmt__text">' + App.esc(c.content) + '</div></div></div>';
      }
      el.innerHTML = html;
    } catch (e) { el.innerHTML = '<p style="color:var(--text3)">Erreur</p>'; }
  },

  changeStatus: async function(reportId, newStatus) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    var updates = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString();
    var result = await App.supabase.from('reports').update(updates).eq('id', reportId);
    if (result.error) { UI.toast('Erreur', 'error'); } else {
      UI.toast('Statut mis à jour', 'success');
      var report = App.reports.find(function(r) { return r.id === reportId; });
      if (report) report.status = newStatus;
      this.renderList(); this.updateStats(); this.openDetail(reportId);
    }
  },

  toggleVote: async function(id) {
    if (!App.currentUser) { UI.toast('Connectez-vous pour voter', 'warning'); return; }
    try {
      var existResult = await App.supabase.from('votes').select('id').eq('report_id', id).eq('user_id', App.currentUser.id).maybeSingle();
      if (existResult.data) {
        await App.supabase.from('votes').delete().eq('id', existResult.data.id);
        UI.toast('Vote retiré', 'info');
      } else {
        var ins = await App.supabase.from('votes').insert({ report_id: id, user_id: App.currentUser.id });
        if (ins.error) throw ins.error;
        UI.toast('Merci !', 'success');
        App.trackEvent('report_voted');
      }
      var allVotes = await App.supabase.from('votes').select('id').eq('report_id', id);
      var realCount = (allVotes.data && allVotes.data.length) || 0;
      await App.supabase.from('reports').update({ upvotes: realCount }).eq('id', id);
      var report = App.reports.find(function(r) { return r.id === id; });
      if (report) report.upvotes = realCount;
      this.openDetail(id);
    } catch (e) { UI.toast('Erreur', 'error'); }
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
      if (modData.flagged && modData.reformulated && modData.cleaned) { content = modData.cleaned.description; UI.toast('Commentaire reformulé', 'info'); }
      var result = await App.supabase.from('comments').insert({ report_id: reportId, user_id: App.currentUser.id, content: content });
      if (result.error) throw result.error;
      input.value = '';
      UI.toast('Commentaire ajouté', 'success');
      App.trackEvent('comment_added');
      this.loadComments(reportId);
    } catch (e) { UI.toast('Erreur', 'error'); }
  },

  submitReport: async function(anonymous) {
    var isAnonymous = anonymous === true || !App.currentUser;
    var category = document.querySelector('input[name="category"]:checked');
    var title = document.getElementById('report-title').value.trim();
    var description = document.getElementById('report-description').value.trim();
    var lat = parseFloat(document.getElementById('report-lat').value);
    var lng = parseFloat(document.getElementById('report-lng').value);
    var address = document.getElementById('report-address').value;
    var commune = document.getElementById('report-commune').value;
    var priority = document.querySelector('input[name="priority"]:checked');
    if (!category) { UI.toast('Choisissez une catégorie', 'warning'); return; }
    if (!title || title.length < 5) { UI.toast('Titre trop court (min 5)', 'warning'); return; }
    if (!description || description.length < 10) { UI.toast('Description trop courte (min 10)', 'warning'); return; }
    if (!lat || !lng) { UI.toast('Sélectionnez un emplacement', 'warning'); return; }
    if (!MapManager.isInGuadeloupe(lat, lng)) { UI.toast('Hors Guadeloupe', 'error'); return; }
    var btn = document.getElementById('btn-submit-report');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Envoi...';
    try {
      if (!isAnonymous) {
        var farmResp = await fetch('/api/check-farm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: App.currentUser.id }) });
        var farmData = await farmResp.json();
        if (!farmData.allowed) { UI.toast(farmData.reason || 'Limite', 'warning'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer'; return; }
      }
      var modResp = await fetch('/api/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title, description: description }) });
      var modData = await modResp.json();
      if (modData.flagged && modData.reformulated && modData.cleaned) { title = modData.cleaned.title; description = modData.cleaned.description; UI.toast('Contenu reformulé', 'info'); }
      var imageUrls = [];
      if (!isAnonymous && typeof ImageUpload !== 'undefined') {
        imageUrls = await ImageUpload.uploadAll();
      }
      var reportData = {
        category: category.value,
        title: title, description: description,
        latitude: lat, longitude: lng, address: address, commune: commune,
        images: imageUrls, priority: priority ? priority.value : 'medium',
        status: 'pending', upvotes: 0
      };
      if (isAnonymous) {
        var anonResp = await fetch('/api/report-anonymous', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reportData)
        });
        var anonData = await anonResp.json();
        if (anonData.error) throw new Error(anonData.error);
      } else {
        reportData.user_id = App.currentUser.id;
        var result = await App.supabase.from('reports').insert(reportData).select().single();
        if (result.error) throw result.error;
        if (App.currentProfile) {
          await App.supabase.from('profiles').update({
            reports_count: (App.currentProfile.reports_count || 0) + 1,
            reputation: (App.currentProfile.reputation || 0) + 10
          }).eq('id', App.currentUser.id);
          App.currentProfile.reports_count = (App.currentProfile.reports_count || 0) + 1;
          App.currentProfile.reputation = (App.currentProfile.reputation || 0) + 10;
        }
      }
      UI.closeModal('modal-report');
      UI.toast(isAnonymous ? 'Signalement anonyme envoyé ! 🎉' : 'Signalement créé ! +10 pts 🎉', 'success');
      App.trackEvent('report_created');
      if (typeof ImageUpload !== 'undefined') ImageUpload.reset();
      await this.loadAll();
    } catch (e) {
      console.error('Submit error:', e);
      UI.toast('Erreur: ' + (e.message || 'Échec'), 'error');
    }
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer';
  },

  handleNew: function(report) {
    if (!App.reports.find(function(r) { return r.id === report.id; })) {
      App.reports.unshift(report); MapManager.addReport(report); this.renderList(); this.updateStats();
    }
  },
  handleUpdate: function(report) {
    for (var i = 0; i < App.reports.length; i++) { if (App.reports[i].id === report.id) { App.reports[i] = report; break; } }
    MapManager.removeReport(report.id); MapManager.addReport(report); this.renderList(); this.updateStats();
  },
  handleDelete: function(report) {
    App.reports = App.reports.filter(function(r) { return r.id !== report.id; });
    MapManager.removeReport(report.id); this.renderList(); this.updateStats();
  }
};
