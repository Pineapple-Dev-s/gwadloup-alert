var Auth = {
  init: async function() {
    var self = this;
    try {
      var result = await App.supabase.auth.getSession();
      if (result.data && result.data.session) {
        App.currentUser = result.data.session.user;
        await this.loadProfile();
        this.updateUI(true);
      } else {
        this.updateUI(false);
      }

      App.supabase.auth.onAuthStateChange(function(event, session) {
        if (event === 'SIGNED_IN' && session) {
          App.currentUser = session.user;
          self.loadProfile().then(function() { self.updateUI(true); });
        } else if (event === 'SIGNED_OUT') {
          App.currentUser = null;
          App.currentProfile = null;
          self.updateUI(false);
        }
      });
    } catch(e) {
      console.error('Auth init error:', e);
    }
    this.bind();
  },

  bind: function() {
    var self = this;
    var btnLogin = document.getElementById('btn-login');
    var btnRegister = document.getElementById('btn-register');
    var btnLogout = document.getElementById('btn-logout');
    var btnProfile = document.getElementById('btn-profile');
    var btnMyReports = document.getElementById('btn-my-reports');
    var btnAdmin = document.getElementById('btn-admin');
    var btnNewReport = document.getElementById('btn-new-report');
    var switchToRegister = document.getElementById('switch-to-register');
    var switchToLogin = document.getElementById('switch-to-login');

    if (btnLogin) btnLogin.addEventListener('click', function() { UI.openModal('modal-login'); });
    if (btnRegister) btnRegister.addEventListener('click', function() { UI.openModal('modal-register'); });
    if (btnLogout) btnLogout.addEventListener('click', function() { self.logout(); });
    if (btnProfile) btnProfile.addEventListener('click', function() { self.showProfile(); });
    if (btnMyReports) btnMyReports.addEventListener('click', function() { self.showMyReports(); });
    if (btnAdmin) btnAdmin.addEventListener('click', function() { self.showAdmin(); });
    if (btnNewReport) btnNewReport.addEventListener('click', function() { UI.openReportModal(); });

    if (switchToRegister) switchToRegister.addEventListener('click', function(e) { e.preventDefault(); UI.closeModal('modal-login'); UI.openModal('modal-register'); });
    if (switchToLogin) switchToLogin.addEventListener('click', function(e) { e.preventDefault(); UI.closeModal('modal-register'); UI.openModal('modal-login'); });

    var loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', function(e) { e.preventDefault(); self.login(); });

    var registerForm = document.getElementById('register-form');
    if (registerForm) registerForm.addEventListener('submit', function(e) { e.preventDefault(); self.register(); });

    var menuBtn = document.getElementById('user-menu-btn');
    if (menuBtn) menuBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var dd = document.getElementById('user-dropdown');
      if (dd) dd.classList.toggle('open');
    });
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.umenu')) {
        var dd = document.getElementById('user-dropdown');
        if (dd) dd.classList.remove('open');
      }
    });
  },

  loadProfile: async function() {
    if (!App.currentUser) return;
    try {
      var result = await App.supabase.from('profiles').select('*').eq('id', App.currentUser.id).single();
      if (result.data) {
        App.currentProfile = result.data;
      } else {
        var meta = App.currentUser.user_metadata || {};
        var ins = await App.supabase.from('profiles').insert({
          id: App.currentUser.id,
          username: meta.username || App.currentUser.email.split('@')[0],
          commune: meta.commune || '',
          role: 'citizen',
          reports_count: 0,
          reputation: 0
        }).select().single();
        if (ins.data) App.currentProfile = ins.data;
      }
    } catch(e) {
      console.error('Load profile error:', e);
    }
  },

  updateUI: function(loggedIn) {
    var authBtns = document.getElementById('auth-buttons');
    var userMenu = document.getElementById('user-menu');
    var newReportBtn = document.getElementById('btn-new-report');
    var newArticleBtn = document.getElementById('btn-new-article');
    var adminSection = document.getElementById('admin-section');

    if (loggedIn && App.currentProfile) {
      if (authBtns) authBtns.style.display = 'none';
      if (userMenu) userMenu.style.display = 'block';
      if (newReportBtn) newReportBtn.style.display = 'inline-flex';
      if (newArticleBtn) newArticleBtn.style.display = 'inline-flex';

      var name = App.currentProfile.username || 'Citoyen';
      var initial = name.charAt(0).toUpperCase();
      var els = { 'user-avatar': initial, 'dropdown-avatar': initial, 'user-display-name': name, 'dropdown-name': name, 'dropdown-rep': (App.currentProfile.reputation || 0) + ' pts' };
      for (var id in els) { var el = document.getElementById(id); if (el) el.textContent = els[id]; }
      if (adminSection) adminSection.style.display = App.currentProfile.role === 'admin' ? 'block' : 'none';
    } else {
      if (authBtns) authBtns.style.display = 'flex';
      if (userMenu) userMenu.style.display = 'none';
      if (newReportBtn) newReportBtn.style.display = 'none';
      if (newArticleBtn) newArticleBtn.style.display = 'none';
    }
  },

  login: async function() {
    var email = document.getElementById('login-email').value.trim();
    var password = document.getElementById('login-password').value;
    var errEl = document.getElementById('login-error');
    var btn = document.getElementById('btn-login-submit');

    if (!email || !password) { this._showError(errEl, 'Remplissez tous les champs'); return; }
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Connexion...';

    try {
      var result = await App.supabase.auth.signInWithPassword({ email: email, password: password });
      if (result.error) {
        var msg = result.error.message;
        if (msg.indexOf('Invalid login') !== -1) msg = 'Email ou mot de passe incorrect';
        if (msg.indexOf('Email not confirmed') !== -1) msg = 'Vérifiez votre email pour confirmer votre compte';
        this._showError(errEl, msg);
      } else {
        UI.closeModal('modal-login');
        UI.toast('Connecté !', 'success');
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
      }
    } catch(e) { this._showError(errEl, 'Erreur de connexion'); }
    btn.disabled = false; btn.innerHTML = 'Se connecter';
  },

  register: async function() {
    var username = document.getElementById('register-username').value.trim();
    var email = document.getElementById('register-email').value.trim();
    var commune = document.getElementById('register-commune').value;
    var password = document.getElementById('register-password').value;
    var confirm = document.getElementById('register-password-confirm').value;
    var errEl = document.getElementById('register-error');
    var btn = document.getElementById('btn-register-submit');

    if (!username || !email || !password) { this._showError(errEl, 'Remplissez tous les champs obligatoires'); return; }
    if (username.length < 3) { this._showError(errEl, 'Pseudo trop court (min 3)'); return; }
    if (password.length < 6) { this._showError(errEl, 'Mot de passe trop court (min 6)'); return; }
    if (password !== confirm) { this._showError(errEl, 'Les mots de passe ne correspondent pas'); return; }

    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Création...';

    try {
      var result = await App.supabase.auth.signUp({ email: email, password: password, options: { data: { username: username, commune: commune } } });
      if (result.error) {
        var msg = result.error.message;
        if (msg.indexOf('already registered') !== -1) msg = 'Cet email est déjà utilisé';
        this._showError(errEl, msg);
      } else {
        UI.closeModal('modal-register');
        UI.toast('Compte créé ! Vérifiez votre email.', 'success');
      }
    } catch(e) { this._showError(errEl, 'Erreur lors de l\'inscription'); }
    btn.disabled = false; btn.innerHTML = 'Créer mon compte';
  },

  logout: async function() {
    await App.supabase.auth.signOut();
    App.currentUser = null;
    App.currentProfile = null;
    this.updateUI(false);
    UI.toast('Déconnecté', 'info');
    var dd = document.getElementById('user-dropdown');
    if (dd) dd.classList.remove('open');
  },

  showProfile: function() {
    var p = App.currentProfile;
    if (!p) return;
    var dd = document.getElementById('user-dropdown');
    if (dd) dd.classList.remove('open');

    var initial = (p.username || 'C').charAt(0).toUpperCase();
    var level = this._getLevel(p.reputation || 0);
    var myReports = App.reports.filter(function(r) { return r.user_id === App.currentUser.id; });
    var resolved = myReports.filter(function(r) { return r.status === 'resolved'; }).length;
    var communes = this._getCommuneOptions();

    var html = '<div class="profile">' +
      '<div class="profile__header">' +
        '<div class="profile__banner"></div>' +
        '<div class="profile__avatar-wrap"><div class="profile__avatar">' + initial + '</div><span class="profile__level">Nv.' + level.num + '</span></div>' +
        '<div class="profile__name">' + App.esc(p.username) + '</div>' +
        '<div class="profile__email">' + App.esc(App.currentUser.email) + '</div>' +
        (p.commune ? '<div class="profile__commune"><i class="fas fa-map-pin"></i> ' + App.esc(p.commune) + '</div>' : '') +
        '<div class="profile__joined"><i class="fas fa-calendar"></i> Membre depuis ' + new Date(p.created_at).toLocaleDateString('fr-FR') + '</div>' +
      '</div>' +
      '<div class="profile__stats">' +
        '<div class="profile__stat"><div class="profile__stat-value">' + (p.reports_count || 0) + '</div><div class="profile__stat-icon"><i class="fas fa-flag"></i></div><div class="profile__stat-label">Signalements</div></div>' +
        '<div class="profile__stat profile__stat--green"><div class="profile__stat-value">' + resolved + '</div><div class="profile__stat-icon"><i class="fas fa-check"></i></div><div class="profile__stat-label">Résolus</div></div>' +
        '<div class="profile__stat profile__stat--purple"><div class="profile__stat-value">' + level.name + '</div><div class="profile__stat-icon"><i class="fas fa-star"></i></div><div class="profile__stat-label">Niveau</div></div>' +
        '<div class="profile__stat profile__stat--yellow"><div class="profile__stat-value">' + (p.reputation || 0) + '</div><div class="profile__stat-icon"><i class="fas fa-trophy"></i></div><div class="profile__stat-label">Réputation</div></div>' +
      '</div>' +
      '<div class="profile__section"><div class="profile__section-title"><i class="fas fa-award"></i> Badges</div><div id="profile-badges-container"></div></div>' +
      '<div class="profile__section"><div class="profile__section-title"><i class="fas fa-cog"></i> Paramètres</div>' +
        '<div class="profile__setting"><label>Commune</label><select class="inp" id="profile-commune">' + communes + '</select></div>' +
        '<div class="profile__setting"><label>Nouveau mot de passe</label><input type="password" class="inp" id="profile-new-password" placeholder="Laisser vide pour ne pas changer" minlength="6"></div>' +
        '<button class="btn btn--primary" id="btn-save-profile" style="margin-top:8px"><i class="fas fa-save"></i> Sauvegarder</button>' +
      '</div></div>';

    var container = document.getElementById('profile-content');
    if (container) container.innerHTML = html;
    UI.openModal('modal-profile');

    var communeSel = document.getElementById('profile-commune');
    if (communeSel && p.commune) communeSel.value = p.commune;

    if (typeof Badges !== 'undefined') {
      Badges.computeStats().then(function(stats) {
        var badgesEl = document.getElementById('profile-badges-container');
        if (badgesEl) badgesEl.innerHTML = Badges.renderGrid(App.currentProfile, stats);
      });
    }

    var saveBtn = document.getElementById('btn-save-profile');
    if (saveBtn) saveBtn.addEventListener('click', function() { Auth._saveProfile(); });
  },

  _saveProfile: async function() {
    var commune = document.getElementById('profile-commune');
    var newPwd = document.getElementById('profile-new-password');

    if (commune && commune.value !== (App.currentProfile.commune || '')) {
      var res = await App.supabase.from('profiles').update({ commune: commune.value }).eq('id', App.currentUser.id);
      if (!res.error) { App.currentProfile.commune = commune.value; UI.toast('Commune mise à jour', 'success'); }
    }

    if (newPwd && newPwd.value && newPwd.value.length >= 6) {
      var res = await App.supabase.auth.updateUser({ password: newPwd.value });
      if (res.error) { UI.toast('Erreur mot de passe: ' + res.error.message, 'error'); }
      else { newPwd.value = ''; UI.toast('Mot de passe mis à jour', 'success'); }
    }
  },

  showMyReports: function() {
    var dd = document.getElementById('user-dropdown');
    if (dd) dd.classList.remove('open');
    if (!App.currentUser) return;
    var myReports = App.reports.filter(function(r) { return r.user_id === App.currentUser.id; });
    var container = document.getElementById('my-reports-content');
    if (!container) return;

    if (myReports.length === 0) {
      container.innerHTML = '<div class="empty"><i class="fas fa-inbox"></i><h3>Aucun signalement</h3><p>Vous n\'avez pas encore créé de signalement</p></div>';
    } else {
      var html = '<div style="padding:16px">';
      for (var i = 0; i < myReports.length; i++) {
        var r = myReports[i];
        var cat = App.categories[r.category] || App.categories.other;
        var status = App.statuses[r.status] || App.statuses.pending;
        html += '<div class="adm" style="cursor:pointer" onclick="UI.closeModal(\'modal-my-reports\');Reports.openDetail(\'' + r.id + '\')">' +
          '<div class="adm__info"><div class="adm__title">' + App.esc(r.title) + '</div>' +
          '<div class="adm__meta"><span class="badge badge--cat">' + cat.label + '</span> <span class="badge badge--' + r.status + '">' + status.label + '</span> · ' + App.ago(r.created_at) + '</div></div>' +
          '<span class="card__votes"><i class="fas fa-arrow-up"></i> ' + (r.upvotes || 0) + '</span></div>';
      }
      html += '</div>';
      container.innerHTML = html;
    }
    UI.openModal('modal-my-reports');
  },

  showAdmin: function() {
    var dd = document.getElementById('user-dropdown');
    if (dd) dd.classList.remove('open');
    if (!App.currentProfile || App.currentProfile.role !== 'admin') { UI.toast('Accès refusé', 'error'); return; }

    var container = document.getElementById('admin-reports-list');
    if (!container) return;

    // Banner admin section
    var html = UI.showBannerAdmin();

    html += '<div style="border-top:1px solid var(--border);margin:16px 0;padding-top:16px"></div>';
    html += '<h3 style="margin-bottom:12px;font-size:.9rem;display:flex;align-items:center;gap:6px"><i class="fas fa-shield-alt" style="color:var(--purple)"></i> Gestion des signalements (' + App.reports.length + ')</h3>';

    for (var i = 0; i < App.reports.length; i++) {
      var r = App.reports[i];
      html += '<div class="adm">' +
        '<div class="adm__info"><div class="adm__title">' + App.esc(r.title) + '</div>' +
        '<div class="adm__meta">' + (r.commune || '') + ' · ' + App.ago(r.created_at) + '</div></div>' +
        '<select onchange="Auth.updateStatus(\'' + r.id + '\',this.value)">' +
          '<option value="pending"' + (r.status === 'pending' ? ' selected' : '') + '>En attente</option>' +
          '<option value="acknowledged"' + (r.status === 'acknowledged' ? ' selected' : '') + '>Vu</option>' +
          '<option value="in_progress"' + (r.status === 'in_progress' ? ' selected' : '') + '>En cours</option>' +
          '<option value="resolved"' + (r.status === 'resolved' ? ' selected' : '') + '>Résolu</option>' +
          '<option value="rejected"' + (r.status === 'rejected' ? ' selected' : '') + '>Rejeté</option>' +
        '</select>' +
        '<button class="btn btn--danger" onclick="Auth.deleteReport(\'' + r.id + '\')"><i class="fas fa-trash"></i></button>' +
        '<textarea placeholder="Réponse officielle..." onchange="Auth.updateResponse(\'' + r.id + '\',this.value)">' + App.esc(r.admin_response || '') + '</textarea>' +
      '</div>';
    }
    container.innerHTML = html;
    UI.openModal('modal-admin');
  },

  updateStatus: async function(id, status) {
    var updates = { status: status, updated_at: new Date().toISOString() };
    if (status === 'resolved') updates.resolved_at = new Date().toISOString();
    var result = await App.supabase.from('reports').update(updates).eq('id', id);
    if (result.error) { UI.toast('Erreur', 'error'); } else {
      UI.toast('Statut mis à jour', 'success');
      var report = App.reports.find(function(r) { return r.id === id; });
      if (report) report.status = status;
      if (typeof Reports !== 'undefined') { Reports.renderList(); Reports.updateStats(); }
    }
  },

  updateResponse: async function(id, response) {
    await App.supabase.from('reports').update({ admin_response: response }).eq('id', id);
    var report = App.reports.find(function(r) { return r.id === id; });
    if (report) report.admin_response = response;
    UI.toast('Réponse enregistrée', 'success');
  },

  deleteReport: async function(id) {
    if (!confirm('Supprimer ce signalement ?')) return;
    await App.supabase.from('comments').delete().eq('report_id', id);
    await App.supabase.from('votes').delete().eq('report_id', id);
    var result = await App.supabase.from('reports').delete().eq('id', id);
    if (result.error) { UI.toast('Erreur', 'error'); } else {
      UI.toast('Supprimé', 'success');
      App.reports = App.reports.filter(function(r) { return r.id !== id; });
      if (typeof MapManager !== 'undefined') MapManager.removeReport(id);
      if (typeof Reports !== 'undefined') { Reports.renderList(); Reports.updateStats(); }
      this.showAdmin();
    }
  },

  deleteWikiArticle: async function(id) {
    if (!confirm('Supprimer cet article ?')) return;
    try {
      await App.supabase.from('wiki_comments').delete().eq('article_id', id);
      await App.supabase.from('wiki_votes').delete().eq('article_id', id);
      var result = await App.supabase.from('wiki_articles').delete().eq('id', id);
      if (result.error) throw result.error;
      UI.toast('Article supprimé', 'success');
      UI.closeModal('modal-wiki-article');
      UI.loadCommunityArticles();
    } catch(e) { UI.toast('Erreur suppression', 'error'); }
  },

  _showError: function(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  },

  _getLevel: function(rep) {
    if (rep >= 5000) return { num: 10, name: 'Légende' };
    if (rep >= 3000) return { num: 9, name: 'Expert' };
    if (rep >= 2000) return { num: 8, name: 'Maître' };
    if (rep >= 1500) return { num: 7, name: 'Vétéran' };
    if (rep >= 1000) return { num: 6, name: 'Confirmé' };
    if (rep >= 700) return { num: 5, name: 'Engagé' };
    if (rep >= 400) return { num: 4, name: 'Actif' };
    if (rep >= 200) return { num: 3, name: 'Motivé' };
    if (rep >= 50) return { num: 2, name: 'Débutant' };
    return { num: 1, name: 'Nouveau' };
  },

  _getCommuneOptions: function() {
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
      for (var i = 0; i < groups[g].length; i++) html += '<option>' + groups[g][i] + '</option>';
      html += '</optgroup>';
    }
    return html;
  }
};
