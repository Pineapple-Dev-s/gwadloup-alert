const Reports = {
  async loadAll() {
    try {
      let q = App.supabase.from('reports').select('*, profiles:user_id(username)').order('created_at', { ascending: false });
      if (App.filters.category) q = q.eq('category', App.filters.category);
      if (App.filters.status) q = q.eq('status', App.filters.status);
      if (App.filters.commune) q = q.ilike('commune', `%${App.filters.commune}%`);
      const { data, error } = await q;
      if (error) throw error;
      App.reports = data || [];
      MapManager.clear();
      App.reports.forEach(r => MapManager.addReport(r));
      this.renderList();
      this.updateStats();
    } catch (e) { console.error('Load error:', e); UI.toast('Erreur de chargement', 'error'); }
  },

  renderList() {
    const grid = document.getElementById('reports-grid');
    const empty = document.getElementById('list-empty');
    const count = document.getElementById('list-count');
    count.textContent = `${App.reports.length} résultat${App.reports.length > 1 ? 's' : ''}`;

    if (App.reports.length === 0) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    grid.innerHTML = App.reports.map(r => {
      const cat = App.categories[r.category] || App.categories.other;
      const st = App.statuses[r.status] || App.statuses.pending;
      const img = r.images && r.images.length > 0;
      return `<div class="card" onclick="Reports.openDetail('${r.id}')">
        ${img ? `<div class="card__img-wrapper" style="overflow:hidden"><img class="card__img" src="${r.images[0]}" alt="" loading="lazy"></div>` : `<div class="card__img--ph">${cat.emoji}</div>`}
        <div class="card__body">
          <div class="card__row"><span class="badge badge--cat">${cat.emoji} ${cat.label}</span><span class="badge badge--${r.status}">${st.icon} ${st.label}</span></div>
          <div class="card__title">${App.esc(r.title)}</div>
          <div class="card__addr"><i class="fas fa-map-pin"></i>${r.commune || r.address || 'Guadeloupe'}</div>
          <div class="card__foot"><span class="card__votes"><i class="fas fa-arrow-up"></i> ${r.upvotes || 0}</span><span class="card__date">${App.timeAgo(r.created_at)}</span></div>
        </div>
      </div>`;
    }).join('');
  },

  updateStats() {
    const t = App.reports.length;
    const p = App.reports.filter(r => r.status === 'pending').length;
    const a = App.reports.filter(r => r.status === 'acknowledged').length;
    const ip = App.reports.filter(r => r.status === 'in_progress').length;
    const rs = App.reports.filter(r => r.status === 'resolved').length;

    document.getElementById('stat-total').textContent = t;
    document.getElementById('stat-pending').textContent = p;
    document.getElementById('stat-progress').textContent = ip + a;
    document.getElementById('stat-resolved').textContent = rs;
    document.getElementById('stats-total').textContent = t;
    document.getElementById('stats-pending').textContent = p;
    document.getElementById('stats-in-progress').textContent = ip;
    document.getElementById('stats-resolved').textContent = rs;

    this.renderCharts();
    this.renderLeaderboard();
  },

  renderCharts() {
    // Categories
    const cc = {}; App.reports.forEach(r => { cc[r.category] = (cc[r.category] || 0) + 1; });
    const sorted = Object.entries(cc).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const max = sorted[0]?.[1] || 1;
    document.getElementById('chart-categories').innerHTML = sorted.map(([k, v]) => {
      const c = App.categories[k] || App.categories.other;
      return `<div class="bar-row"><span class="bar-row__label">${c.emoji} ${c.label}</span><div class="bar-row__track"><div class="bar-row__fill" style="width:${(v/max)*100}%"><span class="bar-row__val">${v}</span></div></div></div>`;
    }).join('') || '<p style="color:var(--text3);text-align:center;padding:16px">Aucune donnée</p>';

    // Communes
    const cm = {}; App.reports.forEach(r => { if (r.commune) cm[r.commune] = (cm[r.commune] || 0) + 1; });
    const sc = Object.entries(cm).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const mx = sc[0]?.[1] || 1;
    document.getElementById('chart-communes').innerHTML = sc.map(([k, v]) =>
      `<div class="bar-row"><span class="bar-row__label">${App.esc(k)}</span><div class="bar-row__track"><div class="bar-row__fill" style="width:${(v/mx)*100}%"><span class="bar-row__val">${v}</span></div></div></div>`
    ).join('') || '<p style="color:var(--text3);text-align:center;padding:16px">Aucune donnée</p>';
  },

  async renderLeaderboard() {
    try {
      const { data } = await App.supabase.from('profiles').select('username, reports_count, reputation').order('reputation', { ascending: false }).limit(10);
      const c = document.getElementById('leaderboard-list');
      if (!data || data.length === 0) { c.innerHTML = '<p style="color:var(--text3);text-align:center;padding:16px">Aucun contributeur</p>'; return; }
      c.innerHTML = data.map((u, i) =>
        `<div class="lb-item"><span class="lb-item__rank">${i + 1}</span><div class="lb-item__av">${u.username.charAt(0).toUpperCase()}</div><div class="lb-item__info"><div class="lb-item__name">${App.esc(u.username)}</div><div class="lb-item__sub">${u.reports_count} signalement${u.reports_count > 1 ? 's' : ''}</div></div><span class="lb-item__pts">${u.reputation} pts</span></div>`
      ).join('');
    } catch (e) { console.error('Leaderboard error:', e); }
  },

  async openDetail(id) {
    const r = App.reports.find(x => x.id === id);
    if (!r) return;
    const cat = App.categories[r.category] || App.categories.other;
    const st = App.statuses[r.status] || App.statuses.pending;
    const pri = App.priorities[r.priority] || App.priorities.medium;

    const { data: comments } = await App.supabase.from('comments').select('*, profiles:user_id(username)').eq('report_id', id).order('created_at', { ascending: true });

    let hasVoted = false;
    if (App.currentUser) {
      const { data: v } = await App.supabase.from('votes').select('id').eq('report_id', id).eq('user_id', App.currentUser.id).single();
      hasVoted = !!v;
    }

    const el = document.getElementById('report-detail');
    const gallery = r.images?.length > 0
      ? `<div class="detail__gallery"><img src="${r.images[0]}" alt=""></div>`
      : `<div class="detail__gallery"><div class="detail__gallery--ph">${cat.emoji}</div></div>`;

    const extraImgs = r.images?.length > 1
      ? `<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">${r.images.map((img, i) => `<img src="${img}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid var(--border)" onclick="document.querySelector('.detail__gallery img').src='${img}'">`).join('')}</div>`
      : '';

    const cmts = (comments || []).map(c =>
      `<div class="cmt"><div class="cmt__av">${c.profiles?.username?.charAt(0).toUpperCase() || '?'}</div><div class="cmt__body"><div class="cmt__head"><span class="cmt__author">${App.esc(c.profiles?.username || '?')}</span><span class="cmt__date">${App.timeAgo(c.created_at)}</span></div><div class="cmt__text">${App.esc(c.content)}</div></div></div>`
    ).join('');

    el.innerHTML = `${gallery}
    <div class="detail__body">
      <div class="detail__badges">
        <span class="badge badge--cat">${cat.emoji} ${cat.label}</span>
        <span class="badge badge--${r.status}">${st.icon} ${st.label}</span>
        <span class="badge" style="background:${pri.color}18;color:${pri.color}">Priorité ${pri.label}</span>
      </div>
      <h2 class="detail__title">${App.esc(r.title)}</h2>
      <div class="detail__meta">
        <span class="detail__meta-item"><i class="fas fa-user"></i>${App.esc(r.profiles?.username || '?')}</span>
        <span class="detail__meta-item"><i class="fas fa-map-marker-alt"></i>${r.commune || 'Guadeloupe'}</span>
        <span class="detail__meta-item"><i class="fas fa-calendar"></i>${new Date(r.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</span>
      </div>
      ${extraImgs}
      <div class="detail__desc">${App.esc(r.description)}</div>
      ${r.admin_response ? `<div style="background:var(--blue-l);padding:14px;border-radius:var(--r);margin-bottom:16px"><strong style="color:var(--blue)"><i class="fas fa-reply"></i> Réponse officielle :</strong><p style="margin-top:6px">${App.esc(r.admin_response)}</p></div>` : ''}
      <div class="detail__actions">
        <button class="vote-btn ${hasVoted ? 'voted' : ''}" id="vb-${r.id}" onclick="Reports.toggleVote('${r.id}')">
          <i class="fas fa-arrow-up"></i><span id="vc-${r.id}">${r.upvotes || 0}</span> Soutenir
        </button>
        <button class="btn btn--outline btn--sm" onclick="MapManager.flyTo(${r.latitude},${r.longitude});UI.closeModal('modal-detail')"><i class="fas fa-map"></i> Carte</button>
      </div>
      <div class="comments">
        <div class="comments__title"><i class="fas fa-comments"></i> Commentaires (${(comments || []).length})</div>
        ${App.currentUser ? `<div class="comment-form"><textarea id="ci-${r.id}" placeholder="Votre commentaire..." rows="2"></textarea><button class="btn btn--primary btn--sm" onclick="Reports.addComment('${r.id}')"><i class="fas fa-paper-plane"></i></button></div>` : `<p style="text-align:center;color:var(--text2);font-size:.85rem;margin-bottom:12px"><a href="#" onclick="event.preventDefault();UI.closeModal('modal-detail');UI.openModal('modal-login')" style="color:var(--primary);font-weight:600">Connectez-vous</a> pour commenter</p>`}
        <div>${cmts || '<p style="color:var(--text3);text-align:center;padding:16px">Aucun commentaire</p>'}</div>
      </div>
    </div>`;
    UI.openModal('modal-detail');
  },

  async toggleVote(id) {
    if (!App.currentUser) { UI.toast('Connectez-vous pour voter', 'warning'); UI.openModal('modal-login'); return; }
    const btn = document.getElementById(`vb-${id}`);
    const cnt = document.getElementById(`vc-${id}`);
    const voted = btn.classList.contains('voted');
    try {
      if (voted) {
        await App.supabase.from('votes').delete().eq('report_id', id).eq('user_id', App.currentUser.id);
        btn.classList.remove('voted'); cnt.textContent = parseInt(cnt.textContent) - 1;
      } else {
        await App.supabase.from('votes').insert({ report_id: id, user_id: App.currentUser.id });
        btn.classList.add('voted'); cnt.textContent = parseInt(cnt.textContent) + 1;
      }
      const r = App.reports.find(x => x.id === id);
      if (r) r.upvotes = parseInt(cnt.textContent);
    } catch (e) { UI.toast('Erreur de vote', 'error'); }
  },

  async addComment(id) {
    if (!App.currentUser) return;
    const inp = document.getElementById(`ci-${id}`);
    const content = inp.value.trim();
    if (content.length < 2) { UI.toast('Commentaire trop court', 'warning'); return; }
    try {
      await App.supabase.from('comments').insert({ report_id: id, user_id: App.currentUser.id, content });
      UI.toast('Commentaire ajouté', 'success');
      this.openDetail(id);
    } catch (e) { UI.toast('Erreur', 'error'); }
  },

  async submitReport() {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    const btn = document.getElementById('btn-submit-report');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Envoi...';

    try {
      let imageUrls = [];
      if (ImageUpload.files.length > 0) imageUrls = await ImageUpload.uploadAll();

      const cat = document.querySelector('input[name="category"]:checked')?.value;
      const title = document.getElementById('report-title').value.trim();
      const desc = document.getElementById('report-description').value.trim();
      const lat = parseFloat(document.getElementById('report-lat').value);
      const lng = parseFloat(document.getElementById('report-lng').value);
      const address = document.getElementById('report-address').value;
      const commune = document.getElementById('report-commune').value;
      const priority = document.querySelector('input[name="priority"]:checked')?.value || 'medium';

      if (!cat) throw new Error('Choisissez une catégorie');
      if (!title || title.length < 5) throw new Error('Titre trop court');
      if (!desc || desc.length < 10) throw new Error('Description trop courte');
      if (!lat || !lng) throw new Error('Choisissez un lieu');

      const { data, error } = await App.supabase.from('reports').insert({
        user_id: App.currentUser.id, category: cat, title, description: desc,
        latitude: lat, longitude: lng, address, commune,
        images: imageUrls, priority, status: 'pending'
      }).select().single();

      if (error) throw error;
      UI.closeModal('modal-report');
      UI.toast('Signalement envoyé ! Merci 🙌', 'success');
      this.resetForm();
      await this.loadAll();
      if (data) MapManager.flyTo(data.latitude, data.longitude);
    } catch (e) {
      UI.toast(e.message || 'Erreur d\'envoi', 'error');
    } finally {
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer';
    }
  },

  resetForm() {
    document.getElementById('report-form').reset();
    ImageUpload.reset();
    document.querySelectorAll('.fstep').forEach(s => s.classList.remove('active'));
    document.getElementById('step-1').classList.add('active');
    document.querySelectorAll('.steps__item').forEach(s => { s.classList.remove('active', 'done'); });
    document.querySelector('.steps__item[data-step="1"]').classList.add('active');
    document.getElementById('btn-step1-next').disabled = true;
    document.getElementById('btn-step2-next').disabled = true;
    document.getElementById('location-info').style.display = 'none';
    document.getElementById('desc-count').textContent = '0';
    if (MapManager.miniMapMarker && MapManager.miniMap) {
      MapManager.miniMap.removeLayer(MapManager.miniMapMarker);
      MapManager.miniMapMarker = null;
    }
  },

  handleNewReport(r) { if (!App.reports.find(x => x.id === r.id)) { App.reports.unshift(r); MapManager.addReport(r); this.renderList(); this.updateStats(); } },
  handleUpdatedReport(r) { const i = App.reports.findIndex(x => x.id === r.id); if (i !== -1) App.reports[i] = { ...App.reports[i], ...r }; MapManager.removeReport(r.id); MapManager.addReport(r); this.renderList(); this.updateStats(); },
  handleDeletedReport(r) { App.reports = App.reports.filter(x => x.id !== r.id); MapManager.removeReport(r.id); this.renderList(); this.updateStats(); }
};
