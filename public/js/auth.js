const Auth = {
  async init() {
    const { data: { session } } = await App.supabase.auth.getSession();
    if (session) {
      App.currentUser = session.user;
      await this.loadProfile();
      this.showLoggedIn();
    }

    App.supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        App.currentUser = session.user;
        await this.loadProfile();
        this.showLoggedIn();
      } else if (event === 'SIGNED_OUT') {
        App.currentUser = null;
        App.currentProfile = null;
        this.showLoggedOut();
      }
    });

    this.bind();
  },

  bind() {
    document.getElementById('btn-login').addEventListener('click', () => UI.openModal('modal-login'));
    document.getElementById('btn-register').addEventListener('click', () => UI.openModal('modal-register'));
    document.getElementById('switch-to-register').addEventListener('click', (e) => { e.preventDefault(); UI.closeModal('modal-login'); UI.openModal('modal-register'); });
    document.getElementById('switch-to-login').addEventListener('click', (e) => { e.preventDefault(); UI.closeModal('modal-register'); UI.openModal('modal-login'); });
    document.getElementById('login-form').addEventListener('submit', (e) => { e.preventDefault(); this.login(); });
    document.getElementById('register-form').addEventListener('submit', (e) => { e.preventDefault(); this.register(); });
    document.getElementById('btn-logout').addEventListener('click', (e) => { e.preventDefault(); this.logout(); });

    document.getElementById('user-menu-btn').addEventListener('click', () => {
      document.getElementById('user-dropdown').classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.user-menu')) document.getElementById('user-dropdown').classList.remove('open');
    });

    // Profile & My reports
    document.getElementById('btn-profile').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('user-dropdown').classList.remove('open');
      this.showProfile();
    });

    document.getElementById('btn-my-reports').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('user-dropdown').classList.remove('open');
      this.showMyReports();
    });

    // Admin
    document.getElementById('btn-admin')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('user-dropdown').classList.remove('open');
      this.showAdmin();
    });

    // Password toggle
    const t = document.getElementById('toggle-login-pw');
    if (t) t.addEventListener('click', () => {
      const i = document.getElementById('login-password');
      const ic = t.querySelector('i');
      if (i.type === 'password') { i.type = 'text'; ic.className = 'fas fa-eye-slash'; }
      else { i.type = 'password'; ic.className = 'fas fa-eye'; }
    });
  },

  async login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const err = document.getElementById('login-error');
    const btn = document.getElementById('btn-login-submit');

    err.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Connexion...';

    try {
      const { error } = await App.supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      UI.closeModal('modal-login');
      UI.toast('Connecté ! Bienvenue 👋', 'success');
      document.getElementById('login-form').reset();
    } catch (error) {
      let msg = 'Erreur de connexion';
      if (error.message.includes('Invalid login')) msg = 'Email ou mot de passe incorrect';
      if (error.message.includes('Email not confirmed')) msg = 'Confirmez votre email d\'abord';
      err.textContent = msg;
      err.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Se connecter';
    }
  },

  async register() {
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const commune = document.getElementById('register-commune').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-password-confirm').value;
    const err = document.getElementById('register-error');
    const btn = document.getElementById('btn-register-submit');

    err.style.display = 'none';
    if (password !== confirm) { err.textContent = 'Les mots de passe ne correspondent pas'; err.style.display = 'block'; return; }
    if (username.length < 3) { err.textContent = 'Pseudo trop court (min 3)'; err.style.display = 'block'; return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Création...';

    try {
      const { data, error } = await App.supabase.auth.signUp({
        email, password,
        options: { data: { username, commune } }
      });
      if (error) throw error;

      if (data.user && commune) {
        // Update profile commune (if trigger created it)
        setTimeout(async () => {
          await App.supabase.from('profiles').update({ commune }).eq('id', data.user.id);
        }, 1000);
      }

      UI.closeModal('modal-register');
      if (data.user && !data.session) {
        UI.toast('Compte créé ! Vérifiez votre email.', 'info');
      } else {
        UI.toast('Bienvenue sur Gwadloup Alèrt ! 🎉', 'success');
      }
      document.getElementById('register-form').reset();
    } catch (error) {
      let msg = 'Erreur d\'inscription';
      if (error.message.includes('already registered')) msg = 'Cet email est déjà utilisé';
      err.textContent = msg;
      err.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Créer mon compte';
    }
  },

  async logout() {
    await App.supabase.auth.signOut();
    document.getElementById('user-dropdown').classList.remove('open');
    UI.toast('Déconnecté', 'info');
  },

  async loadProfile() {
    if (!App.currentUser) return;
    const { data } = await App.supabase.from('profiles').select('*').eq('id', App.currentUser.id).single();
    if (data) App.currentProfile = data;
  },

  showLoggedIn() {
    document.getElementById('auth-buttons').style.display = 'none';
    document.getElementById('user-menu').style.display = 'block';
    document.getElementById('btn-new-report').style.display = 'inline-flex';

    const name = App.currentProfile?.username || 'Citoyen';
    const initial = name.charAt(0).toUpperCase();
    document.getElementById('user-display-name').textContent = name;
    document.getElementById('user-avatar').textContent = initial;
    document.getElementById('dropdown-avatar').textContent = initial;
    document.getElementById('dropdown-name').textContent = name;
    document.getElementById('dropdown-rep').textContent = `${App.currentProfile?.reputation || 0} pts de réputation`;

    // Show admin section if admin
    if (App.currentProfile?.role === 'admin') {
      document.getElementById('admin-section').style.display = 'block';
    }
  },

  showLoggedOut() {
    document.getElementById('auth-buttons').style.display = 'flex';
    document.getElementById('user-menu').style.display = 'none';
    document.getElementById('btn-new-report').style.display = 'none';
    document.getElementById('admin-section').style.display = 'none';
  },

  showProfile() {
    const p = App.currentProfile;
    if (!p) return;
    document.getElementById('profile-content').innerHTML = `
      <div class="profile-card">
        <div class="profile-card__av">${p.username.charAt(0).toUpperCase()}</div>
        <div>
          <div class="profile-card__name">${App.esc(p.username)}</div>
          <div class="profile-card__email">${App.currentUser.email}</div>
          <div style="font-size:.72rem;color:var(--text2);margin-top:2px;">
            ${p.commune ? '📍 ' + App.esc(p.commune) : ''}
            ${p.role === 'admin' ? ' • 🛡️ Admin' : ''}
          </div>
        </div>
      </div>
      <div class="profile-stats">
        <div class="profile-stat"><div class="profile-stat__val">${p.reports_count || 0}</div><div class="profile-stat__label">Signalements</div></div>
        <div class="profile-stat"><div class="profile-stat__val">${p.reputation || 0}</div><div class="profile-stat__label">Réputation</div></div>
        <div class="profile-stat"><div class="profile-stat__val">${p.role === 'admin' ? 'Admin' : 'Citoyen'}</div><div class="profile-stat__label">Rôle</div></div>
      </div>
    `;
    UI.openModal('modal-profile');
  },

  async showMyReports() {
    if (!App.currentUser) return;
    const { data } = await App.supabase.from('reports').select('*').eq('user_id', App.currentUser.id).order('created_at', { ascending: false });

    const c = document.getElementById('my-reports-content');
    if (!data || data.length === 0) {
      c.innerHTML = '<div style="padding:40px;text-align:center"><div style="font-size:2.5rem;margin-bottom:12px">📭</div><p style="color:var(--text2)">Aucun signalement</p></div>';
    } else {
      c.innerHTML = '<div style="padding:16px">' + data.map(r => {
        const cat = App.categories[r.category] || App.categories.other;
        const st = App.statuses[r.status] || App.statuses.pending;
        return `<div class="admin-report" style="cursor:pointer" onclick="UI.closeModal('modal-my-reports');Reports.openDetail('${r.id}')">
          <div class="admin-report__info">
            <div class="admin-report__title">${cat.emoji} ${App.esc(r.title)}</div>
            <div class="admin-report__meta">${st.icon} ${st.label} • ${App.timeAgo(r.created_at)}</div>
          </div>
        </div>`;
      }).join('') + '</div>';
    }
    UI.openModal('modal-my-reports');
  },

  async showAdmin() {
    if (App.currentProfile?.role !== 'admin') return;

    const { data } = await App.supabase.from('reports').select('*, profiles:user_id(username)').order('created_at', { ascending: false });

    const c = document.getElementById('admin-reports-list');
    if (!data || data.length === 0) {
      c.innerHTML = '<p style="text-align:center;color:var(--text2);padding:20px">Aucun signalement</p>';
    } else {
      c.innerHTML = data.map(r => {
        const cat = App.categories[r.category] || App.categories.other;
        return `<div class="admin-report" id="admin-${r.id}">
          <div class="admin-report__info">
            <div class="admin-report__title">${cat.emoji} ${App.esc(r.title)}</div>
            <div class="admin-report__meta">Par ${App.esc(r.profiles?.username || '?')} • ${App.timeAgo(r.created_at)} • ${r.commune || ''}</div>
          </div>
          <select onchange="Auth.updateReportStatus('${r.id}', this.value)">
            <option value="pending" ${r.status==='pending'?'selected':''}>⏳ En attente</option>
            <option value="acknowledged" ${r.status==='acknowledged'?'selected':''}>👁️ Pris en compte</option>
            <option value="in_progress" ${r.status==='in_progress'?'selected':''}>🔧 En cours</option>
            <option value="resolved" ${r.status==='resolved'?'selected':''}>✅ Résolu</option>
            <option value="rejected" ${r.status==='rejected'?'selected':''}>❌ Rejeté</option>
          </select>
          <div style="width:100%">
            <textarea placeholder="Réponse officielle..." onchange="Auth.updateAdminResponse('${r.id}', this.value)">${r.admin_response || ''}</textarea>
          </div>
        </div>`;
      }).join('');
    }
    UI.openModal('modal-admin');
  },

  async updateReportStatus(id, status) {
    const update = { status };
    if (status === 'resolved') update.resolved_at = new Date().toISOString();
    await App.supabase.from('reports').update(update).eq('id', id);
    UI.toast('Statut mis à jour', 'success');
  },

  async updateAdminResponse(id, response) {
    await App.supabase.from('reports').update({ admin_response: response }).eq('id', id);
    UI.toast('Réponse enregistrée', 'success');
  }
};
