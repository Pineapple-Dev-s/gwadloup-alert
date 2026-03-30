var Reports = {
  loadAll: async function() {
    try {
      var query = App.supabase.from('reports').select('*').order('created_at', { ascending: false });
      if (App.filters.category) query = query.eq('category', App.filters.category);
      if (App.filters.status) query = query.eq('status', App.filters.status);
      if (App.filters.commune) query = query.eq('commune', App.filters.commune);
      var { data, error } = await query;
      if (error) throw error;
      App.reports = data || [];
      MapManager.clear();
      for (var i = 0; i < App.reports.length; i++) MapManager.addReport(App.reports[i]);
      this.renderList();
      this.updateStats();
    } catch (e) {
      console.error('Load reports error:', e);
      UI.toast('Erreur de chargement', 'error');
    }
  },

  renderList: function() {
    var grid = document.getElementById('reports-grid');
    var empty = document.getElementById('list-empty');
    var count = document.getElementById('list-count');
    if (!grid) return;
    if (App.reports.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'block';
      if (count) count.textContent = '0 signalement';
      return;
    }
    if (empty) empty.style.display = 'none';
    if (count) count.textContent = App.reports.length + ' signalement' + (App.reports.length > 1 ? 's' : '');
    var html = '';
    for (var i = 0; i < App.reports.length; i++) {
      var r = App.reports[i];
      var cat = App.categories[r.category] || App.categories.other;
      var status = App.statuses[r.status] || App.statuses.pending;
      var fa = MapManager.getFaForCat(r.category);
      var imgHtml = (r.images && r.images.length > 0)
        ? '<img class="card__img" src="' + r.images[0] + '" alt="" loading="lazy">'
        : '<div class="card__ph"><i class="fas ' + fa + '"></i></div>';
      html += '<div class="card" onclick="Reports.openDetail(\'' + r.id + '\')">' + imgHtml +
        '<div class="card__body"><div class="card__row">' +
        '<span class="badge badge--cat"><i class="fas ' + fa + '"></i> ' + cat.label + '</span>' +
        '<span class="badge badge--' + r.status + '">' + status.label + '</span></div>' +
        '<div class="card__title">' + App.esc(r.title) + '</div>' +
        '<div class="card__addr"><i class="fas fa-map-pin"></i> ' + (r.address ? App.esc(r.address.substring(0, 40)) : r.commune || 'Guadeloupe') + '</div>' +
        '<div class="card__foot"><span class="card__votes"><i class="fas fa-arrow-up"></i> ' + (r.upvotes || 0) + '</span>' +
        '<span class="card__date">' + App.ago(r.created_at) + '</span></div></div></div>';
    }
    grid.innerHTML = html;
  },

  updateStats: function() {
    var total = App.reports.length, pending = 0, inProgress = 0, resolved = 0;
    for (var i = 0; i < App.reports.length; i++) {
      var s = App.reports[i].status;
      if (s === 'pending') pending++;
      else if (s === 'in_progress' || s === 'acknowledged') inProgress++;
      else if (s === 'resolved') resolved++;
    }
    var ids = { 'stat-total': total, 'stat-pending': pending, 'stat-progress': inProgress, 'stat-resolved': resolved,
      'stats-total': total, 'stats-pending': pending, 'stats-in-progress': inProgress, 'stats-resolved': resolved };
    for (var id in ids) { var el = document.getElementById(id); if (el) el.textContent = ids[id]; }
    this.renderCharts();
    this.renderLeaderboard();
  },

  renderCharts: function() {
    var catCounts = {}, comCounts = {};
    for (var i = 0; i < App.reports.length; i++) {
      var cat = App.reports[i].category; catCounts[cat] = (catCounts[cat] || 0) + 1;
      var com = App.reports[i].commune || 'Non défini'; comCounts[com] = (comCounts[com] || 0) + 1;
    }
    this._renderBarChart('chart-categories', catCounts, function(k) { return (App.categories[k] || App.categories.other).label; });
    this._renderBarChart('chart-communes', comCounts, function(k) { return k; });
  },

  _renderBarChart: function(elId, counts, labelFn) {
    var el = document.getElementById(elId); if (!el) return;
    var sorted = Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; }).slice(0, 8);
    var max = sorted.length > 0 ? counts[sorted[0]] : 1;
    var html = '';
    for (var i = 0; i < sorted.length; i++) {
      var k = sorted[i], pct = Math.round((counts[k] / max) * 100);
      html += '<div class="bar"><span class="bar__label">' + labelFn(k) + '</span><div class="bar__track"><div class="bar__fill" style="width:' + pct + '%"><span class="bar__val">' + counts[k] + '</span></div></div></div>';
    }
    el.innerHTML = html || '<p style="color:var(--text3);font-size:.8rem">Pas de données</p>';
  },

  renderLeaderboard: async function() {
    var el = document.getElementById('leaderboard-list'); if (!el) return;
    try {
      var { data } = await App.supabase.from('profiles').select('username, reports_count, reputation').order('reputation', { ascending: false }).limit(10);
      if (!data || data.length === 0) { el.innerHTML = '<p style="color:var(--text3);font-size:.8rem;text-align:center;padding:16px">Pas encore de contributeurs</p>'; return; }
      var html = '';
      for (var i = 0; i < data.length; i++) {
        var u = data[i], initial = u.username ? u.username.charAt(0).toUpperCase() : '?';
        html += '<div class="lb"><span class="lb__rank">' + (i + 1) + '</span><div class="lb__av">' + initial + '</div><div class="lb__info"><div class="lb__name">' + App.esc(u.username || 'Anonyme') + '</div><div class="lb__sub">' + (u.reports_count || 0) + ' signalements</div></div><span class="lb__pts">' + (u.reputation || 0) + ' pts</span></div>';
      }
      el.innerHTML = html;
    } catch (e) { el.innerHTML = '<p style="color:var(--text3);font-size:.8rem">Erreur</p>'; }
  },

  openDetail: async function(id) {
    var report = App.reports.find(function(r) { return r.id === id; }); if (!report) return;
    var container = document.getElementById('report-detail'); if (!container) return;
    var cat = App.categories[report.category] || App.categories.other;
    var status = App.statuses[report.status] || App.statuses.pending;
    var priority = App.priorities[report.priority] || App.priorities.medium;
    var fa = MapManager.getFaForCat(report.category);

    var galHtml = (report.images && report.images.length > 0)
      ? '<div class="det__gal"><img src="' + report.images[0] + '" alt=""></div>'
      : '<div class="det__gal det__gal--ph"><i class="fas ' + fa + '"></i></div>';

    var authorName = 'Citoyen';
    try { var { data: profile } = await App.supabase.from('profiles').select('username').eq('id', report.user_id).single(); if (profile) authorName = profile.username; } catch (e) {}

    var hasVoted = false;
    if (App.currentUser) { try { var { data: vote } = await App.supabase.from('votes').select('id').eq('report_id', id).eq('user_id', App.currentUser.id).single(); if (vote) hasVoted = true; } catch (e) {} }

    var isOwner = App.currentUser && report.user_id === App.currentUser.id;
    var isAdmin = App.currentProfile && App.currentProfile.role === 'admin';

    var authorHtml = '<span style="cursor:pointer;text-decoration:underline dotted" onclick="UI.openPublicProfile(\'' + report.user_id + '\')"><i class="fas fa-user"></i> ' + App.esc(authorName) + '</span>';

    var html = galHtml + '<div class="det__body">' +
      '<div class="det__badges"><span class="badge badge--cat"><i class="fas ' + fa + '"></i> ' + cat.label + '</span>' +
      '<span class="badge badge--' + report.status + '">' + status.label + '</span>' +
      '<span class="badge" style="background:' + priority.color + '22;color:' + priority.color + '">' + priority.label + '</span></div>' +
      '<h2 class="det__title">' + App.esc(report.title) + '</h2>' +
      '<div class="det__meta">' + authorHtml +
      '<span><i class="fas fa-map-pin"></i> ' + (report.commune || 'Guadeloupe') + '</span>' +
      '<span><i class="fas fa-clock"></i> ' + App.ago(report.created_at) + '</span></div>' +
      '<p class="det__desc">' + App.esc(report.description) + '</p>';

    if (report.admin_response) {
      html += '<div style="background:var(--blue-bg);border:1px solid rgba(88,166,255,.2);border-radius:var(--r);padding:12px;margin-bottom:16px">' +
        '<div style="font-size:.75rem;font-weight:700;color:var(--blue);margin-bottom:4px"><i class="fas fa-shield-alt"></i> Réponse officielle</div>' +
        '<p style="font-size:.82rem;color:var(--text)">' + App.esc(report.admin_response) + '</p></div>';
    }

    if (App.currentUser) {
      html += '<div style="background:var(--bg3);border-radius:var(--r);padding:12px;margin-bottom:16px">' +
        '<div style="font-size:.75rem;font-weight:600;margin-bottom:6px;color:var(--text2)"><i class="fas fa-exchange-alt"></i> Mettre à jour le statut</div>' +
        '<div style="display:flex;gap:4px;flex-wrap:wrap">';
      var statuses = ['pending', 'acknowledged', 'in_progress', 'resolved'];
      var statusLabels = { pending: 'En attente', acknowledged: 'Vu', in_progress: 'En cours', resolved: 'Résolu' };
      for (var i = 0; i < statuses.length; i++) {
        html += '<button class="btn btn--outline' + (report.status === statuses[i] ? ' btn--primary' : '') + '" onclick="Reports.changeStatus(\'' + id + '\',\'' + statuses[i] + '\')">' + statusLabels[statuses[i]] + '</button>';
      }
      html += '</div></div>';
    }

    html += '<div class="det__actions">' +
      '<button class="vote-btn' + (hasVoted ? ' voted' : '') + '" onclick="Reports.toggleVote(\'' + id + '\')"><i class="fas fa-arrow-up"></i> <span id="vote-count-' + id + '">' + (report.upvotes || 0) + '</span> Soutenir</button>' +
      '<button class="btn btn--outline" onclick="Share.report({id:\'' + id + '\',title:\'' + App.esc(report.title).replace(/'/g, "\\'") + '\',description:\'' + App.esc(report.description.substring(0, 100)).replace(/'/g, "\\'") + '\'})"><i class="fas fa-share-alt"></i> Partager</button>' +
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
    var report = App.reports.find(function(r) { return r.id === id; }); if (!report) return;
    var isOwner = App.currentUser && report.user_id === App.currentUser.id;
    var isAdmin = App.currentProfile && App.currentProfile.role === 'admin';
    if (!isOwner && !isAdmin) { UI.toast('Non autorisé', 'error'); return; }
    if (!confirm('Supprimer ce signalement ?')) return;
    try {
      // Mark deletion for anti-farm
      if (isOwner) {
        await fetch('/api/mark-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: App.currentUser.id }) });
      }
      await App.supabase.from('comments').delete().eq('report_id', id);
      await App.supabase.from('votes').delete().eq('report_id', id);
      var { error } = await App.supabase.from('reports').delete().eq('id', id);
      if (error) { UI.toast('Erreur: ' + error.message, 'error'); return; }
      UI.toast('Supprimé', 'success');
      UI.closeModal('modal-detail');
      App.reports = App.reports.filter(function(r) { return r.id !== id; });
      MapManager.removeReport(id);
      this.renderList(); this.updateStats();
      // NO points refund - anti-farm measure
    } catch (e) { UI.toast('Erreur', 'error'); }
  },

  loadComments: async function(reportId) {
    var el = document.getElementById('comments-list-' + reportId); if (!el) return;
    try {
      var { data: comments } = await App.supabase.from('comments').select('*, profiles(username)').eq('report_id', reportId).order('created_at', { ascending: true });
      if (!comments || comments.length === 0) { el.innerHTML = '<p style="color:var(--text3);font-size:.78rem;padding:8px">Aucun commentaire</p>'; return; }
      var html = '';
      for (var i = 0; i < comments.length; i++) {
        var c = comments[i], name = (c.profiles && c.profiles.username) || 'Anonyme';
        html += '<div class="cmt"><div class="cmt__av">' + name.charAt(0).toUpperCase() + '</div><div class="cmt__body"><div class="cmt__head"><span class="cmt__author">' + App.esc(name) + '</span><span class="cmt__date">' + App.ago(c.created_at) + '</span></div><div class="cmt__text">' + App.esc(c.content) + '</div></div></div>';
      }
      el.innerHTML = html;
    } catch (e) { el.innerHTML = '<p style="color:var(--text3)">Erreur</p>'; }
  },

  changeStatus: async function(reportId, newStatus) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    var updates = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString();
    var { error } = await App.supabase.from('reports').update(updates).eq('id', reportId);
    if (error) { UI.toast('Erreur', 'error'); } else {
      UI.toast('Statut mis à jour', 'success');
      var report = App.reports.find(function(r) { return r.id === reportId; });
      if (report) { report.status = newStatus; if (newStatus === 'resolved') report.resolved_at = updates.resolved_at; }
      this.renderList(); this.updateStats(); this.openDetail(reportId);
    }
  },

  toggleVote: async function(id) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    try {
      var { data: existing } = await App.supabase.from('votes').select('id').eq('report_id', id).eq('user_id', App.currentUser.id).single();
      var report = App.reports.find(function(r) { return r.id === id; });
      if (existing) {
        await App.supabase.from('votes').delete().eq('id', existing.id);
        await App.supabase.from('reports').update({ upvotes: Math.max(0, (report.upvotes || 1) - 1) }).eq('id', id);
        UI.toast('Vote retiré', 'info');
      } else {
        await App.supabase.from('votes').insert({ report_id: id, user_id: App.currentUser.id });
        await App.supabase.from('reports').update({ upvotes: (report.upvotes || 0) + 1 }).eq('id', id);
        UI.toast('Merci !', 'success');
      }
      await this.loadAll(); this.openDetail(id);
    } catch (e) { UI.toast('Erreur', 'error'); }
  },

  addComment: async function(reportId) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    var input = document.getElementById('comment-input-' + reportId); if (!input) return;
    var content = input.value.trim();
    if (!content || content.length < 2) { UI.toast('Trop court', 'warning'); return; }
    if (content.length > 1000) { UI.toast('Trop long (max 1000)', 'warning'); return; }
    try {
      // Always moderate comments
      var modResp = await fetch('/api/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '', description: content }) });
      var modData = await modResp.json();
      if (modData.flagged && modData.reformulated && modData.cleaned) {
        content = modData.cleaned.description;
        UI.toast('Commentaire reformulé automatiquement', 'info');
      }
      var { error } = await App.supabase.from('comments').insert({ report_id: reportId, user_id: App.currentUser.id, content: content });
      if (error) throw error;
      input.value = ''; UI.toast('Commentaire ajouté', 'success'); this.loadComments(reportId);
    } catch (e) { UI.toast('Erreur', 'error'); }
  },

  submitReport: async function() {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }

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
    if (!MapManager.isInGuadeloupe(lat, lng)) { UI.toast('Emplacement hors Guadeloupe', 'error'); return; }

    var btn = document.getElementById('btn-submit-report');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Envoi...';

    try {
      // Anti-farm check
      var farmResp = await fetch('/api/check-farm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: App.currentUser.id }) });
      var farmData = await farmResp.json();
      if (!farmData.allowed) {
        UI.toast(farmData.reason || 'Limite atteinte', 'warning');
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer';
        return;
      }

      // ALWAYS moderate - Groq will reformulate if needed, NEVER blocks
      var modResp = await fetch('/api/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title, description: description }) });
      var modData = await modResp.json();
      if (modData.flagged && modData.reformulated && modData.cleaned) {
        title = modData.cleaned.title;
        description = modData.cleaned.description;
        UI.toast('Contenu reformulé automatiquement', 'info');
      }

      var imageUrls = await ImageUpload.uploadAll();

      var { data, error } = await App.supabase.from('reports').insert({
        user_id: App.currentUser.id, category: category.value,
        title: title, description: description,
        latitude: lat, longitude: lng, address: address, commune: commune,
        images: imageUrls, priority: priority ? priority.value : 'medium',
        status: 'pending', upvotes: 0
      }).select().single();
      if (error) throw error;

      if (App.currentProfile) {
        await App.supabase.from('profiles').update({
          reports_count: (App.currentProfile.reports_count || 0) + 1,
          reputation: (App.currentProfile.reputation || 0) + 10
        }).eq('id', App.currentUser.id);
        App.currentProfile.reports_count = (App.currentProfile.reports_count || 0) + 1;
        App.currentProfile.reputation = (App.currentProfile.reputation || 0) + 10;
      }

      UI.closeModal('modal-report');
      UI.toast('Signalement créé !', 'success');
      ImageUpload.reset();
      await this.loadAll();
      if (data) MapManager.flyTo(data.latitude, data.longitude);
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
