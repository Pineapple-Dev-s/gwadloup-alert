const Auth = {
  async init() {
    try {
      const { data: { session } } = await App.supabase.auth.getSession();
      if (session) {
        App.currentUser = session.user;
        await this.loadProfile();
        this.showIn();
      }
    } catch (e) {
      console.error('Auth init:', e);
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
    // Login / Register buttons
    document.getElementById('btn-login').addEventListener('click', () => UI.openModal('modal-login'));
    document.getElementById('btn-register').addEventListener('click', () => UI.openModal('modal-register'));

    // Switch forms
    document.getElementById('switch-to-register').addEventListener('click', (e) => {
      e.preventDefault();
      UI.closeModal('modal-login');
      UI.openModal('modal-register');
    });
    document.getElementById('switch-to-login').addEventListener('click', (e) => {
      e.preventDefault();
      UI.closeModal('modal-register');
      UI.openModal('modal-login');
    });

    // Login form
    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.login();
    });

    // Register form
    document.getElementById('register-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.register();
    });

    // LOGOUT
    document.getElementById('btn-logout').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.logout();
    });

    // User menu toggle
    document.getElementById('user-menu-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('user-dropdown').classList.toggle('open');
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.umenu')) {
        const dd = document.getElementById('user-dropdown');
        if (dd) dd.classList.remove('open');
      }
    });

    // Profile button
    document.getElementById('btn-profile').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('user-dropdown').classList.remove('open');
      this.showProfile();
    });

    // My reports button
    document.getElementById('btn-my-reports').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('user-dropdown').classList.remove('open');
      this.showMyReports();
    });

    // Admin button
    document.getElementById('btn-admin').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('user-dropdown').classList.remove('open');
      this.showAdmin();
    });
  },

  async login() {
    const email = document.getElementById('login-email').value.trim();
    const pw = document.getElementById('login-password').value;
    const err = document.getElementById('login-error');
    const btn = document.getElementById('btn-login-submit');
    err.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      const { error } = await App.supabase.auth.signInWithPassword({ email: email, password: pw });
      if (error) throw error;
      UI.closeModal('modal-login');
      UI.toast('Connecté !', 'success');
      document.getElementById('login-form').reset();
    } catch (error) {
      let msg = 'Erreur de connexion';
      if (error.message && error.message.includes('Invalid login')) msg = 'Email ou mot de passe incorrect';
      if (error.message && error.message.includes('Email not confirmed')) msg = 'Confirmez votre email';
      err.textContent = msg;
      err.style.display = 'block';
    }
    btn.disabled = false;
    btn.textContent = 'Se connecter';
  },

  async register() {
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const commune = document.getElementById('register-commune').value;
    const pw = document.getElementById('register-password').value;
    const pw2 = document.getElementById('register-password-confirm').value;
    const err = document.getElementById('register-error');
    const btn = document.getElementById('btn-register-submit');
    err.style.display = 'none';

    if (pw !== pw2) { err.textContent = 'Mots de passe différents'; err.style.display = 'block'; return; }
    if (username.length < 3) { err.textContent = 'Pseudo trop court (min 3)'; err.style.display = 'block'; return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      const { data, error } = await App.supabase.auth.signUp({
        email: email,
        password: pw,
        options: { data: { username: username, commune: commune } }
      });
      if (error) throw error;

      if (data.user && commune) {
        setTimeout(async () => {
          try { await App.supabase.from('profiles').update({ commune: commune }).eq('id', data.user.id); } catch (e) { }
        }, 2000);
      }

      UI.closeModal('modal-register');
      if (data.user && !data.session) {
        UI.toast('Vérifiez votre email pour confirmer', 'info');
      } else {
        UI.toast('Bienvenue !', 'success');
      }
      document.getElementById('register-form').reset();
    } catch (error) {
      let msg = 'Erreur';
      if (error.message && error.message.includes('already registered')) msg = 'Email déjà utilisé';
      err.textContent = msg;
      err.style.display = 'block';
    }
    btn.disabled = false;
    btn.textContent = 'Créer mon compte';
  },

  async logout() {
    document.getElementById('user-dropdown').classList.remove('open');
    try {
      await App.supabase.auth.signOut();
    } catch (e) {
      console.error('Logout error:', e);
    }
    // Force UI update even if signOut errors
    App.currentUser = null;
    App.currentProfile = null;
    this.showOut();
    UI.toast('Déconnecté', 'info');
  },

  async loadProfile() {
    if (!App.currentUser) return;
    try {
      const { data } = await App.supabase.from('profiles').select('*').eq('id', App.currentUser.id).single();
      if (data) App.currentProfile = data;
    } catch (e) { }
  },

  showIn() {
    document.getElementById('auth-buttons').style.display = 'none';
    document.getElementById('user-menu').style.display = 'block';
    document.getElementById('btn-new-report').style.display = 'inline-flex';

    const name = (App.currentProfile && App.currentProfile.username) || (App.currentUser && App.currentUser.user_metadata && App.currentUser.user_metadata.username) || 'Citoyen';
    const letter = name.charAt(0).toUpperCase();

    document.getElementById('user-display-name').textContent = name;
    document.getElementById('user-avatar').textContent = letter;
    document.getElementById('dropdown-avatar').textContent = letter;
    document.getElementById('dropdown-name').textContent = name;
    document.getElementById('dropdown-rep').textContent = (App.currentProfile ? App.currentProfile.reputation : 0) + ' pts';

    // Admin
    var adminEl = document.getElementById('admin-section');
    if (App.currentProfile && App.currentProfile.role === 'admin') {
      adminEl.style.display = 'block';
    } else {
      adminEl.style.display = 'none';
    }
  },

  showOut() {
    document.getElementById('auth-buttons').style.display = 'flex';
    document.getElementById('user-menu').style.display = 'none';
    document.getElementById('btn-new-report').style.display = 'none';
    document.getElementById('admin-section').style.display = 'none';
  },

  showProfile() {
    var p = App.currentProfile;
    if (!p) return;
    document.getElementById('profile-content').innerHTML =
      '<div style="padding:16px">' +
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">' +
      '<div style="width:48px;height:48px;border-radius:50%;background:var(--green2);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700">' + p.username.charAt(0).toUpperCase() + '</div>' +
      '<div><div style="font-weight:700">' + App.esc(p.username) + '</div><div style="font-size:.75rem;color:var(--text2)">' + App.currentUser.email + '</div>' +
      (p.commune ? '<div style="font-size:.7rem;color:var(--text3)">📍 ' + App.esc(p.commune) + '</div>' : '') +
      (p.role === 'admin' ? '<div style="font-size:.7rem;color:var(--purple)">🛡️ Admin</div>' : '') +
      '</div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' +
      '<div style="text-align:center;padding:12px;background:var(--bg3);border-radius:var(--r)"><div style="font-size:1.2rem;font-weight:700;color:var(--green)">' + (p.reports_count || 0) + '</div><div style="font-size:.65rem;color:var(--text2)">Signalements</div></div>' +
      '<div style="text-align:center;padding:12px;background:var(--bg3);border-radius:var(--r)"><div style="font-size:1.2rem;font-weight:700;color:var(--green)">' + (p.reputation || 0) + '</div><div style="font-size:.65rem;color:var(--text2)">Réputation</div></div>' +
      '<div style="text-align:center;padding:12px;background:var(--bg3);border-radius:var(--r)"><div style="font-size:1rem;font-weight:700;color:var(--green)">' + (p.role === 'admin' ? 'Admin' : 'Citoyen') + '</div><div style="font-size:.65rem;color:var(--text2)">Rôle</div></div>' +
      '</div></div>';
    UI.openModal('modal-profile');
  },

  async showMyReports() {
    if (!App.currentUser) return;
    var { data } = await App.supabase.from('reports').select('*').eq('user_id', App.currentUser.id).order('created_at', { ascending: false });
    var el = document.getElementById('my-reports-content');
    if (!data || data.length === 0) {
      el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text2)"><div style="font-size:2rem;margin-bottom:8px">📭</div>Aucun signalement</div>';
    } else {
      el.innerHTML = '<div style="padding:12px">' + data.map(function (r) {
        var cat = App.categories[r.category] || App.categories.other;
        var st = App.statuses[r.status] || App.statuses.pending;
        return '<div class="adm" style="cursor:pointer" onclick="UI.closeModal(\'modal-my-reports\');Reports.openDetail(\'' + r.id + '\')"><div class="adm__info"><div class="adm__title">' + cat.emoji + ' ' + App.esc(r.title) + '</div><div class="adm__meta">' + st.icon + ' ' + st.label + ' · ' + App.ago(r.created_at) + '</div></div></div>';
      }).join('') + '</div>';
    }
    UI.openModal('modal-my-reports');
  },

  async showAdmin() {
    if (!App.currentProfile || App.currentProfile.role !== 'admin') return;
    var { data } = await App.supabase.from('reports').select('*, profiles:user_id(username)').order('created_at', { ascending: false });
    var el = document.getElementById('admin-reports-list');
    if (!data || data.length === 0) {
      el.innerHTML = '<p style="text-align:center;color:var(--text2);padding:16px">Aucun signalement</p>';
    } else {
      el.innerHTML = data.map(function (r) {
        var cat = App.categories[r.category] || App.categories.other;
        var uname = (r.profiles && r.profiles.username) ? r.profiles.username : '?';
        return '<div class="adm"><div class="adm__info"><div class="adm__title">' + cat.emoji + ' ' + App.esc(r.title) + '</div><div class="adm__meta">Par ' + App.esc(uname) + ' · ' + App.ago(r.created_at) + '</div></div>' +
          '<select onchange="Auth.updateStatus(\'' + r.id + '\',this.value)">' +
          '<option value="pending"' + (r.status === 'pending' ? ' selected' : '') + '>⏳ Attente</option>' +
          '<option value="acknowledged"' + (r.status === 'acknowledged' ? ' selected' : '') + '>👁️ Vu</option>' +
          '<option value="in_progress"' + (r.status === 'in_progress' ? ' selected' : '') + '>🔧 Cours</option>' +
          '<option value="resolved"' + (r.status === 'resolved' ? ' selected' : '') + '>✅ Résolu</option>' +
          '<option value="rejected"' + (r.status === 'rejected' ? ' selected' : '') + '>❌ Rejeté</option>' +
          '</select>' +
          '<div style="width:100%"><textarea placeholder="Réponse officielle..." onchange="Auth.updateResponse(\'' + r.id + '\',this.value)">' + (r.admin_response || '') + '</textarea></div></div>';
      }).join('');
    }
    UI.openModal('modal-admin');
  },

  async updateStatus(id, status) {
    var u = { status: status };
    if (status === 'resolved') u.resolved_at = new Date().toISOString();
    await App.supabase.from('reports').update(u).eq('id', id);
    UI.toast('Statut mis à jour', 'success');
    Reports.loadAll();
  },

  async updateResponse(id, text) {
    await App.supabase.from('reports').update({ admin_response: text }).eq('id', id);
    UI.toast('Réponse enregistrée', 'success');
  }
};
