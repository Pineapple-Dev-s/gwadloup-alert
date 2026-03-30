var Auth = {
  init: async function() {
    try {
      var self = this;
      var result = await App.supabase.auth.getSession();
      var session = result.data.session;
      if (session && session.user) { App.currentUser = session.user; await self.loadProfile(); self.showIn(); }
      else self.showOut();
      App.supabase.auth.onAuthStateChange(function(event, session) {
        if (event === 'SIGNED_IN' && session) { App.currentUser = session.user; self.loadProfile().then(function() { self.showIn(); }); }
        else if (event === 'SIGNED_OUT') { App.currentUser = null; App.currentProfile = null; self.showOut(); }
      });
      self.bind();
    } catch (e) { console.error('Auth init:', e); this.showOut(); this.bind(); }
  },

  bind: function() {
    var self = this;
    var loginBtn = document.getElementById('btn-login');
    if (loginBtn) loginBtn.addEventListener('click', function() { UI.openModal('modal-login'); });
    var regBtn = document.getElementById('btn-register');
    if (regBtn) regBtn.addEventListener('click', function() { UI.openModal('modal-register'); });
    var switchToReg = document.getElementById('switch-to-register');
    if (switchToReg) switchToReg.addEventListener('click', function(e) { e.preventDefault(); UI.closeModal('modal-login'); UI.openModal('modal-register'); });
    var switchToLog = document.getElementById('switch-to-login');
    if (switchToLog) switchToLog.addEventListener('click', function(e) { e.preventDefault(); UI.closeModal('modal-register'); UI.openModal('modal-login'); });
    var loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', function(e) { e.preventDefault(); self.login(); });
    var regForm = document.getElementById('register-form');
    if (regForm) regForm.addEventListener('submit', function(e) { e.preventDefault(); self.register(); });
    var logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', function() { self.logout(); });
    var menuBtn = document.getElementById('user-menu-btn');
    if (menuBtn) menuBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      document.getElementById('user-dropdown').classList.toggle('open');
    });
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.umenu')) { var dd = document.getElementById('user-dropdown'); if (dd) dd.classList.remove('open'); }
    });
    var profileBtn = document.getElementById('btn-profile');
    if (profileBtn) profileBtn.addEventListener('click', function() { document.getElementById('user-dropdown').classList.remove('open'); self.showProfile(); });
    var myReportsBtn = document.getElementById('btn-my-reports');
    if (myReportsBtn) myReportsBtn.addEventListener('click', function() { document.getElementById('user-dropdown').classList.remove('open'); self.showMyReports(); });
    var adminBtn = document.getElementById('btn-admin');
    if (adminBtn) adminBtn.addEventListener('click', function() { document.getElementById('user-dropdown').classList.remove('open'); self.showAdmin(); });
  },

  login: async function() {
    var email = document.getElementById('login-email').value.trim();
    var password = document.getElementById('login-password').value;
    var errEl = document.getElementById('login-error');
    var btn = document.getElementById('btn-login-submit');
    if (!email || !password) { errEl.textContent = 'Remplissez tous les champs'; errEl.style.display = 'block'; return; }
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Connexion...'; errEl.style.display = 'none';
    try {
      var result = await App.supabase.auth.signInWithPassword({ email: email, password: password });
      if (result.error) {
        var msg = 'Erreur de connexion';
        if (result.error.message.includes('Invalid login')) msg = 'Email ou mot de passe incorrect';
        else if (result.error.message.includes('Email not confirmed')) msg = 'Confirmez votre email';
        errEl.textContent = msg; errEl.style.display = 'block';
      } else { UI.closeModal('modal-login'); UI.toast('Bienvenue !', 'success'); document.getElementById('login-form').reset(); }
    } catch (e) { errEl.textContent = 'Erreur réseau'; errEl.style.display = 'block'; }
    btn.disabled = false; btn.textContent = 'Se connecter';
  },

  register: async function() {
    var username = document.getElementById('register-username').value.trim();
    var email = document.getElementById('register-email').value.trim();
    var commune = document.getElementById('register-commune').value;
    var password = document.getElementById('register-password').value;
    var confirm = document.getElementById('register-password-confirm').value;
    var errEl = document.getElementById('register-error');
    var btn = document.getElementById('btn-register-submit');
    errEl.style.display = 'none';
    if (!username || !email || !password) { errEl.textContent = 'Remplissez tous les champs'; errEl.style.display = 'block'; return; }
    if (username.length < 3) { errEl.textContent = 'Pseudo: min 3 caractères'; errEl.style.display = 'block'; return; }
    if (password !== confirm) { errEl.textContent = 'Mots de passe différents'; errEl.style.display = 'block'; return; }
    if (password.length < 6) { errEl.textContent = 'Min 6 caractères'; errEl.style.display = 'block'; return; }
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Création...';
    try {
      var result = await App.supabase.auth.signUp({ email: email, password: password, options: { data: { username: username, commune: commune } } });
      if (result.error) {
        errEl.textContent = result.error.message.includes('already registered') ? 'Email déjà utilisé' : 'Erreur';
        errEl.style.display = 'block';
      } else {
        if (commune && result.data.user) await App.supabase.from('profiles').update({ commune: commune }).eq('id', result.data.user.id);
        UI.closeModal('modal-register');
        if (result.data.session) UI.toast('Bienvenue ' + username + ' !', 'success');
        else UI.toast('Vérifiez votre email', 'info');
        document.getElementById('register-form').reset();
      }
    } catch (e) { errEl.textContent = 'Erreur réseau'; errEl.style.display = 'block'; }
    btn.disabled = false; btn.textContent = 'Creer mon compte';
  },

  logout: async function() {
    await App.supabase.auth.signOut();
    App.currentUser = null; App.currentProfile = null;
    this.showOut(); UI.toast('Déconnecté', 'info');
  },

  loadProfile: async function() {
    if (!App.currentUser) return;
    try { var r = await App.supabase.from('profiles').select('*').eq('id', App.currentUser.id).single(); if (r.data) App.currentProfile = r.data; } catch (e) {}
  },

  showIn: function() {
    var authBtns = document.getElementById('auth-buttons'); if (authBtns) authBtns.style.display = 'none';
    var userMenu = document.getElementById('user-menu'); if (userMenu) userMenu.style.display = 'block';
    var newBtn = document.getElementById('btn-new-report'); if (newBtn) newBtn.style.display = 'inline-flex';
    var newArt = document.getElementById('btn-new-article'); if (newArt) newArt.style.display = 'inline-flex';
    var p = App.currentProfile;
    var name = (p && p.username) || (App.currentUser && App.currentUser.email ? App.currentUser.email.split('@')[0] : 'Citoyen');
    var initial = name.charAt(0).toUpperCase();
    var els = { 'user-avatar': initial, 'dropdown-avatar': initial, 'user-display-name': name, 'dropdown-name': name, 'dropdown-rep': (p ? p.reputation || 0 : 0) + ' pts' };
    for (var id in els) { var el = document.getElementById(id); if (el) el.textContent = els[id]; }
    var adminSection = document.getElementById('admin-section');
    if (adminSection) adminSection.style.display = (p && p.role === 'admin') ? 'block' : 'none';
  },

  showOut: function() {
    var authBtns = document.getElementById('auth-buttons'); if (authBtns) authBtns.style.display = 'flex';
    var userMenu = document.getElementById('user-menu'); if (userMenu) userMenu.style.display = 'none';
    var newBtn = document.getElementById('btn-new-report'); if (newBtn) newBtn.style.display = 'none';
    var newArt = document.getElementById('btn-new-article'); if (newArt) newArt.style.display = 'none';
  },

  // === PROFIL ULTRA STYLÉ ===
  showProfile: function() {
    var p = App.currentProfile; var u = App.currentUser; if (!u) return;
    var name = (p && p.username) || u.email.split('@')[0];
    var initial = name.charAt(0).toUpperCase();
    var communeOpts = this._communeOptions((p && p.commune) || '');

    var html = '<div class="profile">' +

      // Header with gradient
      '<div class="profile__header">' +
      '<div class="profile__banner"></div>' +
      '<div class="profile__avatar-wrap">' +
      '<div class="profile__avatar">' + initial + '</div>' +
      '<div class="profile__level">' + this._getLevel(p ? p.reputation || 0 : 0) + '</div></div>' +
      '<h2 class="profile__name">' + App.esc(name) + '</h2>' +
      '<p class="profile__email">' + App.esc(u.email) + '</p>' +
      (p && p.commune ? '<p class="profile__commune"><i class="fas fa-map-pin"></i> ' + App.esc(p.commune) + '</p>' : '') +
      '<p class="profile__joined"><i class="fas fa-calendar"></i> Membre depuis ' + (p ? new Date(p.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' }) : '') + '</p>' +
      '</div>' +

      // Stats
      '<div class="profile__stats">' +
      '<div class="profile__stat">' +
      '<div class="profile__stat-value">' + (p ? p.reports_count || 0 : 0) + '</div>' +
      '<div class="profile__stat-icon"><i class="fas fa-flag"></i></div>' +
      '<div class="profile__stat-label">Signalements</div></div>' +
      '<div class="profile__stat profile__stat--green">' +
      '<div class="profile__stat-value">' + (p ? p.reputation || 0 : 0) + '</div>' +
      '<div class="profile__stat-icon"><i class="fas fa-star"></i></div>' +
      '<div class="profile__stat-label">Réputation</div></div>' +
      '<div class="profile__stat profile__stat--purple">' +
      '<div class="profile__stat-value">' + (p ? p.role || 'citizen' : 'citizen') + '</div>' +
      '<div class="profile__stat-icon"><i class="fas fa-user-tag"></i></div>' +
      '<div class="profile__stat-label">Rôle</div></div>' +
      '<div class="profile__stat profile__stat--yellow">' +
      '<div class="profile__stat-value" id="profile-badge-count">...</div>' +
      '<div class="profile__stat-icon"><i class="fas fa-medal"></i></div>' +
      '<div class="profile__stat-label">Badges</div></div>' +
      '</div>' +

      // Badges
      '<div class="profile__section">' +
      '<div id="profile-badges-area"><div style="text-align:center;padding:20px;color:var(--text3)"><span class="spinner"></span> Chargement des badges...</div></div>' +
      '</div>' +

      // Settings
      '<div class="profile__section">' +
      '<h3 class="profile__section-title"><i class="fas fa-cog"></i> Paramètres</h3>' +
      '<div class="profile__setting">' +
      '<label>Commune</label>' +
      '<div style="display:flex;gap:6px"><select class="inp" id="profile-commune" style="flex:1">' + communeOpts + '</select>' +
      '<button class="btn btn--primary" onclick="Auth.changeCommune()"><i class="fas fa-check"></i></button></div></div>' +
      '<div class="profile__setting">' +
      '<label>Mot de passe</label>' +
      '<div style="display:flex;gap:6px">' +
      '<input type="password" class="inp" id="profile-new-password" placeholder="Nouveau" style="flex:1">' +
      '<input type="password" class="inp" id="profile-confirm-password" placeholder="Confirmer" style="flex:1">' +
      '<button class="btn btn--primary" onclick="Auth.changePassword()"><i class="fas fa-check"></i></button></div></div>' +
      '</div>' +

      '</div>';

    document.getElementById('profile-content').innerHTML = html;
    UI.openModal('modal-profile');

    // Load badges
    if (typeof Badges !== 'undefined' && p) {
      Badges.getUnlocked(p, App.currentUser.id).then(function(result) {
        var area = document.getElementById('profile-badges-area');
        var count = document.getElementById('profile-badge-count');
        if (area) area.innerHTML = Badges.renderGrid(result.unlocked, true);
        if (count) count.textContent = result.unlocked.length;
      });
    }
  },

  _getLevel: function(rep) {
    if (rep >= 5000) return 'Lv.10';
    if (rep >= 2500) return 'Lv.9';
    if (rep >= 1000) return 'Lv.8';
    if (rep >= 500) return 'Lv.7';
    if (rep >= 250) return 'Lv.6';
    if (rep >= 100) return 'Lv.5';
    if (rep >= 50) return 'Lv.4';
    if (rep >= 25) return 'Lv.3';
    if (rep >= 10) return 'Lv.2';
    return 'Lv.1';
  },

  _communeOptions: function(selected) {
    var groups = {
      'Grande-Terre': ['Les Abymes','Anse-Bertrand','Le Gosier','Le Moule','Morne-a-l\'Eau','Petit-Canal','Pointe-a-Pitre','Port-Louis','Saint-Francois','Sainte-Anne'],
      'Basse-Terre': ['Baie-Mahault','Baillif','Basse-Terre','Bouillante','Capesterre-Belle-Eau','Deshaies','Gourbeyre','Goyave','Lamentin','Petit-Bourg','Pointe-Noire','Saint-Claude','Sainte-Rose','Trois-Rivieres','Vieux-Fort','Vieux-Habitants'],
      'Marie-Galante': ['Capesterre-de-Marie-Galante','Grand-Bourg','Saint-Louis'],
      'Les Saintes': ['Terre-de-Haut','Terre-de-Bas'],
      'La Desirade': ['La Desirade']
    };
    var html = '<option value="">Choisir...</option>';
    for (var g in groups) {
      html += '<optgroup label="' + g + '">';
      for (var i = 0; i < groups[g].length; i++) {
        var c = groups[g][i];
        html += '<option' + (c === selected ? ' selected' : '') + '>' + c + '</option>';
      }
      html += '</optgroup>';
    }
    return html;
  },

  changePassword: async function() {
    var pw = document.getElementById('profile-new-password').value;
    var confirm = document.getElementById('profile-confirm-password').value;
    if (!pw || pw.length < 6) { UI.toast('Min 6 caractères', 'warning'); return; }
    if (pw !== confirm) { UI.toast('Mots de passe différents', 'warning'); return; }
    var r = await App.supabase.auth.updateUser({ password: pw });
    if (r.error) UI.toast('Erreur', 'error');
    else { UI.toast('Mot de passe modifié !', 'success'); document.getElementById('profile-new-password').value = ''; document.getElementById('profile-confirm-password').value = ''; }
  },

  changeCommune: async function() {
    var commune = document.getElementById('profile-commune').value;
    if (!commune) { UI.toast('Choisissez', 'warning'); return; }
    var r = await App.supabase.from('profiles').update({ commune: commune }).eq('id', App.currentUser.id);
    if (r.error) UI.toast('Erreur', 'error');
    else { App.currentProfile.commune = commune; UI.toast('Commune mise à jour !', 'success'); }
  },

  showMyReports: function() {
    var userId = App.currentUser ? App.currentUser.id : null; if (!userId) return;
    var myReports = App.reports.filter(function(r) { return r.user_id === userId; }).sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var container = document.getElementById('my-reports-content');
    if (myReports.length === 0) {
      container.innerHTML = '<div class="empty" style="padding:40px"><span><i class="fas fa-inbox fa-2x"></i></span><h3>Aucun signalement</h3></div>';
    } else {
      var html = '<div style="padding:16px">';
      for (var i = 0; i < myReports.length; i++) {
        var r = myReports[i], cat = App.categories[r.category] || App.categories.other, status = App.statuses[r.status] || App.statuses.pending;
        html += '<div class="adm" id="my-report-' + r.id + '"><div class="adm__info" style="cursor:pointer" onclick="UI.closeModal(\'modal-my-reports\');Reports.openDetail(\'' + r.id + '\')"><div class="adm__title">' + App.esc(r.title) + '</div><div class="adm__meta"><span class="badge badge--cat">' + cat.label + '</span> <span class="badge badge--' + r.status + '">' + status.label + '</span> ' + App.ago(r.created_at) + '</div></div><span style="font-size:.78rem;color:var(--orange)"><i class="fas fa-arrow-up"></i> ' + (r.upvotes || 0) + '</span><button class="btn btn--danger" onclick="Auth.deleteOwnReport(\'' + r.id + '\')" title="Supprimer"><i class="fas fa-trash"></i></button></div>';
      }
      container.innerHTML = html + '</div>';
    }
    UI.openModal('modal-my-reports');
  },

  deleteOwnReport: async function(reportId) {
    if (!App.currentUser) return;
    var report = App.reports.find(function(r) { return r.id === reportId; });
    if (!report || report.user_id !== App.currentUser.id) { UI.toast('Non autorisé', 'error'); return; }
    if (!confirm('Supprimer ?')) return;
    try {
      await fetch('/api/mark-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: App.currentUser.id }) });
      await App.supabase.from('comments').delete().eq('report_id', reportId);
      await App.supabase.from('votes').delete().eq('report_id', reportId);
      var r = await App.supabase.from('reports').delete().eq('id', reportId);
      if (r.error) { UI.toast('Erreur', 'error'); return; }
      UI.toast('Supprimé', 'success');
      App.reports = App.reports.filter(function(x) { return x.id !== reportId; });
      MapManager.removeReport(reportId); Reports.renderList(); Reports.updateStats();
      var el = document.getElementById('my-report-' + reportId); if (el) el.remove();
    } catch (e) { UI.toast('Erreur', 'error'); }
  },

  showAdmin: function() {
    if (!App.currentProfile || App.currentProfile.role !== 'admin') { UI.toast('Accès refusé', 'error'); return; }
    var container = document.getElementById('admin-reports-list');
    var reports = App.reports.slice().sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    if (reports.length === 0) { container.innerHTML = '<div class="empty"><h3>Aucun signalement</h3></div>'; }
    else {
      var html = '';
      for (var i = 0; i < reports.length; i++) {
        var r = reports[i], cat = App.categories[r.category] || App.categories.other;
        html += '<div class="adm" id="adm-' + r.id + '"><div class="adm__info"><div class="adm__title">' + App.esc(r.title) + '</div><div class="adm__meta">' + cat.label + ' • ' + (r.commune || '') + ' • ' + App.ago(r.created_at) + '</div></div><select onchange="Auth.updateStatus(\'' + r.id + '\',this.value)"><option value="pending"' + (r.status === 'pending' ? ' selected' : '') + '>En attente</option><option value="acknowledged"' + (r.status === 'acknowledged' ? ' selected' : '') + '>Pris en compte</option><option value="in_progress"' + (r.status === 'in_progress' ? ' selected' : '') + '>En cours</option><option value="resolved"' + (r.status === 'resolved' ? ' selected' : '') + '>Résolu</option><option value="rejected"' + (r.status === 'rejected' ? ' selected' : '') + '>Rejeté</option></select><button class="btn btn--danger" onclick="Auth.deleteReport(\'' + r.id + '\')" title="Supprimer"><i class="fas fa-trash"></i></button><div style="width:100%"><textarea placeholder="Réponse admin..." onchange="Auth.updateResponse(\'' + r.id + '\',this.value)">' + (r.admin_response || '') + '</textarea></div></div>';
      }
      container.innerHTML = html;
    }
    UI.openModal('modal-admin');
  },

  updateStatus: async function(reportId, status) {
    var updates = { status: status, updated_at: new Date().toISOString() };
    if (status === 'resolved') updates.resolved_at = new Date().toISOString();
    var r = await App.supabase.from('reports').update(updates).eq('id', reportId);
    if (r.error) UI.toast('Erreur', 'error'); else UI.toast('Statut mis à jour', 'success');
  },

  updateResponse: async function(reportId, response) {
    var r = await App.supabase.from('reports').update({ admin_response: response, updated_at: new Date().toISOString() }).eq('id', reportId);
    if (r.error) UI.toast('Erreur', 'error'); else UI.toast('Réponse sauvegardée', 'success');
  },

  deleteReport: async function(reportId) {
    if (!confirm('Supprimer ?')) return;
    try {
      await App.supabase.from('comments').delete().eq('report_id', reportId);
      await App.supabase.from('votes').delete().eq('report_id', reportId);
      var r = await App.supabase.from('reports').delete().eq('id', reportId);
      if (r.error) { UI.toast('Erreur', 'error'); return; }
      UI.toast('Supprimé', 'success');
      App.reports = App.reports.filter(function(x) { return x.id !== reportId; });
      MapManager.removeReport(reportId); Reports.renderList(); Reports.updateStats();
      var el = document.getElementById('adm-' + reportId); if (el) el.remove();
    } catch (e) { UI.toast('Erreur', 'error'); }
  },

  deleteWikiArticle: async function(id) {
    if (!confirm('Supprimer cet article ?')) return;
    try {
      await App.supabase.from('wiki_comments').delete().eq('article_id', id);
      await App.supabase.from('wiki_votes').delete().eq('article_id', id);
      var r = await App.supabase.from('wiki_articles').delete().eq('id', id);
      if (r.error) throw r.error;
      UI.toast('Article supprimé', 'success');
      UI.closeModal('modal-wiki-article');
      UI.loadCommunityArticles();
    } catch (e) { UI.toast('Erreur', 'error'); }
  }
};
