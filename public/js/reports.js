var Reports = {
  async loadAll() {
    try {
      var query = App.supabase.from('reports').select('*').order('created_at', { ascending: false });

      if (App.filters.category) query = query.eq('category', App.filters.category);
      if (App.filters.status) query = query.eq('status', App.filters.status);
      if (App.filters.commune) query = query.eq('commune', App.filters.commune);

      var { data, error } = await query;
      if (error) throw error;

      App.reports = data || [];
      MapManager.clear();
      App.reports.forEach(function(r) { MapManager.addReport(r); });
      this.renderList();
      this.updateStats();
    } catch (e) {
      console.error('Load reports error:', e);
      UI.toast('Erreur de chargement des signalements', 'error');
    }
  },

  renderList() {
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
    App.reports.forEach(function(r) {
      var c = App.categories[r.category] || App.categories.other;
      var s = App.statuses[r.status] || App.statuses.pending;
      var fa = Reports.getCatFa(r.category);
      var hasImg = r.images && r.images.length > 0;

      html += '<div class="card" onclick="Reports.openDetail(\'' + r.id + '\')">';
      if (hasImg) {
        html += '<img class="card__img" src="' + r.images[0] + '" alt="' + App.esc(r.title) + '" loading="lazy" onerror="this.style.display=\'none\'">';
      } else {
        html += '<div class="card__ph"><i class="fas ' + fa + '"></i></div>';
      }
      html += '<div class="card__body">' +
        '<div class="card__row">' +
          '<span class="badge badge--cat"><i class="fas ' + fa + '"></i> ' + c.label + '</span>' +
          '<span class="badge badge--' + r.status + '">' + s.icon + ' ' + s.label + '</span>' +
        '</div>' +
        '<div class="card__title">' + App.esc(r.title) + '</div>' +
        '<div class="card__addr"><i class="fas fa-map-pin"></i> ' + (r.commune || r.address || 'Guadeloupe') + '</div>' +
        '<div class="card__foot">' +
          '<span class="card__votes"><i class="fas fa-arrow-up"></i> ' + (r.upvotes || 0) + ' soutiens</span>' +
          '<span class="card__date">' + App.ago(r.created_at) + '</span>' +
        '</div>' +
      '</div></div>';
    });

    grid.innerHTML = html;
  },

  getCatFa(cat) {
    var c = App.categories[cat] || App.categories.other;
    return (UI && UI.catIcons && UI.catIcons[c.icon]) || 'fa-map-pin';
  },

  updateStats() {
    var total = App.reports.length;
    var pending = App.reports.filter(function(r) { return r.status === 'pending'; }).length;
    var progress = App.reports.filter(function(r) { return r.status === 'in_progress' || r.status === 'acknowledged'; }).length;
    var resolved = App.reports.filter(function(r) { return r.status === 'resolved'; }).length;

    // Topbar stats
    var st = document.getElementById('stat-total'); if (st) st.textContent = total;
    var sp = document.getElementById('stat-pending'); if (sp) sp.textContent = pending;
    var si = document.getElementById('stat-progress'); if (si) si.textContent = progress;
    var sr = document.getElementById('stat-resolved'); if (sr) sr.textContent = resolved;

    // Stats page
    var sst = document.getElementById('stats-total'); if (sst) sst.textContent = total;
    var ssp = document.getElementById('stats-pending'); if (ssp) ssp.textContent = pending;
    var ssi = document.getElementById('stats-in-progress'); if (ssi) ssi.textContent = progress;
    var ssr = document.getElementById('stats-resolved'); if (ssr) ssr.textContent = resolved;

    this.renderCharts();
    this.renderLeaderboard();
  },

  renderCharts() {
    // Categories chart
    var catCounts = {};
    App.reports.forEach(function(r) {
      var label = (App.categories[r.category] || App.categories.other).label;
      catCounts[label] = (catCounts[label] || 0) + 1;
    });

    var catSorted = Object.entries(catCounts).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 8);
    var catMax = catSorted.length > 0 ? catSorted[0][1] : 1;
    var catEl = document.getElementById('chart-categories');
    if (catEl) {
      var html = '';
      catSorted.forEach(function(item) {
        var pct = Math.round((item[1] / catMax) * 100);
        html += '<div class="bar"><span class="bar__label">' + item[0] + '</span>' +
          '<div class="bar__track"><div class="bar__fill" style="width:' + pct + '%"><span class="bar__val">' + item[1] + '</span></div></div></div>';
      });
      catEl.innerHTML = html || '<p style="color:var(--text3);font-size:.8rem">Aucune donnée</p>';
    }

    // Communes chart
    var comCounts = {};
    App.reports.forEach(function(r) {
      var com = r.commune || 'Non précisé';
      comCounts[com] = (comCounts[com] || 0) + 1;
    });

    var comSorted = Object.entries(comCounts).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 8);
    var comMax = comSorted.length > 0 ? comSorted[0][1] : 1;
    var comEl = document.getElementById('chart-communes');
    if (comEl) {
      var html = '';
      comSorted.forEach(function(item) {
        var pct = Math.round((item[1] / comMax) * 100);
        html += '<div class="bar"><span class="bar__label">' + item[0] + '</span>' +
          '<div class="bar__track"><div class="bar__fill" style="width:' + pct + '%"><span class="bar__val">' + item[1] + '</span></div></div></div>';
      });
      comEl.innerHTML = html || '<p style="color:var(--text3);font-size:.8rem">Aucune donnée</p>';
    }
  },

  async renderLeaderboard() {
    var el = document.getElementById('leaderboard-list');
    if (!el) return;

    try {
      var { data } = await App.supabase.from('profiles').select('username, reports_count, reputation')
        .order('reputation', { ascending: false }).limit(10);

      if (!data || data.length === 0) {
        el.innerHTML = '<p style="color:var(--text3);font-size:.8rem;padding:8px">Aucun contributeur</p>';
        return;
      }

      var html = '';
      data.forEach(function(u, i) {
        var initial = (u.username || '?').charAt(0).toUpperCase();
        html += '<div class="lb">' +
          '<span class="lb__rank">' + (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)) + '</span>' +
          '<div class="lb__av">' + initial + '</div>' +
          '<div class="lb__info"><div class="lb__name">' + App.esc(u.username || 'Anonyme') + '</div>' +
          '<div class="lb__sub">' + (u.reports_count || 0) + ' signalements</div></div>' +
          '<span class="lb__pts">' + (u.reputation || 0) + ' pts</span>' +
        '</div>';
      });
      el.innerHTML = html;
    } catch (e) {
      el.innerHTML = '<p style="color:var(--text3);font-size:.8rem;padding:8px">Erreur de chargement</p>';
    }
  },

  async openDetail(id) {
    var el = document.getElementById('report-detail');
    if (!el) return;

    var report = App.reports.find(function(r) { return r.id === id; });
    if (!report) {
      // Try fetching from DB
      try {
        var { data } = await App.supabase.from('reports').select('*').eq('id', id).single();
        if (data) report = data;
      } catch (e) {}
    }
    if (!report) { UI.toast('Signalement introuvable', 'error'); return; }

    var c = App.categories[report.category] || App.categories.other;
    var s = App.statuses[report.status] || App.statuses.pending;
    var p = App.priorities[report.priority] || App.priorities.medium;
    var fa = this.getCatFa(report.category);

    // Get author
    var authorName = 'Citoyen';
    try {
      var { data: profile } = await App.supabase.from('profiles').select('username').eq('id', report.user_id).single();
      if (profile) authorName = profile.username;
    } catch (e) {}

    // Check if user voted
    var hasVoted = false;
    if (App.currentUser) {
      try {
        var { data: vote } = await App.supabase.from('votes').select('id')
          .eq('report_id', id).eq('user_id', App.currentUser.id).single();
        if (vote) hasVoted = true;
      } catch (e) {}
    }

    // Gallery
    var gallery = '';
    if (report.images && report.images.length > 0) {
      gallery = '<div class="det__gal"><img src="' + report.images[0] + '" alt="' + App.esc(report.title) + '" onerror="this.parentElement.innerHTML=\'<div class=det__gal--ph>📷</div>\'"></div>';
      if (report.images.length > 1) {
        gallery += '<div style="display:flex;gap:4px;padding:4px">';
        report.images.forEach(function(img, i) {
          gallery += '<img src="' + img + '" style="width:60px;height:60px;object-fit:cover;border-radius:4px;cursor:pointer;border:1px solid var(--border)" onclick="document.querySelector(\'.det__gal img\').src=\'' + img + '\'" onerror="this.style.display=\'none\'">';
        });
        gallery += '</div>';
      }
    } else {
      gallery = '<div class="det__gal--ph"><i class="fas ' + fa + '" style="font-size:3rem;color:var(--text3)"></i></div>';
    }

    // Status change section (for all users)
    var statusChangeHtml = '';
    if (App.currentUser) {
      statusChangeHtml = '<div style="margin-top:12px;padding:12px;background:var(--bg3);border-radius:var(--r)">' +
        '<div style="font-size:.78rem;font-weight:600;margin-bottom:6px"><i class="fas fa-sync-alt"></i> Proposer un changement de statut</div>' +
        '<div style="display:flex;gap:4px;flex-wrap:wrap">' +
          '<button class="btn btn--ghost" onclick="Reports.proposeStatus(\'' + id + '\',\'acknowledged\')" style="font-size:.7rem">👁️ Pris en compte</button>' +
          '<button class="btn btn--ghost" onclick="Reports.proposeStatus(\'' + id + '\',\'in_progress\')" style="font-size:.7rem">🔧 En cours</button>' +
          '<button class="btn btn--ghost" onclick="Reports.proposeStatus(\'' + id + '\',\'resolved\')" style="font-size:.7rem">✅ Résolu</button>' +
        '</div>' +
      '</div>';
    }

    var html = gallery +
      '<div class="det__body">' +
        '<div class="det__badges">' +
          '<span class="badge badge--cat"><i class="fas ' + fa + '"></i> ' + c.label + '</span>' +
          '<span class="badge badge--' + report.status + '">' + s.icon + ' ' + s.label + '</span>' +
          '<span class="badge" style="background:' + p.color + '22;color:' + p.color + '">' + p.label + '</span>' +
        '</div>' +
        '<h2 class="det__title">' + App.esc(report.title) + '</h2>' +
        '<div class="det__meta">' +
          '<span><i class="fas fa-user"></i> ' + App.esc(authorName) + '</span>' +
          '<span><i class="fas fa-clock"></i> ' + App.ago(report.created_at) + '</span>' +
          '<span><i class="fas fa-map-pin"></i> ' + App.esc(report.commune || report.address || 'Guadeloupe') + '</span>' +
          '<span><i class="fas fa-eye"></i> ' + (report.views || 0) + ' vues</span>' +
        '</div>' +
        '<div class="det__desc">' + App.esc(report.description) + '</div>' +
        (report.admin_response ? '<div style="background:var(--purple-bg);border:1px solid rgba(188,140,255,.2);border-radius:var(--r);padding:10px;margin-bottom:12px"><div style="font-size:.75rem;font-weight:600;color:var(--purple);margin-bottom:4px"><i class="fas fa-shield-alt"></i> Réponse officielle</div><div style="font-size:.82rem">' + App.esc(report.admin_response) + '</div></div>' : '') +
        '<div class="det__actions">' +
          '<button class="vote-btn' + (hasVoted ? ' voted' : '') + '" onclick="Reports.toggleVote(\'' + id + '\')">' +
            '<i class="fas fa-arrow-up"></i> <span id="vote-count-' + id + '">' + (report.upvotes || 0) + '</span> soutiens' +
          '</button>' +
          '<button class="btn btn--ghost" onclick="MapManager.flyTo(' + report.latitude + ',' + report.longitude + ');UI.closeModal(\'modal-detail\')"><i class="fas fa-map"></i> Voir sur la carte</button>' +
        '</div>' +
        statusChangeHtml +
        '<div class="comments">' +
          '<div class="comments__title"><i class="fas fa-comments"></i> Commentaires</div>' +
          (App.currentUser ?
            '<div class="cmtform">' +
              '<textarea placeholder="Ajouter un commentaire..." id="comment-text-' + id + '"></textarea>' +
              '<button class="btn btn--primary" onclick="Reports.addComment(\'' + id + '\')"><i class="fas fa-paper-plane"></i></button>' +
            '</div>' : '<p style="font-size:.78rem;color:var(--text2);margin-bottom:8px">Connectez-vous pour commenter</p>') +
          '<div id="comments-list-' + id + '"><p style="font-size:.75rem;color:var(--text3)">Chargement...</p></div>' +
        '</div>' +
      '</div>';

    el.innerHTML = html;
    UI.openModal('modal-detail');

    // Load comments
    this.loadComments(id);

    // Increment views
    App.supabase.rpc('increment_views', { report_id: id }).catch(function() {});
  },

  async loadComments(reportId) {
    var el = document.getElementById('comments-list-' + reportId);
    if (!el) return;

    try {
      var { data } = await App.supabase.from('comments').select('*, profiles(username)')
        .eq('report_id', reportId).order('created_at', { ascending: true });

      if (!data || data.length === 0) {
        el.innerHTML = '<p style="font-size:.75rem;color:var(--text3)">Aucun commentaire</p>';
        return;
      }

      var html = '';
      data.forEach(function(cmt) {
        var name = (cmt.profiles && cmt.profiles.username) || 'Anonyme';
        var initial = name.charAt(0).toUpperCase();
        html += '<div class="cmt">' +
          '<div class="cmt__av">' + initial + '</div>' +
          '<div class="cmt__body">' +
            '<div class="cmt__head"><span class="cmt__author">' + App.esc(name) + '</span><span class="cmt__date">' + App.ago(cmt.created_at) + '</span></div>' +
            '<div class="cmt__text">' + App.esc(cmt.content) + '</div>' +
          '</div>' +
        '</div>';
      });
      el.innerHTML = html;
    } catch (e) {
      el.innerHTML = '<p style="font-size:.75rem;color:var(--text3)">Erreur de chargement</p>';
    }
  },

  async toggleVote(id) {
    if (!App.currentUser) { UI.toast('Connectez-vous pour voter', 'warning'); UI.openModal('modal-login'); return; }

    try {
      var { data: existing } = await App.supabase.from('votes').select('id')
        .eq('report_id', id).eq('user_id', App.currentUser.id).single();

      if (existing) {
        await App.supabase.from('votes').delete().eq('id', existing.id);
        await App.supabase.rpc('decrement_upvotes', { rid: id });
        UI.toast('Vote retiré', 'info');
      } else {
        await App.supabase.from('votes').insert({ report_id: id, user_id: App.currentUser.id });
        await App.supabase.rpc('increment_upvotes', { rid: id });
        UI.toast('Merci pour votre soutien ! 👍', 'success');
      }

      // Refresh
      await this.loadAll();
      this.openDetail(id);
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  },

  async addComment(reportId) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }

    var textarea = document.getElementById('comment-text-' + reportId);
    if (!textarea) return;
    var content = textarea.value.trim();

    if (!content || content.length < 2) { UI.toast('Commentaire trop court', 'warning'); return; }
    if (content.length > 1000) { UI.toast('Commentaire trop long (max 1000)', 'warning'); return; }

    // Moderate comment
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
      var { error } = await App.supabase.from('comments').insert({
        report_id: reportId,
        user_id: App.currentUser.id,
        content: content
      });
      if (error) throw error;

      textarea.value = '';
      UI.toast('Commentaire ajouté', 'success');
      this.loadComments(reportId);
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  },

  async proposeStatus(id, newStatus) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }

    var statusLabels = {
      acknowledged: 'pris en compte',
      in_progress: 'en cours',
      resolved: 'résolu'
    };

    if (!confirm('Confirmer que ce problème est ' + statusLabels[newStatus] + ' ?')) return;

    try {
      var update = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === 'resolved') update.resolved_at = new Date().toISOString();

      var { error } = await App.supabase.from('reports').update(update).eq('id', id);
      if (error) throw error;

      UI.toast('Statut mis à jour en "' + statusLabels[newStatus] + '"', 'success');
      await this.loadAll();
      this.openDetail(id);
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  },

  async submitReport() {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }

    var title = document.getElementById('report-title').value.trim();
    var description = document.getElementById('report-description').value.trim();
    var lat = parseFloat(document.getElementById('report-lat').value);
    var lng = parseFloat(document.getElementById('report-lng').value);
    var address = document.getElementById('report-address').value;
    var commune = document.getElementById('report-commune').value;
    var category = document.querySelector('input[name="category"]:checked');
    var priority = document.querySelector('input[name="priority"]:checked');

    if (!category) { UI.toast('Sélectionnez une catégorie', 'warning'); return; }
    if (!lat || !lng) { UI.toast('Sélectionnez un lieu sur la carte', 'warning'); return; }
    if (!title || title.length < 5) { UI.toast('Titre trop court (min 5 caractères)', 'warning'); return; }
    if (!description || description.length < 10) { UI.toast('Description trop courte (min 10 caractères)', 'warning'); return; }

    if (!MapManager.isInGuadeloupe(lat, lng)) {
      UI.toast('Le lieu doit être en Guadeloupe', 'warning');
      return;
    }

    var btn = document.getElementById('btn-submit-report');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Modération...';

    // Step 1: Moderate content
    try {
      var modResult = await fetch('/api/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title, description: description })
      }).then(function(r) { return r.json(); });

      if (!modResult.ok) {
        // Try to reformulate with AI
        btn.innerHTML = '<span class="spinner"></span> Reformulation IA...';

        var aiResult = await fetch('/api/reformulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title, description: description })
        }).then(function(r) { return r.json(); });

        if (aiResult.ok) {
          // Show AI suggestion
          document.getElementById('ai-title').textContent = aiResult.title;
          document.getElementById('ai-description').textContent = aiResult.description;
          document.getElementById('ai-reformulate').style.display = 'block';

          document.getElementById('btn-accept-ai').onclick = function() {
            document.getElementById('report-title').value = aiResult.title;
            document.getElementById('report-description').value = aiResult.description;
            document.getElementById('ai-reformulate').style.display = 'none';
            document.getElementById('desc-count').textContent = aiResult.description.length;
            UI.toast('Reformulation acceptée', 'success');
          };

          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer le signalement';
          UI.toast('Contenu inapproprié détecté. Acceptez la reformulation ou modifiez votre texte.', 'warning');
          return;
        } else {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer le signalement';
          UI.toast('Contenu inapproprié détecté. Veuillez reformuler.', 'error');
          return;
        }
      }
    } catch (e) {
      // Moderation failed, continue anyway
      console.error('Moderation error:', e);
    }

    // Step 2: Upload images
    btn.innerHTML = '<span class="spinner"></span> Upload photos...';
    var imageUrls = [];
    try {
      imageUrls = await ImageUpload.uploadAll();
    } catch (e) {
      console.error('Image upload error:', e);
    }

    // Step 3: Try AI reformulation for clean content (optional, if available)
    if (App.config.hasGroq) {
      btn.innerHTML = '<span class="spinner"></span> Optimisation...';
      try {
        var reformResult = await fetch('/api/reformulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title, description: description })
        }).then(function(r) { return r.json(); });

        if (reformResult.ok) {
          title = reformResult.title;
          description = reformResult.description;
        }
      } catch (e) {}
    }

    // Step 4: Submit to database
    btn.innerHTML = '<span class="spinner"></span> Envoi...';

    try {
      var { data, error } = await App.supabase.from('reports').insert({
        user_id: App.currentUser.id,
        category: category.value,
        title: title,
        description: description,
        latitude: lat,
        longitude: lng,
        address: address || null,
        commune: commune || null,
        images: imageUrls,
        priority: priority ? priority.value : 'medium',
        status: 'pending'
      }).select().single();

      if (error) throw error;

      UI.closeModal('modal-report');
      UI.toast('Signalement envoyé avec succès ! 🎉', 'success');

      // Update user stats
      try {
        await App.supabase.rpc('increment_user_stats', { uid: App.currentUser.id });
      } catch (e) {}

      // Reset form
      document.getElementById('report-form').reset();
      ImageUpload.reset();
      document.getElementById('ai-reformulate').style.display = 'none';

      // Reload and fly to
      await this.loadAll();
      if (data) {
        MapManager.flyTo(data.latitude, data.longitude);
      }

    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer le signalement';
  },

  handleNew(report) {
    var exists = App.reports.find(function(r) { return r.id === report.id; });
    if (!exists) {
      App.reports.unshift(report);
      MapManager.addReport(report);
      this.renderList();
      this.updateStats();
    }
  },

  handleUpdate(report) {
    var idx = App.reports.findIndex(function(r) { return r.id === report.id; });
    if (idx >= 0) {
      App.reports[idx] = report;
      MapManager.removeReport(report.id);
      MapManager.addReport(report);
      this.renderList();
      this.updateStats();
    }
  },

  handleDelete(report) {
    App.reports = App.reports.filter(function(r) { return r.id !== report.id; });
    MapManager.removeReport(report.id);
    this.renderList();
    this.updateStats();
  }
};
