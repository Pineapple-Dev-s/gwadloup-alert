// ============================================
// GWADLOUP ALÈRT — Gestion des signalements
// ============================================

const Reports = {
  async loadAll() {
    try {
      let query = App.supabase
        .from('reports')
        .select(`
          *,
          profiles:user_id (username)
        `)
        .order('created_at', { ascending: false });

      // Appliquer les filtres
      if (App.filters.category) {
        query = query.eq('category', App.filters.category);
      }
      if (App.filters.status) {
        query = query.eq('status', App.filters.status);
      }
      if (App.filters.commune) {
        query = query.ilike('commune', `%${App.filters.commune}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      App.reports = data || [];

      // Mettre à jour la carte
      MapManager.clearMarkers();
      App.reports.forEach(report => MapManager.addReport(report));

      // Mettre à jour la liste
      this.renderList();

      // Mettre à jour les statistiques
      this.updateStats();

    } catch (error) {
      console.error('Erreur chargement signalements:', error);
      UI.toast('Erreur lors du chargement des signalements', 'error');
    }
  },

  renderList() {
    const grid = document.getElementById('reports-grid');
    const empty = document.getElementById('list-empty');

    if (App.reports.length === 0) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';

    grid.innerHTML = App.reports.map(report => {
      const cat = App.categories[report.category] || App.categories.other;
      const status = App.statuses[report.status] || App.statuses.pending;
      const hasImage = report.images && report.images.length > 0;

      return `
        <div class="report-card" onclick="Reports.openDetail('${report.id}')">
          ${hasImage ?
            `<img class="report-card__image" src="${report.images[0]}" alt="${App.escapeHtml(report.title)}" loading="lazy">` :
            `<div class="report-card__image report-card__image--placeholder">${cat.emoji}</div>`
          }
          <div class="report-card__body">
            <div class="report-card__top">
              <span class="report-card__category">${cat.emoji} ${cat.label}</span>
              <span class="report-card__status report-card__status--${report.status}">
                ${status.icon} ${status.label}
              </span>
            </div>
            <h3 class="report-card__title">${App.escapeHtml(report.title)}</h3>
            <p class="report-card__address">
              <i class="fas fa-map-pin"></i>
              ${report.commune || report.address || 'Guadeloupe'}
            </p>
            <div class="report-card__footer">
              <span class="report-card__votes">
                <i class="fas fa-arrow-up"></i> ${report.upvotes || 0} votes
              </span>
              <span class="report-card__date">${App.timeAgo(report.created_at)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  updateStats() {
    const total = App.reports.length;
    const pending = App.reports.filter(r => r.status === 'pending').length;
    const acknowledged = App.reports.filter(r => r.status === 'acknowledged').length;
    const inProgress = App.reports.filter(r => r.status === 'in_progress').length;
    const resolved = App.reports.filter(r => r.status === 'resolved').length;

    // Map stats
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-progress').textContent = inProgress + acknowledged;
    document.getElementById('stat-resolved').textContent = resolved;

    // Stats view
    document.getElementById('stats-total').textContent = total;
    document.getElementById('stats-pending').textContent = pending;
    document.getElementById('stats-in-progress').textContent = inProgress;
    document.getElementById('stats-resolved').textContent = resolved;

    // Charts
    this.renderCategoryChart();
    this.renderCommuneChart();
    this.renderLeaderboard();
  },

  renderCategoryChart() {
    const container = document.getElementById('chart-categories');
    const counts = {};

    App.reports.forEach(r => {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maxVal = sorted.length > 0 ? sorted[0][1] : 1;

    container.innerHTML = sorted.map(([cat, count]) => {
      const catInfo = App.categories[cat] || App.categories.other;
      const percentage = (count / maxVal) * 100;
      return `
        <div class="chart-bar">
          <span class="chart-bar__label">${catInfo.emoji} ${catInfo.label}</span>
          <div class="chart-bar__track">
            <div class="chart-bar__fill" style="width: ${percentage}%">
              <span class="chart-bar__value">${count}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderCommuneChart() {
    const container = document.getElementById('chart-communes');
    const counts = {};

    App.reports.forEach(r => {
      if (r.commune) {
        counts[r.commune] = (counts[r.commune] || 0) + 1;
      }
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maxVal = sorted.length > 0 ? sorted[0][1] : 1;

    container.innerHTML = sorted.map(([commune, count]) => {
      const percentage = (count / maxVal) * 100;
      return `
        <div class="chart-bar">
          <span class="chart-bar__label">${App.escapeHtml(commune)}</span>
          <div class="chart-bar__track">
            <div class="chart-bar__fill" style="width: ${percentage}%">
              <span class="chart-bar__value">${count}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (sorted.length === 0) {
      container.innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 20px;">Aucune donnée</p>';
    }
  },

  async renderLeaderboard() {
    try {
      const { data, error } = await App.supabase
        .from('profiles')
        .select('username, reports_count, reputation')
        .order('reputation', { ascending: false })
        .limit(10);

      if (error) throw error;

      const container = document.getElementById('leaderboard-list');

      if (!data || data.length === 0) {
        container.innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 20px;">Aucun contributeur</p>';
        return;
      }

      container.innerHTML = data.map((user, i) => `
        <div class="leaderboard-item">
          <span class="leaderboard-item__rank">${i + 1}</span>
          <div class="leaderboard-item__avatar">
            ${user.username.charAt(0).toUpperCase()}
          </div>
          <div class="leaderboard-item__info">
            <div class="leaderboard-item__name">${App.escapeHtml(user.username)}</div>
            <div class="leaderboard-item__stats">${user.reports_count} signalement${user.reports_count > 1 ? 's' : ''}</div>
          </div>
          <span class="leaderboard-item__reputation">${user.reputation} pts</span>
        </div>
      `).join('');
    } catch (error) {
      console.error('Erreur leaderboard:', error);
    }
  },

  async openDetail(reportId) {
    const report = App.reports.find(r => r.id === reportId);
    if (!report) return;

    const cat = App.categories[report.category] || App.categories.other;
    const status = App.statuses[report.status] || App.statuses.pending;
    const priority = App.priorities[report.priority] || App.priorities.medium;

    // Charger les commentaires
    const { data: comments } = await App.supabase
      .from('comments')
      .select(`
        *,
        profiles:user_id (username)
      `)
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });

    // Vérifier si l'utilisateur a déjà voté
    let hasVoted = false;
    if (App.currentUser) {
      const { data: vote } = await App.supabase
        .from('votes')
        .select('id')
        .eq('report_id', reportId)
        .eq('user_id', App.currentUser.id)
        .single();
      hasVoted = !!vote;
    }

    const detailEl = document.getElementById('report-detail');

    const galleryHtml = report.images && report.images.length > 0 ?
      `<div class="report-detail__gallery">
         <img src="${report.images[0]}" alt="${App.escapeHtml(report.title)}">
       </div>` :
      `<div class="report-detail__gallery">
         <div class="report-detail__gallery-placeholder">${cat.emoji}</div>
       </div>`;

    const commentsHtml = (comments || []).map(c => `
      <div class="comment">
        <div class="comment__avatar">${c.profiles?.username?.charAt(0).toUpperCase() || '?'}</div>
        <div class="comment__body">
          <div class="comment__header">
            <span class="comment__author">${App.escapeHtml(c.profiles?.username || 'Anonyme')}</span>
            <span class="comment__date">${App.timeAgo(c.created_at)}</span>
          </div>
          <p class="comment__text">${App.escapeHtml(c.content)}</p>
        </div>
      </div>
    `).join('');

    // Extra images thumbnails
    let extraImagesHtml = '';
    if (report.images && report.images.length > 1) {
      extraImagesHtml = `
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
          ${report.images.map((img, i) => `
            <img src="${img}" alt="Photo ${i+1}"
                 style="width:80px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid var(--border);"
                 onclick="document.querySelector('.report-detail__gallery img').src='${img}'">
          `).join('')}
        </div>
      `;
    }

    detailEl.innerHTML = `
      ${galleryHtml}
      <div class="report-detail__content">
        <div class="report-detail__header">
          <div class="report-detail__badges">
            <span class="report-card__category">${cat.emoji} ${cat.label}</span>
            <span class="report-card__status report-card__status--${report.status}">
              ${status.icon} ${status.label}
            </span>
          </div>
          <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;background:${priority.color}22;color:${priority.color};">
            Priorité ${priority.label}
          </span>
        </div>

        <h2 class="report-detail__title">${App.escapeHtml(report.title)}</h2>

        <div class="report-detail__meta">
          <span class="report-detail__meta-item">
            <i class="fas fa-user"></i>
            ${App.escapeHtml(report.profiles?.username || 'Anonyme')}
          </span>
          <span class="report-detail__meta-item">
            <i class="fas fa-map-marker-alt"></i>
            ${report.commune || report.address || 'Guadeloupe'}
          </span>
          <span class="report-detail__meta-item">
            <i class="fas fa-calendar"></i>
            ${new Date(report.created_at).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'long', year: 'numeric'
            })}
          </span>
        </div>

        ${extraImagesHtml}

        <p class="report-detail__description">${App.escapeHtml(report.description)}</p>

        ${report.admin_response ? `
          <div style="background:var(--secondary-light);padding:16px;border-radius:var(--radius);margin-bottom:16px;">
            <strong style="color:var(--secondary);"><i class="fas fa-reply"></i> Réponse officielle :</strong>
            <p style="margin-top:8px;">${App.escapeHtml(report.admin_response)}</p>
          </div>
        ` : ''}

        <div class="report-detail__actions">
          <button class="btn--vote ${hasVoted ? 'voted' : ''}" id="btn-vote-${report.id}"
                  onclick="Reports.toggleVote('${report.id}')">
            <i class="fas fa-arrow-up"></i>
            <span id="vote-count-${report.id}">${report.upvotes || 0}</span>
            <span>Soutenir</span>
          </button>
          <button class="btn btn--small btn--outline" onclick="MapManager.flyTo(${report.latitude}, ${report.longitude}); UI.closeModal('modal-detail');">
            <i class="fas fa-map"></i> Voir sur la carte
          </button>
        </div>

        <div class="comments-section">
          <h3 class="comments-section__title">
            <i class="fas fa-comments"></i> Commentaires (${(comments || []).length})
          </h3>

          ${App.currentUser ? `
            <div class="comment-form">
              <textarea class="comment-form__input" id="comment-input-${report.id}"
                        placeholder="Ajouter un commentaire..." rows="2"></textarea>
              <button class="btn btn--primary btn--small" onclick="Reports.addComment('${report.id}')">
                <i class="fas fa-paper-plane"></i>
              </button>
            </div>
          ` : `
            <p style="text-align:center;color:var(--text-secondary);font-size:0.9rem;margin-bottom:16px;">
              <a href="#" onclick="event.preventDefault();UI.closeModal('modal-detail');UI.openModal('modal-login');" style="color:var(--primary);font-weight:600;">
                Connectez-vous
              </a> pour commenter
            </p>
          `}

          <div class="comment-list">
            ${commentsHtml || '<p style="color:var(--text-light);text-align:center;padding:20px;">Aucun commentaire</p>'}
          </div>
        </div>
      </div>
    `;

    UI.openModal('modal-detail');
  },

  async toggleVote(reportId) {
    if (!App.currentUser) {
      UI.toast('Connectez-vous pour soutenir un signalement', 'warning');
      UI.openModal('modal-login');
      return;
    }

    const btn = document.getElementById(`btn-vote-${reportId}`);
    const countEl = document.getElementById(`vote-count-${reportId}`);
    const isVoted = btn.classList.contains('voted');

    try {
      if (isVoted) {
        // Retirer le vote
        await App.supabase
          .from('votes')
          .delete()
          .eq('report_id', reportId)
          .eq('user_id', App.currentUser.id);

        btn.classList.remove('voted');
        countEl.textContent = parseInt(countEl.textContent) - 1;
      } else {
        // Ajouter le vote
        await App.supabase
          .from('votes')
          .insert({
            report_id: reportId,
            user_id: App.currentUser.id
          });

        btn.classList.add('voted');
        countEl.textContent = parseInt(countEl.textContent) + 1;
      }

      // Mettre à jour le report local
      const report = App.reports.find(r => r.id === reportId);
      if (report) {
        report.upvotes = parseInt(countEl.textContent);
      }
    } catch (error) {
      console.error('Erreur vote:', error);
      UI.toast('Erreur lors du vote', 'error');
    }
  },

  async addComment(reportId) {
    if (!App.currentUser) return;

    const input = document.getElementById(`comment-input-${reportId}`);
    const content = input.value.trim();

    if (content.length < 2) {
      UI.toast('Le commentaire doit faire au moins 2 caractères', 'warning');
      return;
    }

    try {
      await App.supabase
        .from('comments')
        .insert({
          report_id: reportId,
          user_id: App.currentUser.id,
          content: content
        });

      UI.toast('Commentaire ajouté', 'success');

      // Rafraîchir le détail
      this.openDetail(reportId);
    } catch (error) {
      console.error('Erreur commentaire:', error);
      UI.toast('Erreur lors de l\'ajout du commentaire', 'error');
    }
  },

  async submitReport() {
    if (!App.currentUser) {
      UI.toast('Connectez-vous pour signaler un problème', 'warning');
      return;
    }

    const btnSubmit = document.getElementById('btn-submit-report');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner-inline"></span> Envoi en cours...';

    try {
      // Upload des photos
      let imageUrls = [];
      if (ImageUpload.files.length > 0) {
        imageUrls = await ImageUpload.uploadAll();
      }

      const category = document.querySelector('input[name="category"]:checked')?.value;
      const title = document.getElementById('report-title').value.trim();
      const description = document.getElementById('report-description').value.trim();
      const latitude = parseFloat(document.getElementById('report-lat').value);
      const longitude = parseFloat(document.getElementById('report-lng').value);
      const address = document.getElementById('report-address').value;
      const commune = document.getElementById('report-commune').value;
      const priority = document.getElementById('report-priority').value;

      // Validations
      if (!category) throw new Error('Sélectionnez une catégorie');
      if (!title || title.length < 5) throw new Error('Le titre doit faire au moins 5 caractères');
      if (!description || description.length < 10) throw new Error('La description doit faire au moins 10 caractères');
      if (!latitude || !longitude) throw new Error('Sélectionnez une position sur la carte');

      const { data, error } = await App.supabase
        .from('reports')
        .insert({
          user_id: App.currentUser.id,
          category,
          title,
          description,
          latitude,
          longitude,
          address,
          commune,
          images: imageUrls,
          priority,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      UI.closeModal('modal-report');
      UI.toast('Signalement envoyé avec succès ! Merci citoyen 🙌', 'success');

      // Reset le formulaire
      this.resetForm();

      // Recharger les données
      await this.loadAll();

      // Centrer la carte sur le nouveau signalement
      if (data) {
        MapManager.flyTo(data.latitude, data.longitude);
      }

    } catch (error) {
      console.error('Erreur soumission:', error);
      UI.toast(error.message || 'Erreur lors de l\'envoi du signalement', 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer le signalement';
    }
  },

  resetForm() {
    document.getElementById('report-form').reset();
    ImageUpload.reset();

    // Reset steps
    document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-1').classList.add('active');

    document.querySelectorAll('.step-indicator .step').forEach(s => {
      s.classList.remove('active', 'completed');
    });
    document.querySelector('.step-indicator .step[data-step="1"]').classList.add('active');

    document.getElementById('btn-step1-next').disabled = true;
    document.getElementById('btn-step2-next').disabled = true;

    document.getElementById('location-info').style.display = 'none';
    document.getElementById('desc-count').textContent = '0';

    if (MapManager.miniMapMarker) {
      MapManager.miniMap.removeLayer(MapManager.miniMapMarker);
      MapManager.miniMapMarker = null;
    }
  },

  // Handlers temps réel
  handleNewReport(report) {
    // Éviter les doublons
    if (!App.reports.find(r => r.id === report.id)) {
      App.reports.unshift(report);
      MapManager.addReport(report);
      this.renderList();
      this.updateStats();
    }
  },

  handleUpdatedReport(report) {
    const idx = App.reports.findIndex(r => r.id === report.id);
    if (idx !== -1) {
      App.reports[idx] = { ...App.reports[idx], ...report };
    }
    MapManager.removeReport(report.id);
    MapManager.addReport(report);
    this.renderList();
    this.updateStats();
  },

  handleDeletedReport(report) {
    App.reports = App.reports.filter(r => r.id !== report.id);
    MapManager.removeReport(report.id);
    this.renderList();
    this.updateStats();
  }
};
