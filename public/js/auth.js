var Auth = {
  async init() {
    try {
      var result = await App.supabase.auth.getSession();
      if (result.data && result.data.session) {
        App.currentUser = result.data.session.user;
        await this.loadProfile();
        this.showIn();
      }
    } catch (e) {
      console.error('Auth init:', e);
    }

    var self = this;
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

    this.bind();
  },

  bind: function() {
    var self = this;

    document.getElementById('btn-login').addEventListener('click', function() { UI.openModal('modal-login'); });
    document.getElementById('btn-register').addEventListener('click', function() { UI.openModal('modal-register'); });

    document.getElementById('switch-to-register').addEventListener('click', function(e) {
      e.preventDefault(); UI.closeModal('modal-login'); UI.openModal('modal-register');
    });
    document.getElementById('switch-to-login').addEventListener('click', function(e) {
      e.preventDefault(); UI.closeModal('modal-register'); UI.openModal('modal-login');
    });

    document.getElementById('login-form').addEventListener('submit', function(e) { e.preventDefault(); self.login(); });
    document.getElementById('register-form').addEventListener('submit', function(e) { e.preventDefault(); self.register(); });

    document.getElementById('btn-logout').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      self.logout();
    });

    document.getElementById('user-menu-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      document.getElementById('user-dropdown').classList.toggle('open');
    });

    document.addEventListener('click', function(e) {
      if (!e.target.closest('.umenu')) {
        var dd = document.getElementById('user-dropdown');
        if (dd) dd.classList.remove('open');
      }
    });

    document.getElementById('btn-profile').addEventListener('click', function(e) {
      e.preventDefault();
      document.getElementById('user-dropdown').classList.remove('open');
      self.showProfile();
    });

    document.getElementById('btn-my-reports').addEventListener('click', function(e) {
      e.preventDefault();
      document.getElementById('user-dropdown').classList.remove('open');
      self.showMyReports();
    });

    document.getElementById('btn-admin').addEventListener('click', function(e) {
      e.preventDefault();
      document.getElementById('user-dropdown').classList.remove('open');
      self.showAdmin();
    });
  },

  login: async function() {
    var email = document.getElementById('login-email').value.trim();
    var pw = document.getElementById('login-password').value;
    var err = document.getElementById('login-error');
    var btn = document.getElementById('btn-login-submit');
    err.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      var result = await App.supabase.auth.signInWithPassword({ email: email, password: pw });
      if (result.error) throw result.error;
      UI.closeModal('modal-login');
      UI.toast('Connecté !', 'success');
      document.getElementById('login-form').reset();
    } catch (error) {
      var msg = 'Erreur de connexion';
      if (error.message && error.message.indexOf('Invalid login') !== -1) msg = 'Email ou mot de passe incorrect';
      if (error.message && error.message.indexOf('Email not confirmed') !== -1) msg = 'Confirmez votre email';
      err.textContent = msg;
      err.style.display = 'block';
    }
    btn.disabled = false;
    btn.textContent = 'Se connecter';
  },

  register: async function() {
    var username = document.getElementById('register-username').value.trim();
    var email = document.getElementById('register-email').value.trim();
    var commune = document.getElementById('register-commune').value;
    var pw = document.getElementById('register-password').value;
    var pw2 = document.getElementById('register-password-confirm').value;
    var err = document.getElementById('register-error');
    var btn = document.getElementById('btn-register-submit');
    err.style.display = 'none';

    if (pw !== pw2) { err.textContent = 'Mots de passe différents'; err.style.display = 'block'; return; }
    if (username.length < 3) { err.textContent = 'Pseudo trop court'; err.style.display = 'block'; return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      var result = await App.supabase.auth.signUp({
        email: email, password: pw,
        options: { data: { username: username, commune: commune } }
      });
      if (result.error) throw result.error;

      if (result.data.user && commune) {
        setTimeout(async function() {
          try { await App.supabase.from('profiles').update({ commune: commune }).eq('id', result.data.user.id); } catch (e) { }
        }, 2000);
      }

      UI.closeModal('modal-register');
      if (result.data.user && !result.data.session) UI.toast('Vérifiez votre email', 'info');
      else UI.toast('Bienvenue !', 'success');
      document.getElementById('register-form').reset();
    } catch (error) {
      var msg = 'Erreur';
      if (error.message && error.message.indexOf('already registered') !== -1) msg = 'Email déjà utilisé';
      err.textContent = msg;
      err.style.display = 'block';
    }
    btn.disabled = false;
    btn.textContent = 'Créer mon compte';
  },

  logout: async function() {
    document.getElementById('user-dropdown').classList.remove('open');
    try { await App.supabase.auth.signOut(); } catch (e) { }
    App.currentUser = null;
    App.currentProfile = null;
    this.showOut();
    UI.toast('Déconnecté', 'info');
  },

  loadProfile: async function() {
    if (!App.currentUser) return;
    try {
      var result = await App.supabase.from('profiles').select('*').eq('id', App.currentUser.id).single();
      if (result.data) App.currentProfile = result.data;
    } catch (e) { }
  },

  showIn: function() {
    document.getElementById('auth-buttons').style.display = 'none';
    document.getElementById('user-menu').style.display = 'block';
    document.getElementById('btn-new-report').style.display = 'inline-flex';

    var name = 'Citoyen';
    if (App.currentProfile && App.currentProfile.username) name = App.currentProfile.username;
    else if (App.currentUser && App.currentUser.user_metadata && App.currentUser.user_metadata.username) name = App.currentUser.user_metadata.username;

    var letter = name.charAt(0).toUpperCase();
    document.getElementById('user-display-name').textContent = name;
    document.getElementById('user-avatar').textContent = letter;
    document.getElementById('dropdown-avatar').textContent = letter;
    document.getElementById('dropdown-name').textContent = name;
    document.getElementById('dropdown-rep').textContent = (App.currentProfile ? App.currentProfile.reputation || 0 : 0) + ' pts';

    var adminEl = document.getElementById('admin-section');
    if (App.currentProfile && App.currentProfile.role === 'admin') {
      adminEl.style.display = 'block';
    } else {
      adminEl.style.display = 'none';
    }
  },

  showOut: function() {
    document.getElementById('auth-buttons').style.display = 'flex';
    document.getElementById('user-menu').style.display = 'none';
    document.getElementById('btn-new-report').style.display = 'none';
    document.getElementById('admin-section').style.display = 'none';
  },

  showProfile: function() {
    var p = App.currentProfile;
    if (!p) return;

    var html = '<div style="padding:16px">' +
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">' +
      '<div style="width:48px;height:48px;border-radius:50%;background:var(--green2);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700">' + p.username.charAt(0).toUpperCase() + '</div>' +
      '<div><div style="font-weight:700">' + App.esc(p.username) + '</div>' +
      '<div style="font-size:.75rem;color:var(--text2)">' + App.currentUser.email + '</div>' +
      (p.commune ? '<div style="font-size:.7rem;color:var(--text3)">📍 ' + App.esc(p.commune) + '</div>' : '') +
      (p.role === 'admin' ? '<div style="font-size:.7rem;color:var(--purple)">🛡️ Admin</div>' : '') +
      '</div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">' +
      '<div style="text-align:center;padding:12px;background:var(--bg3);border-radius:var(--r)"><div style="font-size:1.2rem;font-weight:700;color:var(--green)">' + (p.reports_count || 0) + '</div><div style="font-size:.65rem;color:var(--text2)">Signalements</div></div>' +
      '<div style="text-align:center;padding:12px;background:var(--bg3);border-radius:var(--r)"><div style="font-size:1.2rem;font-weight:700;color:var(--green)">' + (p.reputation || 0) + '</div><div style="font-size:.65rem;color:var(--text2)">Réputation</div></div>' +
      '<div style="text-align:center;padding:12px;background:var(--bg3);border-radius:var(--r)"><div style="font-size:1rem;font-weight:700;color:var(--green)">' + (p.role === 'admin' ? 'Admin' : 'Citoyen') + '</div><div style="font-size:.65rem;color:var(--text2)">Rôle</div></div>' +
      '</div>' +
      // Change password section
      '<div style="border-top:1px solid var(--border);padding-top:14px">' +
      '<h4 style="font-size:.82rem;margin-bottom:10px;color:var(--text2)"><i class="fas fa-key"></i> Changer le mot de passe</h4>' +
      '<div class="field"><label>Nouveau mot de passe</label><input type="password" class="inp" id="new-password" placeholder="Min. 6 caractères" minlength="6"></div>' +
      '<div class="field"><label>Confirmer</label><input type="password" class="inp" id="new-password-confirm" placeholder="Confirmer"></div>' +
      '<div id="pw-change-msg" style="display:none;font-size:.78rem;margin-bottom:8px"></div>' +
      '<button class="btn btn--primary" onclick="Auth.changePassword()" id="btn-change-pw">Mettre à jour</button>' +
      '</div>' +
      // Change commune
      '<div style="border-top:1px solid var(--border);padding-top:14px;margin-top:14px">' +
      '<h4 style="font-size:.82rem;margin-bottom:10px;color:var(--text2)"><i class="fas fa-map-marker-alt"></i> Changer la commune</h4>' +
      '<div class="field"><select class="inp" id="profile-commune">' +
      '<option value="">Choisir...</option>' +
      '<optgroup label="Grande-Terre"><option' + (p.commune === 'Les Abymes' ? ' selected' : '') + '>Les Abymes</option><option' + (p.commune === 'Anse-Bertrand' ? ' selected' : '') + '>Anse-Bertrand</option><option' + (p.commune === 'Le Gosier' ? ' selected' : '') + '>Le Gosier</option><option' + (p.commune === 'Le Moule' ? ' selected' : '') + '>Le Moule</option><option' + (p.commune === "Morne-à-l\'Eau" ? ' selected' : '') + '>Morne-à-l\'Eau</option><option' + (p.commune === 'Petit-Canal' ? ' selected' : '') + '>Petit-Canal</option><option' + (p.commune === 'Pointe-à-Pitre' ? ' selected' : '') + '>Pointe-à-Pitre</option><option' + (p.commune === 'Port-Louis' ? ' selected' : '') + '>Port-Louis</option><option' + (p.commune === 'Saint-François' ? ' selected' : '') + '>Saint-François</option><option' + (p.commune === 'Sainte-Anne' ? ' selected' : '') + '>Sainte-Anne</option></optgroup>' +
      '<optgroup label="Basse-Terre"><option' + (p.commune === 'Baie-Mahault' ? ' selected' : '') + '>Baie-Mahault</option><option' + (p.commune === 'Baillif' ? ' selected' : '') + '>Baillif</option><option' + (p.commune === 'Basse-Terre' ? ' selected' : '') + '>Basse-Terre</option><option' + (p.commune === 'Bouillante' ? ' selected' : '') + '>Bouillante</option><option' + (p.commune === 'Capesterre-Belle-Eau' ? ' selected' : '') + '>Capesterre-Belle-Eau</option><option' + (p.commune === 'Deshaies' ? ' selected' : '') + '>Deshaies</option><option' + (p.commune === 'Gourbeyre' ? ' selected' : '') + '>Gourbeyre</option><option' + (p.commune === 'Goyave' ? ' selected' : '') + '>Goyave</option><option' + (p.commune === 'Lamentin' ? ' selected' : '') + '>Lamentin</option><option' + (p.commune === 'Petit-Bourg' ? ' selected' : '') + '>Petit-Bourg</option><option' + (p.commune === 'Pointe-Noire' ? ' selected' : '') + '>Pointe-Noire</option><option' + (p.commune === 'Saint-Claude' ? ' selected' : '') + '>Saint-Claude</option><option' + (p.commune === 'Sainte-Rose' ? ' selected' : '') + '>Sainte-Rose</option><option' + (p.commune === 'Trois-Rivières' ? ' selected' : '') + '>Trois-Rivières</option><option' + (p.commune === 'Vieux-Fort' ? ' selected' : '') + '>Vieux-Fort</option><option' + (p.commune === 'Vieux-Habitants' ? ' selected' : '') + '>Vieux-Habitants</option></optgroup>' +
      '<optgroup label="Marie-Galante"><option' + (p.commune === 'Capesterre-de-Marie-Galante' ? ' selected' : '') + '>Capesterre-de-Marie-Galante</option><option' + (p.commune === 'Grand-Bourg' ? ' selected' : '') + '>Grand-Bourg</option><option' + (p.commune === 'Saint-Louis' ? ' selected' : '') + '>Saint-Louis</option></optgroup>' +
      '<optgroup label="Les Saintes"><option' + (p.commune === 'Terre-de-Haut' ? ' selected' : '') + '>Terre-de-Haut</option><option' + (p.commune === 'Terre-de-Bas' ? ' selected' : '') + '>Terre-de-Bas</option></optgroup>' +
      '<optgroup label="La Désirade"><option' + (p.commune === 'La Désirade' ? ' selected' : '') + '>La Désirade</option></optgroup>' +
      '</select></div>' +
      '<button class="btn btn--outline" onclick="Auth.changeCommune()">Enregistrer</button>' +
      '</div>' +
      '</div>';

    document.getElementById('profile-content').innerHTML = html;
    UI.openModal('modal-profile');
  },

  changePassword: async function() {
    var pw = document.getElementById('new-password').value;
    var pw2 = document.getElementById('new-password-confirm').value;
    var msg = document.getElementById('pw-change-msg');
    var btn = document.getElementById('btn-change-pw');

    if (!pw || pw.length < 6) {
      msg.textContent = 'Min. 6 caractères';
      msg.style.display = 'block';
      msg.style.color = 'var(--red)';
      return;
    }
    if (pw !== pw2) {
      msg.textContent = 'Mots de passe différents';
      msg.style.display = 'block';
      msg.style.color = 'var(--red)';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      var result = await App.supabase.auth.updateUser({ password: pw });
      if (result.error) throw result.error;
      msg.textContent = '✅ Mot de passe mis à jour !';
      msg.style.display = 'block';
      msg.style.color = 'var(--green)';
      document.getElementById('new-password').value = '';
      document.getElementById('new-password-confirm').value = '';
    } catch (e) {
      msg.textContent = 'Erreur : ' + (e.message || 'Réessayez');
      msg.style.display = 'block';
      msg.style.color = 'var(--red)';
    }
    btn.disabled = false;
    btn.textContent = 'Mettre à jour';
  },

  changeCommune: async function() {
    var commune = document.getElementById('profile-commune').value;
    if (!commune) return;

    try {
      await App.supabase.from('profiles').update({ commune: commune }).eq('id', App.currentUser.id);
      App.currentProfile.commune = commune;
      UI.toast('Commune mise à jour', 'success');
    } catch (e) {
      UI.toast('Erreur', 'error');
    }
  },

  showMyReports: async function() {
    if (!App.currentUser) return;
    var result = await App.supabase.from('reports').select('*').eq('user_id', App.currentUser.id).order('created_at', { ascending: false });
    var data = result.data;
    var el = document.getElementById('my-reports-content');

    if (!data || data.length === 0) {
      el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text2)"><div style="font-size:2rem;margin-bottom:8px">📭</div>Aucun signalement</div>';
    } else {
      el.innerHTML = '<div style="padding:12px">' + data.map(function(r) {
        var cat = App.categories[r.category] || App.categories.other;
        var st = App.statuses[r.status] || App.statuses.pending;
        return '<div class="adm" style="cursor:pointer" onclick="UI.closeModal(\'modal-my-reports\');Reports.openDetail(\'' + r.id + '\')">' +
          '<div class="adm__info"><div class="adm__title">' + cat.emoji + ' ' + App.esc(r.title) + '</div>' +
          '<div class="adm__meta">' + st.icon + ' ' + st.label + ' · ' + App.ago(r.created_at) + '</div></div></div>';
      }).join('') + '</div>';
    }
    UI.openModal('modal-my-reports');
  },

  showAdmin: async function() {
    if (!App.currentProfile || App.currentProfile.role !== 'admin') return;
    var result = await App.supabase.from('reports').select('*, profiles:user_id(username)').order('created_at', { ascending: false });
    var data = result.data;
    var el = document.getElementById('admin-reports-list');

    if (!data || data.length === 0) {
      el.innerHTML = '<p style="text-align:center;color:var(--text2);padding:16px">Aucun signalement</p>';
    } else {
      el.innerHTML = data.map(function(r) {
        var cat = App.categories[r.category] || App.categories.other;
        var uname = (r.profiles && r.profiles.username) ? r.profiles.username : '?';
        return '<div class="adm"><div class="adm__info"><div class="adm__title">' + cat.emoji + ' ' + App.esc(r.title) + '</div><div class="adm__meta">Par ' + App.esc(uname) + ' · ' + App.ago(r.created_at) + '</div></div>' +
          '<select onchange="Auth.updateStatus(\'' + r.id + '\',this.value)">' +
          '<option value="pending"' + (r.status === 'pending' ? ' selected' : '') + '>⏳ Attente</option>' +
          '<option value="acknowledged"' + (r.status === 'acknowledged' ? ' selected' : '') + '>👁️ Vu</option>' +
          '<option value="in_progress"' + (r.status === 'in_progress' ? ' selected' : '') + '>🔧 Cours</option>' +
          '<option value="resolved"' + (r.status === 'resolved' ? ' selected' : '') + '>✅ Résolu</option>' +
          '<option value="rejected"' + (r.status === 'rejected' ? ' selected' : '') + '>❌ Rejeté</option></select>' +
          '<div style="width:100%"><textarea placeholder="Réponse officielle..." onchange="Auth.updateResponse(\'' + r.id + '\',this.value)">' + (r.admin_response || '') + '</textarea></div></div>';
      }).join('');
    }
    UI.openModal('modal-admin');
  },

  updateStatus: async function(id, status) {
    var u = { status: status };
    if (status === 'resolved') u.resolved_at = new Date().toISOString();
    await App.supabase.from('reports').update(u).eq('id', id);
    UI.toast('Statut mis à jour', 'success');
    Reports.loadAll();
  },

  updateResponse: async function(id, text) {
    await App.supabase.from('reports').update({ admin_response: text }).eq('id', id);
    UI.toast('Réponse enregistrée', 'success');
  }
};
