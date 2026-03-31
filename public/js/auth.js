var Auth = {
  init: function() {
    this.bind();
    if (App.supabase) {
      App.supabase.auth.onAuthStateChange(function(event, session) {
        if (session && session.user) {
          App.currentUser = session.user;
          Auth.loadProfile();
        } else {
          App.currentUser = null;
          App.currentProfile = null;
          Auth.updateUI(false);
        }
      });
      // Check existing session
      App.supabase.auth.getSession().then(function(result) {
        if (result.data && result.data.session) {
          App.currentUser = result.data.session.user;
          Auth.loadProfile();
        } else {
          Auth.updateUI(false);
        }
      });
    } else {
      Auth.updateUI(false);
    }
  },

  bind: function() {
    var self = this;

    // Login button
    var btnLogin = document.getElementById('btn-login');
    if (btnLogin) btnLogin.addEventListener('click', function() { UI.openModal('modal-login'); });

    // Register button
    var btnRegister = document.getElementById('btn-register');
    if (btnRegister) btnRegister.addEventListener('click', function() { UI.openModal('modal-register'); });

    // Logout
    var btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', function() { self.logout(); });

    // Profile
    var btnProfile = document.getElementById('btn-profile');
    if (btnProfile) btnProfile.addEventListener('click', function() { self.showProfile(); });

    // My reports
    var btnMyReports = document.getElementById('btn-my-reports');
    if (btnMyReports) btnMyReports.addEventListener('click', function() { self.showMyReports(); });

    // Admin
    var btnAdmin = document.getElementById('btn-admin');
    if (btnAdmin) btnAdmin.addEventListener('click', function() { self.showAdmin(); });

    // Switch between login/register
    var switchToRegister = document.getElementById('switch-to-register');
    if (switchToRegister) switchToRegister.addEventListener('click', function(e) { e.preventDefault(); UI.closeModal('modal-login'); UI.openModal('modal-register'); });

    var switchToLogin = document.getElementById('switch-to-login');
    if (switchToLogin) switchToLogin.addEventListener('click', function(e) { e.preventDefault(); UI.closeModal('modal-register'); UI.openModal('modal-login'); });

    // Login form
    var loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', function(e) { e.preventDefault(); self.login(); });

    // Register form
    var registerForm = document.getElementById('register-form');
    if (registerForm) registerForm.addEventListener('submit', function(e) { e.preventDefault(); self.register(); });

    // User menu toggle
    var userMenuBtn = document.getElementById('user-menu-btn');
    if (userMenuBtn) {
      userMenuBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var dropdown = document.getElementById('user-dropdown');
        if (dropdown) dropdown.classList.toggle('open');
      });
    }

    // Close dropdown on outside click
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.umenu')) {
        var dropdown = document.getElementById('user-dropdown');
        if (dropdown) dropdown.classList.remove('open');
      }
    });

    // Anon login link in report form
    var anonLink = document.getElementById('anon-login-link');
    if (anonLink) {
      anonLink.addEventListener('click', function(e) {
        e.preventDefault();
        UI.closeModal('modal-report');
        UI.openModal('modal-login');
      });
    }
  },

  loadProfile: async function() {
    if (!App.currentUser || !App.supabase) return;
    try {
      var result = await App.supabase.from('profiles').select('*').eq('id', App.currentUser.id).maybeSingle();
      if (result.data) {
        App.currentProfile = result.data;
      } else {
        // Create profile
        var meta = App.currentUser.user_metadata || {};
        var newProfile = {
          id: App.currentUser.id,
          username: meta.username || meta.name || App.currentUser.email.split('@')[0],
          commune: meta.commune || '',
          role: 'citizen',
          reports_count: 0,
          reputation: 0
        };
        var ins = await App.supabase.from('profiles').insert(newProfile).select().single();
        if (ins.data) App.currentProfile = ins.data;
        else App.currentProfile = newProfile;
      }
      this.updateUI(true);
    } catch(e) {
      console.error('Load profile error:', e);
      this.updateUI(true);
    }
  },

  updateUI: function(loggedIn) {
    var authButtons = document.getElementById('auth-buttons');
    var userMenu = document.getElementById('user-menu');
    var btnNewArticle = document.getElementById('btn-new-article');
    var adminSection = document.getElementById('admin-section');

    // IMPORTANT: btn-new-report is ALWAYS visible — NEVER hide it
    // It's always in the DOM and always shown

    if (loggedIn && App.currentProfile) {
      if (authButtons) authButtons.style.display = 'none';
      if (userMenu) userMenu.style.display = '';

      // Update display
      var initial = App.currentProfile.username ? App.currentProfile.username.charAt(0).toUpperCase() : 'C';
      var name = App.currentProfile.username || 'Citoyen';
      var rep = (App.currentProfile.reputation || 0) + ' pts';

      var avatarEl = document.getElementById('user-avatar');
      var nameEl = document.getElementById('user-display-name');
      var dropAvatar = document.getElementById('dropdown-avatar');
      var dropName = document.getElementById('dropdown-name');
      var dropRep = document.getElementById('dropdown-rep');

      if (avatarEl) avatarEl.textContent = initial;
      if (nameEl) nameEl.textContent = name;
      if (dropAvatar) dropAvatar.textContent = initial;
      if (dropName) dropName.textContent = name;
      if (dropRep) dropRep.textContent = rep;

      // Show article button for logged in users
      if (btnNewArticle) btnNewArticle.style.display = '';

      // Admin
      if (adminSection) {
        adminSection.style.display = App.currentProfile.role === 'admin' ? '' : 'none';
      }
    } else {
      if (authButtons) authButtons.style.display = '';
      if (userMenu) userMenu.style.display = 'none';
      if (btnNewArticle) btnNewArticle.style.display = 'none';
      if (adminSection) adminSection.style.display = 'none';
    }

    // Update anon notice in report form
    var anonNotice = document.getElementById('anon-notice');
    if (anonNotice) anonNotice.style.display = loggedIn ? 'none' : 'block';

    // Hide photo upload for anonymous users
    var photoField = document.getElementById('photo-field');
    if (photoField) photoField.style.display = loggedIn ? '' : 'none';
  },

  login: async function() {
    var email = document.getElementById('login-email').value.trim();
    var password = document.getElementById('login-password').value;
    var errorEl = document.getElementById('login-error');
    var btn = document.getElementById('btn-login-submit');

    if (!email || !password) { this._showError(errorEl, 'Remplissez tous les champs'); return; }

    btn.disabled = true; btn.textContent = 'Connexion...';

    try {
      var result = await App.supabase.auth.signInWithPassword({ email: email, password: password });
      if (result.error) {
        var msg = result.error.message;
        if (msg.indexOf('Invalid login') !== -1) msg = 'Email ou mot de passe incorrect';
        else if (msg.indexOf('Email not confirmed') !== -1) msg = 'Confirmez votre email d\'abord (vérifiez vos spams)';
        this._showError(errorEl, msg);
      } else {
        UI.closeModal('modal-login');
        UI.toast('Connecté ! 👋', 'success');
      }
    } catch(e) {
      this._showError(errorEl, 'Erreur de connexion');
    }

    btn.disabled = false; btn.textContent = 'Se connecter';
  },

  register: async function() {
    var username = document.getElementById('register-username').value.trim();
    var email = document.getElementById('register-email').value.trim();
    var commune = document.getElementById('register-commune').value;
    var password = document.getElementById('register-password').value;
    var confirm = document.getElementById('register-password-confirm').value;
    var errorEl = document.getElementById('register-error');
    var btn = document.getElementById('btn-register-submit');

    if (!username || username.length < 3) { this._showError(errorEl, 'Pseudo : min 3 caractères'); return; }
    if (!email) { this._showError(errorEl, 'Email requis'); return; }
    if (!password || password.length < 6) { this._showError(errorEl, 'Mot de passe : min 6 caractères'); return; }
    if (password !== confirm) { this._showError(errorEl, 'Les mots de passe ne correspondent pas'); return; }

    btn.disabled = true; btn.textContent = 'Création...';

    try {
      var result = await App.supabase.auth.signUp({
        email: email,
        password: password,
        options: { data: { username: username, commune: commune } }
      });

      if (result.error) {
        var msg = result.error.message;
        if (msg.indexOf('already registered') !== -1) msg = 'Cet email est déjà utilisé';
        this._showError(errorEl, msg);
      } else {
        UI.closeModal('modal-register');
        UI.toast('Compte créé ! Vérifiez votre email pour confirmer 📧', 'success');
      }
    } catch(e) {
      this._showError(errorEl, 'Erreur d\'inscription');
    }

    btn.disabled = false; btn.textContent = 'Créer mon compte';
  },

  logout: async function() {
    if (App.supabase) {
      await App.supabase.auth.signOut();
    }
    App.currentUser = null;
    App.currentProfile = null;
    this.updateUI(false);
    UI.toast('Déconnecté', 'info');
    var dropdown = document.getElementById('user-dropdown');
    if (dropdown) dropdown.classList.remove('open');
  },

  showProfile: function() {
    var dropdown = document.getElementById('user-dropdown');
    if (dropdown) dropdown.classList.remove('open');

    if (!App.currentProfile) return;
    var p = App.currentProfile;
    var level = this._getLevel(p.reputation || 0);
    var initial = p.username ? p.username.charAt(0).toUpperCase() : 'C';
    var joinDate = p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' }) : '';
    var resolved = 0;
    for (var i = 0; i < App.reports.length; i++) {
      if (App.reports[i].user_id === p.id && App.reports[i].status === 'resolved') resolved++;
    }

    var container = document.getElementById('profile-content');
    if (!container) return;

    var html = '<div class="profile">' +
      '<div class="profile__header">' +
        '<div class="profile__banner"></div>' +
        '<div class="profile__avatar-wrap">' +
          '<div class="profile__avatar">' + initial + '</div>' +
          '<div class="profile__level">Niv. ' + level.num + '</div>' +
        '</div>' +
        '<div class="profile__name">' + App.esc(p.username || 'Citoyen') + '</div>' +
        '<div class="profile__email">' + App.esc(App.currentUser.email || '') + '</div>' +
        (p.commune ? '<div class="profile__commune"><i class="fas fa-map-marker-alt"></i> ' + App.esc(p.commune) + '</div>' : '') +
        '<div class="profile__joined"><i class="fas fa-calendar"></i> Membre depuis ' + joinDate + '</div>' +
      '</div>' +
      '<div class="profile__stats">' +
        '<div class="profile__stat"><div class="profile__stat-value">' + (p.reports_count || 0) + '</div><div class="profile__stat-icon"><i class="fas fa-flag"></i></div><div class="profile__stat-label">Signalements</div></div>' +
        '<div class="profile__stat profile__stat--green"><div class="profile__stat-value">' + resolved + '</div><div class="profile__stat-icon"><i class="fas fa-check"></i></div><div class="profile__stat-label">Résolus</div></div>' +
        '<div class="profile__stat profile__stat--purple"><div class="profile__stat-value">' + level.name + '</div><div class="profile__stat-icon"><i class="fas fa-medal"></i></div><div class="profile__stat-label">Niveau</div></div>' +
        '<div class="profile__stat profile__stat--yellow"><div class="profile__stat-value">' + (p.reputation || 0) + '</div><div class="profile__stat-icon"><i class="fas fa-star"></i></div><div class="profile__stat-label">Réputation</div></div>' +
      '</div>';

    // Badges section
    if (typeof Badges !== 'undefined') {
      html += '<div class="profile__section"><div class="profile__section-title"><i class="fas fa-award"></i> Badges</div>';
      Badges.computeStats().then(function(stats) {
        var badgesHtml = Badges.renderGrid(p, stats);
        var badgeSection = container.querySelector('.profile__section');
        if (badgeSection) badgeSection.innerHTML = '<div class="profile__section-title"><i class="fas fa-award"></i> Badges</div>' + badgesHtml;
      });
      html += '<p style="color:var(--text3);font-size:.8rem">Chargement badges...</p></div>';
    }

    // Settings
    html += '<div class="profile__section"><div class="profile__section-title"><i class="fas fa-cog"></i> Paramètres</div>' +
      '<div class="profile__setting"><label>Commune</label><select class="inp" id="profile-commune" onchange="Auth.updateCommune(this.value)">' + this._getCommuneOptions(p.commune) + '</select></div>' +
      '<div class="profile__setting"><label>Thème</label><button class="btn btn--outline" onclick="App.toggleTheme()"><i class="fas fa-moon"></i> Changer de thème</button></div>' +
      '<div class="profile__setting"><label>Mot de passe</label><button class="btn btn--outline" onclick="Auth.changePassword()"><i class="fas fa-key"></i> Changer</button></div>' +
      '</div></div>';

    container.innerHTML = html;
    UI.openModal('modal-profile');
  },

  showMyReports: function() {
    var dropdown = document.getElementById('user-dropdown');
    if (dropdown) dropdown.classList.remove('open');

    if (!App.currentUser) return;
    var container = document.getElementById('my-reports-content');
    if (!container) return;

    var myReports = App.reports.filter(function(r) { return r.user_id === App.currentUser.id; });

    if (myReports.length === 0) {
      container.innerHTML = '<div class="empty"><i class="fas fa-inbox"></i><h3>Aucun signalement</h3><p>Vous n\'avez pas encore créé de signalement</p></div>';
    } else {
      var html = '<div style="padding:16px">';
      for (var i = 0; i < myReports.length; i++) {
        var r = myReports[i];
        var cat = App.categories[r.category] || App.categories.other;
        var status = App.statuses[r.status] || App.statuses.pending;
        html += '<div class="adm" onclick="UI.closeModal(\'modal-my-reports\');Reports.openDetail(\'' + r.id + '\')" style="cursor:pointer">' +
          '<div class="adm__info"><div class="adm__title">' + App.esc(r.title) + '</div>' +
          '<div class="adm__meta"><span class="badge badge--cat">' + cat.label + '</span> <span class="badge badge--' + r.status + '">' + status.label + '</span> <span>' + App.ago(r.created_at) + '</span></div></div></div>';
      }
      html += '</div>';
      container.innerHTML = html;
    }

    UI.openModal('modal-my-reports');
  },

  showAdmin: function() {
    var dropdown = document.getElementById('user-dropdown');
    if (dropdown) dropdown.classList.remove('open');

    if (!App.currentProfile || App.currentProfile.role !== 'admin') return;

    var container = document.getElementById('admin-reports-list');
    if (!container) return;

    var html = '';
    if (typeof UI !== 'undefined' && UI.showBannerAdmin) {
      html += UI.showBannerAdmin();
    }

    html += '<h3 style="margin:16px 0 12px;font-size:.9rem"><i class="fas fa-flag" style="color:var(--orange);margin-right:6px"></i> Signalements (' + App.reports.length + ')</h3>';

    var sorted = App.reports.slice().sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });

    for (var i = 0; i < Math.min(sorted.length, 50); i++) {
      var r = sorted[i];
      var cat = App.categories[r.category] || App.categories.other;
      html += '<div class="adm" id="admin-report-' + r.id + '">' +
        '<div class="adm__info"><div class="adm__title">' + App.esc(r.title) + '</div>' +
        '<div class="adm__meta"><span class="badge badge--cat">' + cat.label + '</span> <span>' + (r.commune || 'N/A') + '</span> <span>' + App.ago(r.created_at) + '</span>' +
        (r.user_id === null ? ' <span style="color:var(--text3)"><i class="fas fa-user-secret"></i> Anon</span>' : '') +
        '</div></div>' +
        '<select onchange="Auth.updateStatus(\'' + r.id + '\',this.value)" style="margin-right:6px">' +
          '<option value="pending"' + (r.status === 'pending' ? ' selected' : '') + '>Attente</option>' +
          '<option value="acknowledged"' + (r.status === 'acknowledged' ? ' selected' : '') + '>Vu</option>' +
          '<option value="in_progress"' + (r.status === 'in_progress' ? ' selected' : '') + '>En cours</option>' +
          '<option value="resolved"' + (r.status === 'resolved' ? ' selected' : '') + '>Résolu</option>' +
          '<option value="rejected"' + (r.status === 'rejected' ? ' selected' : '') + '>Rejeté</option>' +
        '</select>' +
        '<button class="btn btn--danger" onclick="Auth.deleteReport(\'' + r.id + '\')" style="font-size:.7rem;padding:4px 8px"><i class="fas fa-trash"></i></button>' +
        '<div style="width:100%;margin-top:6px"><textarea placeholder="Réponse officielle..." id="admin-resp-' + r.id + '" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:var(--r);font-size:.75rem;background:var(--bg);color:var(--text);resize:vertical;min-height:32px">' + (r.admin_response || '') + '</textarea>' +
        '<button class="btn btn--primary" onclick="Auth.updateResponse(\'' + r.id + '\')" style="font-size:.68rem;padding:3px 8px;margin-top:4px">Envoyer réponse</button></div></div>';
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
      Reports.renderList(); Reports.updateStats();
    }
  },

  updateResponse: async function(id) {
    var textarea = document.getElementById('admin-resp-' + id);
    if (!textarea) return;
    var response = textarea.value.trim();
    if (!response) { UI.toast('Réponse vide', 'warning'); return; }
    var result = await App.supabase.from('reports').update({ admin_response: response }).eq('id', id);
    if (result.error) { UI.toast('Erreur', 'error'); } else {
      UI.toast('Réponse enregistrée', 'success');
      var report = App.reports.find(function(r) { return r.id === id; });
      if (report) report.admin_response = response;
    }
  },

  deleteReport: async function(id) {
    if (!confirm('Supprimer ce signalement ?')) return;
    try {
      await App.supabase.from('comments').delete().eq('report_id', id);
      await App.supabase.from('votes').delete().eq('report_id', id);
      var result = await App.supabase.from('reports').delete().eq('id', id);
      if (result.error) throw result.error;
      UI.toast('Supprimé', 'success');
      App.reports = App.reports.filter(function(r) { return r.id !== id; });
      MapManager.removeReport(id);
      Reports.renderList(); Reports.updateStats();
      var el = document.getElementById('admin-report-' + id);
      if (el) el.remove();
    } catch(e) { UI.toast('Erreur', 'error'); }
  },

  updateCommune: async function(commune) {
    if (!App.currentUser) return;
    await App.supabase.from('profiles').update({ commune: commune }).eq('id', App.currentUser.id);
    if (App.currentProfile) App.currentProfile.commune = commune;
    UI.toast('Commune mise à jour', 'success');
  },

  changePassword: async function() {
    var newPass = prompt('Nouveau mot de passe (min 6 caractères) :');
    if (!newPass || newPass.length < 6) { UI.toast('Min 6 caractères', 'warning'); return; }
    var result = await App.supabase.auth.updateUser({ password: newPass });
    if (result.error) { UI.toast('Erreur: ' + result.error.message, 'error'); }
    else { UI.toast('Mot de passe changé', 'success'); }
  },

  _getLevel: function(rep) {
    if (rep >= 5000) return { name: 'Légende', num: 10 };
    if (rep >= 3000) return { name: 'Expert', num: 9 };
    if (rep >= 2000) return { name: 'Maître', num: 8 };
    if (rep >= 1500) return { name: 'Vétéran', num: 7 };
    if (rep >= 1000) return { name: 'Confirmé', num: 6 };
    if (rep >= 700) return { name: 'Engagé', num: 5 };
    if (rep >= 400) return { name: 'Actif', num: 4 };
    if (rep >= 200) return { name: 'Motivé', num: 3 };
    if (rep >= 50) return { name: 'Débutant', num: 2 };
    return { name: 'Nouveau', num: 1 };
  },

  _getCommuneOptions: function(selected) {
    var communes = [
      { group: 'Grande-Terre', items: ['Les Abymes','Anse-Bertrand','Le Gosier','Le Moule','Morne-à-l\'Eau','Petit-Canal','Pointe-à-Pitre','Port-Louis','Saint-François','Sainte-Anne'] },
      { group: 'Basse-Terre', items: ['Baie-Mahault','Baillif','Basse-Terre','Bouillante','Capesterre-Belle-Eau','Deshaies','Gourbeyre','Goyave','Lamentin','Petit-Bourg','Pointe-Noire','Saint-Claude','Sainte-Rose','Trois-Rivières','Vieux-Fort','Vieux-Habitants'] },
      { group: 'Marie-Galante', items: ['Capesterre-de-Marie-Galante','Grand-Bourg','Saint-Louis'] },
      { group: 'Les Saintes', items: ['Terre-de-Haut','Terre-de-Bas'] },
      { group: 'La Désirade', items: ['La Désirade'] }
    ];
    var html = '<option value="">Choisir...</option>';
    for (var g = 0; g < communes.length; g++) {
      html += '<optgroup label="' + communes[g].group + '">';
      for (var c = 0; c < communes[g].items.length; c++) {
        var val = communes[g].items[c];
        html += '<option' + (val === selected ? ' selected' : '') + '>' + val + '</option>';
      }
      html += '</optgroup>';
    }
    return html;
  },

  _showError: function(el, msg) {
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }
};
