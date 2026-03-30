const Auth = {
  async init() {
    const { data: { session } } = await App.supabase.auth.getSession();
    if (session && session.user) {
      App.currentUser = session.user;
      await this.loadProfile();
      this.showIn();
    }

    App.supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        App.currentUser = session.user;
        await this.loadProfile();
        this.showIn();
      } else if (event === 'SIGNED_OUT') {
        App.currentUser = null;
        App.currentProfile = null;
        this.showOut();
      }
    });

    this.bind();
  },

  bind() {
    var self = this;

    document.getElementById('btn-login').addEventListener('click', function() { UI.openModal('modal-login'); });
    document.getElementById('btn-register').addEventListener('click', function() { UI.openModal('modal-register'); });

    document.getElementById('switch-to-register').addEventListener('click', function(e) {
      e.preventDefault();
      UI.closeModal('modal-login');
      UI.openModal('modal-register');
    });
    document.getElementById('switch-to-login').addEventListener('click', function(e) {
      e.preventDefault();
      UI.closeModal('modal-register');
      UI.openModal('modal-login');
    });

    document.getElementById('login-form').addEventListener('submit', function(e) { e.preventDefault(); self.login(); });
    document.getElementById('register-form').addEventListener('submit', function(e) { e.preventDefault(); self.register(); });
    document.getElementById('btn-logout').addEventListener('click', function() { self.logout(); });

    // User menu toggle
    document.getElementById('user-menu-btn').addEventListener('click', function() {
      document.getElementById('user-dropdown').classList.toggle('open');
    });
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.umenu')) {
        document.getElementById('user-dropdown').classList.remove('open');
      }
    });

    document.getElementById('btn-profile').addEventListener('click', function() {
      document.getElementById('user-dropdown').classList.remove('open');
      self.showProfile();
    });
    document.getElementById('btn-my-reports').addEventListener('click', function() {
      document.getElementById('user-dropdown').classList.remove('open');
      self.showMyReports();
    });
    document.getElementById('btn-admin').addEventListener('click', function() {
      document.getElementById('user-dropdown').classList.remove('open');
      self.showAdmin();
    });
  },

  async login() {
    var email = document.getElementById('login-email').value.trim();
    var password = document.getElementById('login-password').value;
    var errEl = document.getElementById('login-error');
    var btn = document.getElementById('btn-login-submit');

    if (!email || !password) {
      errEl.textContent = 'Remplissez tous les champs';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Connexion...';
    errEl.style.display = 'none';

    try {
      var { data, error } = await App.supabase.auth.signInWithPassword({ email: email, password: password });
      if (error) {
        var msg = 'Erreur de connexion';
        if (error.message.includes('Invalid login')) msg = 'Email ou mot de passe incorrect';
        else if (error.message.includes('Email not confirmed')) msg = 'Vérifiez votre email d\'abord';
        errEl.textContent = msg;
        errEl.style.display = 'block';
      } else {
        UI.closeModal('modal-login');
        UI.toast('Bienvenue ! 🎉', 'success');
        document.getElementById('login-form').reset();
      }
    } catch (e) {
      errEl.textContent = 'Erreur réseau';
      errEl.style.display = 'block';
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Se connecter';
  },

  async register() {
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
      errEl.style.display = 'block';
      return;
    }
    if (username.length < 3) {
      errEl.textContent = 'Pseudo trop court (min 3 caractères)';
      errEl.style.display = 'block';
      return;
    }
    if (password !== confirm) {
      errEl.textContent = 'Les mots de passe ne correspondent pas';
      errEl.style.display = 'block';
      return;
    }
    if (password.length < 6) {
      errEl.textContent = 'Mot de passe trop court (min 6 caractères)';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Inscription...';

    try {
      var { data, error } = await App.supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { username: username, commune: commune }
        }
      });

      if (error) {
        var msg = 'Erreur d\'inscription';
        if (error.message.includes('already registered')) msg = 'Cet email est déjà utilisé';
        else if (error.message.includes('valid email')) msg = 'Email invalide';
        else if (error.message.includes('password')) msg = 'Mot de passe trop faible';
        errEl.textContent = msg;
        errEl.style.display = 'block';
      } else {
        // Update commune in profile if provided
        if (commune && data.user) {
          await App.supabase.from('profiles').update({ commune: commune }).eq('id', data.user.id);
        }

        if (data.user && !data.session) {
          UI.closeModal('modal-register');
          UI.toast('Vérifiez votre email pour activer votre compte 📧', 'info');
        } else {
          UI.closeModal('modal-register');
          UI.toast('Bienvenue sur Gwadloup Alèrt ! 🎉', 'success');
        }
        document.getElementById('register-form').reset();
      }
    } catch (e) {
      errEl.textContent = 'Erreur réseau';
      errEl.style.display = 'block';
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-user-plus"></i> Créer mon compte';
  },

  async logout() {
    await App.supabase.auth.signOut();
    App.currentUser = null;
    App.currentProfile = null;
    this.showOut();
    UI.toast('Déconnecté', 'info');
    document.getElementById('user-dropdown').classList.remove('open');
  },

  async loadProfile() {
    if (!App.currentUser) return;
    try {
      var { data } = await App.supabase.from('profiles').select('*').eq('id', App.currentUser.id).single();
      if (data) App.currentProfile = data;
    } catch (e) {
      console.error('Load profile error:', e);
    }
  },

  showIn() {
    document.getElementById('auth-buttons').style.display = 'none';
    document.getElementById('user-menu').style.display = 'block';
    document.getElementById('btn-new-report').style.display = 'inline-flex';

    var name = (App.currentProfile && App.currentProfile.username) ||
               (App.currentUser.user_metadata && App.currentUser.user_metadata.username) ||
               App.currentUser.email.split('@')[0];
    var initial = name.charAt(0).toUpperCase();
    var rep = (App.currentProfile && App.currentProfile.reputation) || 0;

    document.getElementById('user-display-name').textContent = name;
    document.getElementById('user-avatar').textContent = initial;
    document.getElementById('dropdown-name').textContent = name;
    document.getElementById('dropdown-avatar').textContent = initial;
    document.getElementById('dropdown-rep').textContent = rep + ' pts de réputation';

    // Admin section
    var isAdmin = App.currentProfile && App.currentProfile.role === 'admin';
    document.getElementById('admin-section').style.display = isAdmin ? 'block' : 'none';

    // Wiki new article button
    var wikiNewBtn = document.getElementById('btn-wiki-new');
    if (wikiNewBtn) wikiNewBtn.style.display = 'inline-flex';

    // Community buttons
    var tagBtn = document.getElementById('btn-new-tag');
    if (tagBtn) tagBtn.style.display = 'inline-flex';
  },

  showOut() {
    document.getElementById('auth-buttons').style.display = 'flex';
    document.getElementById('user-menu').style.display = 'none';
    document.getElementById('btn-new-report').style.display = 'none';

    var wikiNewBtn = document.getElementById('btn-wiki-new');
    if (wikiNewBtn) wikiNewBtn.style.display = 'none';

    var tagBtn = document.getElementById('btn-new-tag');
    if (tagBtn) tagBtn.style.display = 'none';
  },

  showProfile() {
    var el = document.getElementById('profile-content');
    if (!App.currentProfile) { el.innerHTML = '<p style="padding:16px">Profil indisponible</p>'; UI.openModal('modal-profile'); return; }

    var p = App.currentProfile;
    var name = p.username || 'Citoyen';
    var initial = name.charAt(0).toUpperCase();
    var myReports = App.reports.filter(function(r) { return r.user_id === App.currentUser.id; });

    el.innerHTML =
      '<div style="padding:20px;text-align:center">' +
        '<div class="umenu__av-lg" style="width:56px;height:56px;font-size:1.5rem;margin:0 auto 12px">' + initial + '</div>' +
        '<h3 style="font-size:1.1rem;font-weight:700">' + App.esc(name) + '</h3>' +
        '<p style="font-size:.78rem;color:var(--text2)">' + App.esc(App.currentUser.email) + '</p>' +
        (p.commune ? '<p style="font-size:.75rem;color:var(--green);margin-top:4px"><i class="fas fa-map-pin"></i> ' + App.esc(p.commune) + '</p>' : '') +
        '<div style="display:flex;gap:12px;justify-content:center;margin:16px 0">' +
          '<div style="text-align:center"><div style="font-size:1.3rem;font-weight:700;color:var(--blue)">' + myReports.length + '</div><div style="font-size:.68rem;color:var(--text2)">signalements</div></div>' +
          '<div style="text-align:center"><div style="font-size:1.3rem;font-weight:700;color:var(--green)">' + (p.reputation || 0) + '</div><div style="font-size:.68rem;color:var(--text2)">réputation</div></div>' +
          '<div style="text-align:center"><div style="font-size:1.3rem;font-weight:700;color:var(--purple)">' + App.esc(p.role || 'citizen') + '</div><div style="font-size:.68rem;color:var(--text2)">rôle</div></div>' +
        '</div>' +
      '</div>' +
      '<div style="padding:0 16px 16px;border-top:1px solid var(--border);padding-top:12px">' +
        '<div class="field"><label>Changer la commune</label>' +
          '<select class="inp" id="profile-commune">' +
            '<option value="">Choisir...</option>' +
            '<option' + (p.commune === 'Les Abymes' ? ' selected' : '') + '>Les Abymes</option>' +
            '<option' + (p.commune === 'Pointe-à-Pitre' ? ' selected' : '') + '>Pointe-à-Pitre</option>' +
            '<option' + (p.commune === 'Le Gosier' ? ' selected' : '') + '>Le Gosier</option>' +
            '<option' + (p.commune === 'Sainte-Anne' ? ' selected' : '') + '>Sainte-Anne</option>' +
            '<option' + (p.commune === 'Le Moule' ? ' selected' : '') + '>Le Moule</option>' +
            '<option' + (p.commune === 'Baie-Mahault' ? ' selected' : '') + '>Baie-Mahault</option>' +
            '<option' + (p.commune === 'Petit-Bourg' ? ' selected' : '') + '>Petit-Bourg</option>' +
            '<option' + (p.commune === 'Basse-Terre' ? ' selected' : '') + '>Basse-Terre</option>' +
          '</select></div>' +
        '<button class="btn btn--outline btn--full" onclick="Auth.changeCommune()" style="margin-bottom:8px"><i class="fas fa-map-pin"></i> Mettre à jour</button>' +
        '<div class="field"><label>Nouveau mot de passe</label><input type="password" class="inp" id="profile-new-password" placeholder="Min. 6 caractères" minlength="6"></div>' +
        '<div class="field"><label>Confirmer</label><input type="password" class="inp" id="profile-confirm-password" placeholder="Confirmer"></div>' +
        '<button class="btn btn--outline btn--full" onclick="Auth.changePassword()"><i class="fas fa-key"></i> Changer le mot de passe</button>' +
      '</div>';

    UI.openModal('modal-profile');
  },

  async changePassword() {
    var newPw = document.getElementById('profile-new-password').value;
    var confirmPw = document.getElementById('profile-confirm-password').value;

    if (!newPw || newPw.length < 6) { UI.toast('Mot de passe trop court (min 6)', 'warning'); return; }
    if (newPw !== confirmPw) { UI.toast('Les mots de passe ne correspondent pas', 'warning'); return; }

    try {
      var { error } = await App.supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      UI.toast('Mot de passe modifié ✅', 'success');
      document.getElementById('profile-new-password').value = '';
      document.getElementById('profile-confirm-password').value = '';
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  },

  async changeCommune() {
    var commune = document.getElementById('profile-commune').value;
    if (!commune) { UI.toast('Sélectionnez une commune', 'warning'); return; }

    try {
      var { error } = await App.supabase.from('profiles').update({ commune: commune }).eq('id', App.currentUser.id);
      if (error) throw error;
      App.currentProfile.commune = commune;
      UI.toast('Commune mise à jour ✅', 'success');
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  },

  showMyReports() {
    var el = document.getElementById('my-reports-content');
    if (!App.currentUser) { el.innerHTML = '<p style="padding:16px">Connectez-vous</p>'; UI.openModal('modal-my-reports'); return; }

    var myReports = App.reports.filter(function(r) { return r.user_id === App.currentUser.id; });
    myReports.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });

    if (myReports.length === 0) {
      el.innerHTML = '<div class="empty"><span>📋</span><h3>Aucun signalement</h3><p>Vous n\'avez pas encore créé de signalement</p></div>';
    } else {
      var html = '<div style="padding:12px">';
      myReports.forEach(function(r) {
        var c = App.categories[r.category] || App.categories.other;
        var s = App.statuses[r.status] || App.statuses.pending;
        html += '<div class="adm" style="cursor:pointer" onclick="Reports.openDetail(\'' + r.id + '\');UI.closeModal(\'modal-my-reports\')">' +
          '<div class="adm__info">' +
            '<div class="adm__title">' + App.esc(r.title) + '</div>' +
            '<div class="adm__meta"><span class="badge badge--' + r.status + '">' + s.icon + ' ' + s.label + '</span> · ' + c.label + ' · ' + App.ago(r.created_at) + '</div>' +
          '</div>' +
          '<span style="font-size:.8rem;color:var(--orange);font-weight:600"><i class="fas fa-arrow-up"></i> ' + (r.upvotes || 0) + '</span>' +
        '</div>';
      });
      html += '</div>';
      el.innerHTML = html;
    }

    UI.openModal('modal-my-reports');
  },

  showAdmin() {
    if (!App.currentProfile || App.currentProfile.role !== 'admin') {
      UI.toast('Accès refusé', 'error');
      return;
    }

    var el = document.getElementById('admin-reports-list');
    var reports = App.reports.slice().sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });

    var html = '<div style="padding:8px">';
    html += '<p style="font-size:.78rem;color:var(--text2);margin-bottom:12px">' + reports.length + ' signalements au total</p>';

    reports.forEach(function(r) {
      var c = App.categories[r.category] || App.categories.other;
      var s = App.statuses[r.status] || App.statuses.pending;
      html += '<div class="adm" id="admin-report-' + r.id + '">' +
        '<div class="adm__info">' +
          '<div class="adm__title">' + App.esc(r.title) + '</div>' +
          '<div class="adm__meta">' + c.label + ' · ' + App.ago(r.created_at) + ' · <i class="fas fa-arrow-up"></i> ' + (r.upvotes || 0) + '</div>' +
        '</div>' +
        '<select onchange="Auth.updateStatus(\'' + r.id + '\',this.value)" style="margin-right:4px">' +
          '<option value="pending"' + (r.status === 'pending' ? ' selected' : '') + '>En attente</option>' +
          '<option value="acknowledged"' + (r.status === 'acknowledged' ? ' selected' : '') + '>Pris en compte</option>' +
          '<option value="in_progress"' + (r.status === 'in_progress' ? ' selected' : '') + '>En cours</option>' +
          '<option value="resolved"' + (r.status === 'resolved' ? ' selected' : '') + '>Résolu</option>' +
          '<option value="rejected"' + (r.status === 'rejected' ? ' selected' : '') + '>Rejeté</option>' +
        '</select>' +
        '<button class="btn btn--ghost" onclick="Auth.deleteReport(\'' + r.id + '\')" title="Supprimer" style="color:var(--red)"><i class="fas fa-trash"></i></button>' +
        '<div style="width:100%;margin-top:6px">' +
          '<textarea class="adm textarea" placeholder="Réponse officielle..." onchange="Auth.updateResponse(\'' + r.id + '\',this.value)">' + (r.admin_response || '') + '</textarea>' +
        '</div>' +
      '</div>';
    });

    html += '</div>';
    el.innerHTML = html;
    UI.openModal('modal-admin');
  },

  async updateStatus(id, status) {
    try {
      var update = { status: status, updated_at: new Date().toISOString() };
      if (status === 'resolved') update.resolved_at = new Date().toISOString();

      var { error } = await App.supabase.from('reports').update(update).eq('id', id);
      if (error) throw error;
      UI.toast('Statut mis à jour', 'success');
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  },

  async updateResponse(id, response) {
    try {
      var { error } = await App.supabase.from('reports').update({
        admin_response: response,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      UI.toast('Réponse enregistrée', 'success');
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  },

  async deleteReport(id) {
    if (!confirm('Supprimer ce signalement ? Cette action est irréversible.')) return;

    try {
      // Delete votes first
      await App.supabase.from('votes').delete().eq('report_id', id);
      // Delete comments
      await App.supabase.from('comments').delete().eq('report_id', id);
      // Delete report
      var { error } = await App.supabase.from('reports').delete().eq('id', id);
      if (error) throw error;

      UI.toast('Signalement supprimé', 'success');
      // Remove from admin list
      var el = document.getElementById('admin-report-' + id);
      if (el) el.remove();
      // Reload
      await Reports.loadAll();
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  }
};
