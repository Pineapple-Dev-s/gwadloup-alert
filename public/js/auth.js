var Auth = {
  init: async function() {
    try {
      var self = this;
      var { data: { session } } = await App.supabase.auth.getSession();
      if (session && session.user) {
        App.currentUser = session.user;
        await self.loadProfile();
        self.showIn();
      } else {
        self.showOut();
      }

      App.supabase.auth.onAuthStateChange(function(event, session) {
        if (event === 'SIGNED_IN' && session) {
          App.currentUser = session.user;
          self.loadProfile().then(function() { self.showIn(); });
        } else if (event === 'SIGNED_OUT') {
          App.currentUser = null;
          App.currentProfile = null;
          self.showOut();
        }
      });

      self.bind();
    } catch (e) {
      console.error('Auth init error:', e);
      this.showOut();
      this.bind();
    }
  },

  bind: function() {
    var self = this;

    var loginBtn = document.getElementById('btn-login');
    if (loginBtn) loginBtn.addEventListener('click', function() { UI.openModal('modal-login'); });

    var regBtn = document.getElementById('btn-register');
    if (regBtn) regBtn.addEventListener('click', function() { UI.openModal('modal-register'); });

    var switchToReg = document.getElementById('switch-to-register');
    if (switchToReg) switchToReg.addEventListener('click', function(e) {
      e.preventDefault(); UI.closeModal('modal-login'); UI.openModal('modal-register');
    });

    var switchToLog = document.getElementById('switch-to-login');
    if (switchToLog) switchToLog.addEventListener('click', function(e) {
      e.preventDefault(); UI.closeModal('modal-register'); UI.openModal('modal-login');
    });

    var loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', function(e) { e.preventDefault(); self.login(); });

    var regForm = document.getElementById('register-form');
    if (regForm) regForm.addEventListener('submit', function(e) { e.preventDefault(); self.register(); });

    var logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', function() { self.logout(); });

    var menuBtn = document.getElementById('user-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var dd = document.getElementById('user-dropdown');
        if (dd) dd.classList.toggle('open');
      });
    }
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.umenu')) {
        var dd = document.getElementById('user-dropdown');
        if (dd) dd.classList.remove('open');
      }
    });

    var profileBtn = document.getElementById('btn-profile');
    if (profileBtn) profileBtn.addEventListener('click', function() {
      document.getElementById('user-dropdown').classList.remove('open');
      self.showProfile();
    });

    var myReportsBtn = document.getElementById('btn-my-reports');
    if (myReportsBtn) myReportsBtn.addEventListener('click', function() {
      document.getElementById('user-dropdown').classList.remove('open');
      self.showMyReports();
    });

    var adminBtn = document.getElementById('btn-admin');
    if (adminBtn) adminBtn.addEventListener('click', function() {
      document.getElementById('user-dropdown').classList.remove('open');
      self.showAdmin();
    });
  },

  login: async function() {
    var email = document.getElementById('login-email').value.trim();
    var password = document.getElementById('login-password').value;
    var errEl = document.getElementById('login-error');
    var btn = document.getElementById('btn-login-submit');

    if (!email || !password) { errEl.textContent = 'Remplissez tous les champs'; errEl.style.display = 'block'; return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Connexion...';
    errEl.style.display = 'none';

    try {
      var { data, error } = await App.supabase.auth.signInWithPassword({ email: email, password: password });
      if (error) {
        var msg = 'Erreur de connexion';
        if (error.message.includes('Invalid login')) msg = 'Email ou mot de passe incorrect';
        else if (error.message.includes('Email not confirmed')) msg = 'Veuillez confirmer votre email';
        errEl.textContent = msg;
        errEl.style.display = 'block';
      } else {
        UI.closeModal('modal-login');
        UI.toast('Bienvenue !', 'success');
        document.getElementById('login-form').reset();
      }
    } catch (e) {
      errEl.textContent = 'Erreur réseau';
      errEl.style.display = 'block';
    }

    btn.disabled = false;
    btn.textContent = 'Se connecter';
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

    if (!username || !email || !password) {
      errEl.textContent = 'Remplissez tous les champs obligatoires';
      errEl.style.display = 'block'; return;
    }
    if (username.length < 3) {
      errEl.textContent = 'Pseudo: min 3 caractères';
      errEl.style.display = 'block'; return;
    }
    if (password !== confirm) {
      errEl.textContent = 'Les mots de passe ne correspondent pas';
      errEl.style.display = 'block'; return;
    }
    if (password.length < 6) {
      errEl.textContent = 'Mot de passe: min 6 caractères';
      errEl.style.display = 'block'; return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Création...';

    try {
      var { data, error } = await App.supabase.auth.signUp({
        email: email,
        password: password,
        options: { data: { username: username, commune: commune } }
      });

      if (error) {
        var msg = 'Erreur d\'inscription';
        if (error.message.includes('already registered')) msg = 'Cet email est déjà utilisé';
        else if (error.message.includes('valid email')) msg = 'Email invalide';
        errEl.textContent = msg;
        errEl.style.display = 'block';
      } else {
        if (commune && data.user) {
          await App.supabase.from('profiles').update({ commune: commune }).eq('id', data.user.id);
        }
        UI.closeModal('modal-register');
        if (data.session) {
          UI.toast('Bienvenue ' + username + ' !', 'success');
        } else {
          UI.toast('Vérifiez votre email pour confirmer', 'info');
        }
        document.getElementById('register-form').reset();
      }
    } catch (e) {
      errEl.textContent = 'Erreur réseau';
      errEl.style.display = 'block';
    }

    btn.disabled = false;
    btn.textContent = 'Creer mon compte';
  },

  logout: async function() {
    await App.supabase.auth.signOut();
    App.currentUser = null;
    App.currentProfile = null;
    this.showOut();
    UI.toast('Déconnecté', 'info');
  },

  loadProfile: async function() {
    if (!App.currentUser) return;
    try {
      var { data } = await App.supabase.from('profiles').select('*').eq('id', App.currentUser.id).single();
      if (data) App.currentProfile = data;
    } catch (e) {
      console.error('Load profile error:', e);
    }
  },

  showIn: function() {
    var authBtns = document.getElementById('auth-buttons');
    var userMenu = document.getElementById('user-menu');
    var newBtn = document.getElementById('btn-new-report');
    var wikiBtn = document.getElementById('btn-new-wiki');

    if (authBtns) authBtns.style.display = 'none';
    if (userMenu) userMenu.style.display = 'block';
    if (newBtn) newBtn.style.display = 'inline-flex';
    if (wikiBtn) wikiBtn.style.display = 'flex';

    var p = App.currentProfile;
    var name = (p && p.username) || (App.currentUser && App.currentUser.email ? App.currentUser.email.split('@')[0] : 'Citoyen');
    var initial = name.charAt(0).toUpperCase();

    var els = {
      'user-avatar': initial, 'dropdown-avatar': initial,
      'user-display-name': name, 'dropdown-name': name,
      'dropdown-rep': (p ? p.reputation || 0 : 0) + ' pts'
    };
    for (var id in els) {
      var el = document.getElementById(id);
      if (el) el.textContent = els[id];
    }

    var adminSection = document.getElementById('admin-section');
    if (adminSection) adminSection.style.display = (p && p.role === 'admin') ? 'block' : 'none';
  },

  showOut: function() {
    var authBtns = document.getElementById('auth-buttons');
    var userMenu = document.getElementById('user-menu');
    var newBtn = document.getElementById('btn-new-report');
    var wikiBtn = document.getElementById('btn-new-wiki');

    if (authBtns) authBtns.style.display = 'flex';
    if (userMenu) userMenu.style.display = 'none';
    if (newBtn) newBtn.style.display = 'none';
    if (wikiBtn) wikiBtn.style.display = 'none';
  },

  showProfile: function() {
    var p = App.currentProfile;
    var u = App.currentUser;
    if (!u) return;

    var name = (p && p.username) || u.email.split('@')[0];
    var initial = name.charAt(0).toUpperCase();
    var reportCount = p ? (p.reports_count || 0) : 0;
    var reputation = p ? (p.reputation || 0) : 0;
    var role = p ? (p.role || 'citizen') : 'citizen';
    var commune = (p && p.commune) || 'Non définie';

    var html = '<div style="padding:16px">' +
      '<div style="text-align:center;margin-bottom:16px">' +
      '<div class="umenu__av-lg" style="width:56px;height:56px;font-size:1.5rem;margin:0 auto 8px">' + initial + '</div>' +
      '<div style="font-weight:700;font-size:1rem">' + App.esc(name) + '</div>' +
      '<div style="font-size:.75rem;color:var(--text2)">' + App.esc(u.email) + '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">' +
      '<div class="sc"><div class="sc__v" style="font-size:1.2rem">' + reportCount + '</div><div class="sc__l">Signalements</div></div>' +
      '<div class="sc"><div class="sc__v" style="font-size:1.2rem;color:var(--green)">' + reputation + '</div><div class="sc__l">Reputation</div></div>' +
      '<div class="sc"><div class="sc__v" style="font-size:1.2rem;color:var(--purple)">' + role + '</div><div class="sc__l">Role</div></div>' +
      '</div>' +
      '<div class="field"><label>Commune</label><div style="display:flex;gap:6px">' +
      '<select class="inp" id="profile-commune" style="flex:1"><option value="">Choisir...</option>' +
      '<optgroup label="Grande-Terre"><option>Les Abymes</option><option>Anse-Bertrand</option><option>Le Gosier</option><option>Le Moule</option><option>Morne-a-l\'Eau</option><option>Petit-Canal</option><option>Pointe-a-Pitre</option><option>Port-Louis</option><option>Saint-Francois</option><option>Sainte-Anne</option></optgroup>' +
      '<optgroup label="Basse-Terre"><option>Baie-Mahault</option><option>Baillif</option><option>Basse-Terre</option><option>Bouillante</option><option>Capesterre-Belle-Eau</option><option>Deshaies</option><option>Gourbeyre</option><option>Goyave</option><option>Lamentin</option><option>Petit-Bourg</option><option>Pointe-Noire</option><option>Saint-Claude</option><option>Sainte-Rose</option><option>Trois-Rivieres</option><option>Vieux-Fort</option><option>Vieux-Habitants</option></optgroup>' +
      '<optgroup label="Marie-Galante"><option>Capesterre-de-Marie-Galante</option><option>Grand-Bourg</option><option>Saint-Louis</option></optgroup>' +
      '<optgroup label="Les Saintes"><option>Terre-de-Haut</option><option>Terre-de-Bas</option></optgroup>' +
      '<optgroup label="La Desirade"><option>La Desirade</option></optgroup>' +
      '</select>' +
      '<button class="btn btn--outline" onclick="Auth.changeCommune()">Modifier</button>' +
      '</div></div>' +
      '<div class="field"><label>Mot de passe</label><div style="display:flex;gap:6px">' +
      '<input type="password" class="inp" id="profile-new-password" placeholder="Nouveau mot de passe" style="flex:1">' +
      '<input type="password" class="inp" id="profile-confirm-password" placeholder="Confirmer" style="flex:1">' +
      '<button class="btn btn--outline" onclick="Auth.changePassword()">Modifier</button>' +
      '</div></div>' +
      '</div>';

    document.getElementById('profile-content').innerHTML = html;

    var communeSelect = document.getElementById('profile-commune');
    if (communeSelect && commune) {
      for (var i = 0; i < communeSelect.options.length; i++) {
        if (communeSelect.options[i].value === commune || communeSelect.options[i].text === commune) {
          communeSelect.selectedIndex = i; break;
        }
      }
    }

    UI.openModal('modal-profile');
  },

  changePassword: async function() {
    var pw = document.getElementById('profile-new-password').value;
    var confirm = document.getElementById('profile-confirm-password').value;
    if (!pw || pw.length < 6) { UI.toast('Min 6 caractères', 'warning'); return; }
    if (pw !== confirm) { UI.toast('Les mots de passe ne correspondent pas', 'warning'); return; }

    var { error } = await App.supabase.auth.updateUser({ password: pw });
    if (error) { UI.toast('Erreur: ' + error.message, 'error'); }
    else {
      UI.toast('Mot de passe modifié', 'success');
      document.getElementById('profile-new-password').value = '';
      document.getElementById('profile-confirm-password').value = '';
    }
  },

  changeCommune: async function() {
    var commune = document.getElementById('profile-commune').value;
    if (!commune) { UI.toast('Choisissez une commune', 'warning'); return; }

    var { error } = await App.supabase.from('profiles').update({ commune: commune }).eq('id', App.currentUser.id);
    if (error) { UI.toast('Erreur', 'error'); }
    else {
      App.currentProfile.commune = commune;
      UI.toast('Commune mise à jour', 'success');
    }
  },

  showMyReports: function() {
    var userId = App.currentUser ? App.currentUser.id : null;
    if (!userId) return;

    var myReports = App.reports.filter(function(r) { return r.user_id === userId; });
    myReports.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });

    var container = document.getElementById('my-reports-content');
    if (myReports.length === 0) {
      container.innerHTML = '<div class="empty" style="padding:40px"><span><i class="fas fa-inbox fa-2x"></i></span><h3>Aucun signalement</h3></div>';
    } else {
      var html = '<div style="padding:16px">';
      for (var i = 0; i < myReports.length; i++) {
        var r = myReports[i];
        var cat = App.categories[r.category] || App.categories.other;
        var status = App.statuses[r.status] || App.statuses.pending;
        html += '<div class="adm" style="cursor:pointer" onclick="UI.closeModal(\'modal-my-reports\');Reports.openDetail(\'' + r.id + '\')">' +
          '<div class="adm__info"><div class="adm__title">' + App.esc(r.title) + '</div>' +
          '<div class="adm__meta"><span class="badge badge--cat">' + cat.label + '</span> ' +
          '<span class="badge badge--' + r.status + '">' + status.label + '</span> ' +
          App.ago(r.created_at) + '</div></div>' +
          '<span style="font-size:.78rem;color:var(--orange)"><i class="fas fa-arrow-up"></i> ' + (r.upvotes || 0) + '</span>' +
          '</div>';
      }
      html += '</div>';
      container.innerHTML = html;
    }
    UI.openModal('modal-my-reports');
  },

  showAdmin: function() {
    if (!App.currentProfile || App.currentProfile.role !== 'admin') {
      UI.toast('Accès refusé', 'error'); return;
    }

    var container = document.getElementById('admin-reports-list');
    var reports = App.reports.slice().sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });

    if (reports.length === 0) {
      container.innerHTML = '<div class="empty"><h3>Aucun signalement</h3></div>';
    } else {
      var html = '';
      for (var i = 0; i < reports.length; i++) {
        var r = reports[i];
        var cat = App.categories[r.category] || App.categories.other;
        html += '<div class="adm" id="adm-' + r.id + '">' +
          '<div class="adm__info">' +
          '<div class="adm__title">' + App.esc(r.title) + '</div>' +
          '<div class="adm__meta">' + cat.label + ' • ' + (r.commune || '') + ' • ' + App.ago(r.created_at) + '</div>' +
          '</div>' +
          '<select onchange="Auth.updateStatus(\'' + r.id + '\',this.value)">' +
          '<option value="pending"' + (r.status === 'pending' ? ' selected' : '') + '>En attente</option>' +
          '<option value="acknowledged"' + (r.status === 'acknowledged' ? ' selected' : '') + '>Pris en compte</option>' +
          '<option value="in_progress"' + (r.status === 'in_progress' ? ' selected' : '') + '>En cours</option>' +
          '<option value="resolved"' + (r.status === 'resolved' ? ' selected' : '') + '>Résolu</option>' +
          '<option value="rejected"' + (r.status === 'rejected' ? ' selected' : '') + '>Rejeté</option>' +
          '</select>' +
          '<button class="btn btn--ghost" style="color:var(--red)" onclick="Auth.deleteReport(\'' + r.id + '\')" title="Supprimer"><i class="fas fa-trash"></i></button>' +
          '<div style="width:100%"><textarea placeholder="Réponse admin..." onchange="Auth.updateResponse(\'' + r.id + '\',this.value)">' + (r.admin_response || '') + '</textarea></div>' +
          '</div>';
      }
      container.innerHTML = html;
    }
    UI.openModal('modal-admin');
  },

  updateStatus: async function(reportId, status) {
    var updates = { status: status, updated_at: new Date().toISOString() };
    if (status === 'resolved') updates.resolved_at = new Date().toISOString();

    var { error } = await App.supabase.from('reports').update(updates).eq('id', reportId);
    if (error) UI.toast('Erreur', 'error');
    else UI.toast('Statut mis à jour', 'success');
  },

  updateResponse: async function(reportId, response) {
    var { error } = await App.supabase.from('reports').update({
      admin_response: response,
      updated_at: new Date().toISOString()
    }).eq('id', reportId);
    if (error) UI.toast('Erreur', 'error');
    else UI.toast('Réponse sauvegardée', 'success');
  },

  deleteReport: async function(reportId) {
    if (!confirm('Supprimer ce signalement ? Cette action est irréversible.')) return;

    // Delete comments first
    await App.supabase.from('comments').delete().eq('report_id', reportId);
    // Delete votes
    await App.supabase.from('votes').delete().eq('report_id', reportId);
    // Delete report
    var { error } = await App.supabase.from('reports').delete().eq('id', reportId);

    if (error) {
      UI.toast('Erreur de suppression: ' + error.message, 'error');
    } else {
      UI.toast('Signalement supprimé', 'success');
      // Remove from local
      App.reports = App.reports.filter(function(r) { return r.id !== reportId; });
      MapManager.removeReport(reportId);
      Reports.renderList();
      Reports.updateStats();
      // Remove from admin panel
      var el = document.getElementById('adm-' + reportId);
      if (el) el.remove();
    }
  }
};
