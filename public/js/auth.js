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

    this.bindAll();
  },

  bindAll() {
    // Auth buttons
    const btnLogin = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');
    const switchToReg = document.getElementById('switch-to-register');
    const switchToLog = document.getElementById('switch-to-login');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const btnLogout = document.getElementById('btn-logout');
    const btnMenuTrigger = document.getElementById('user-menu-btn');
    const btnProfile = document.getElementById('btn-profile');
    const btnMyReports = document.getElementById('btn-my-reports');
    const btnAdmin = document.getElementById('btn-admin');
    const togglePw = document.getElementById('toggle-login-pw');

    if (btnLogin) btnLogin.onclick = () => UI.openModal('modal-login');
    if (btnRegister) btnRegister.onclick = () => UI.openModal('modal-register');
    if (switchToReg) switchToReg.onclick = (e) => { e.preventDefault(); UI.closeModal('modal-login'); UI.openModal('modal-register'); };
    if (switchToLog) switchToLog.onclick = (e) => { e.preventDefault(); UI.closeModal('modal-register'); UI.openModal('modal-login'); };
    if (loginForm) loginForm.onsubmit = (e) => { e.preventDefault(); this.login(); };
    if (registerForm) registerForm.onsubmit = (e) => { e.preventDefault(); this.register(); };

    // DÉCONNEXION — Fix
    if (btnLogout) {
      btnLogout.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('user-dropdown').classList.remove('open');
        try {
          await App.supabase.auth.signOut();
          App.currentUser = null;
          App.currentProfile = null;
          this.showLoggedOut();
          UI.toast('Déconnecté', 'info');
        } catch (err) {
          console.error('Logout error:', err);
          // Force logout même si erreur
          App.currentUser = null;
          App.currentProfile = null;
          this.showLoggedOut();
          UI.toast('Déconnecté', 'info');
        }
      };
    }

    // User menu toggle
    if (btnMenuTrigger) {
      btnMenuTrigger.onclick = (e) => {
        e.stopPropagation();
        document.getElementById('user-dropdown').classList.toggle('open');
      };
    }

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.user-menu')) {
        document.getElementById('user-dropdown')?.classList.remove('open');
      }
    });

    // Profile
    if (btnProfile) {
      btnProfile.onclick = (e) => {
        e.preventDefault();
        document.getElementById('user-dropdown').classList.remove('open');
        this.showProfile();
      };
    }

    // My reports
    if (btnMyReports) {
      btnMyReports.onclick = (e) => {
        e.preventDefault();
        document.getElementById('user-dropdown').classList.remove('open');
        this.showMyReports();
      };
    }

    // Admin
    if (btnAdmin) {
      btnAdmin.onclick = (e) => {
        e.preventDefault();
        document.getElementById('user-dropdown').classList.remove('open');
        this.showAdmin();
      };
    }

    // Password toggle
    if (togglePw) {
      togglePw.onclick = () => {
        const inp = document.getElementById('login-password');
        const ico = togglePw.querySelector('i');
        if (inp.type === 'password') { inp.type = 'text'; ico.className = 'fas fa-eye-slash'; }
        else { inp.type = 'password'; ico.className = 'fas fa-eye'; }
      };
    }
  },

  async login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const err = document.getElementById('login-error');
    const btn = document.getElementById('btn-login-submit');
    err.style.display = 'none';
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

    try {
      const { error } = await App.supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      UI.closeModal('modal-login');
      UI.toast('Connecté ! 👋', 'success');
      document.getElementById('login-form').reset();
    } catch (error) {
      let msg = 'Erreur de connexion';
      if (error.message?.includes('Invalid login')) msg = 'Email ou mot de passe incorrect';
      if (error.message?.includes('Email not confirmed')) msg = 'Confirmez votre email';
      err.textContent = msg; err.style.display = 'block';
    } finally { btn.disabled = false; btn.textContent = 'Se connecter'; }
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

    if (password !== confirm) { err.textContent = 'Mots de passe différents'; err.style.display = 'block'; return; }
    if (username.length < 3) { err.textContent = 'Pseudo trop court'; err.style.display = 'block'; return; }

    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

    try {
      const { data, error } = await App.supabase.auth.signUp({
        email, password,
        options: { data: { username, commune } }
      });
      if (error) throw error;

      if (data.user && commune) {
        setTimeout(async () => {
          try { await App.supabase.from('profiles').update({ commune }).eq('id', data.user.id); } catch(e) {}
        }, 2000);
      }

      UI.closeModal('modal-register');
      if (data.user && !data.session) UI.toast('Vérifiez votre email pour confirmer', 'info');
      else UI.toast('Bienvenue ! 🎉', 'success');
      document.getElementById('register-form').reset();
    } catch (error) {
      let msg = 'Erreur';
      if (error.message?.includes('already registered')) msg = 'Email déjà utilisé';
      err.textContent = msg; err.style.display = 'block';
    } finally { btn.disabled = false; btn.textContent = 'Créer mon compte'; }
  },

  async loadProfile() {
    if (!App.currentUser) return;
    try {
      const { data } = await App.supabase.from('profiles').select('*').eq('id', App.currentUser.id).single();
      if (data) App.currentProfile = data;
    } catch (e) { console.error('Profile load error:', e); }
  },

  showLoggedIn() {
    document.getElementById('auth-buttons').style.display = 'none';
    document.getElementById('user-menu').style.display = 'block';
    document.getElementById('btn-new-report').style.display = 'inline-flex';

    const name = App.currentProfile?.username || App.currentUser?.user_metadata?.username || 'Citoyen';
    const initial = name.charAt(0).toUpperCase();
    document.getElementById('user-display-name').textContent = name;
    document.getElementById('user-avatar').textContent = initial;
    document.getElementById('dropdown-avatar').textContent = initial;
    document.getElementById('dropdown-name').textContent = name;
    document.getElementById('dropdown-rep').textContent = `${App.currentProfile?.reputation || 0} pts`;

    if (App.currentProfile?.role === 'admin') {
      document.getElementById('admin-section').style.display = 'block';
    } else {
      document.getElementById('admin-section').style.display = 'none';
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
      <div style="padding:20px">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
          <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--primary),#00C471);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:700">${p.username.charAt(0).toUpperCase()}</div>
          <div>
            <div style="font-size:1.1rem;font-weight:700">${App.esc(p.username)}</div>
            <div style="font-size:.82rem;color:var(--text2)">${App.currentUser.email}</div>
            <div style="font-size:.72rem;color:var(--text3);margin-top:2px">${p.commune ? '📍 '+App.esc(p.commune) : ''} ${p.role==='admin'?' · 🛡️ Admin':''}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
          <div style="text-align:center;padding:14px;background:var(--border-l);border-radius:var(--r)"><div style="font-family:'Space Grotesk';font-size:1.4rem;font-weight:700;color:var(--primary)">${p.reports_count||0}</div><div style="font-size:.7rem;color:var(--text2)">Signalements</div></div>
          <div style="text-align:center;padding:14px;background:var(--border-l);border-radius:var(--r)"><div style="font-family:'Space Grotesk';font-size:1.4rem;font-weight:700;color:var(--primary)">${p.reputation||0}</div><div style="font-size:.7rem;color:var(--text2)">Réputation</div></div>
          <div style="text-align:center;padding:14px;background:var(--border-l);border-radius:var(--r)"><div style="font-family:'Space Grotesk';font-size:1.1rem;font-weight:700;color:var(--primary)">${p.role==='admin'?'Admin':'Citoyen'}</div><div style="font-size:.7rem;color:var(--text2)">Rôle</div></div>
        </div>
      </div>`;
    UI.openModal('modal-profile');
  },

  async showMyReports() {
    if (!App.currentUser) return;
    const { data } = await App.supabase.from('reports').select('*').eq('user_id', App.currentUser.id).order('created_at', { ascending: false });
    const c = document.getElementById('my-reports-content');
    if (!data?.length) {
      c.innerHTML = '<div style="padding:40px;text-align:center"><div style="font-size:2.5rem;margin-bottom:12px">📭</div><p style="color:var(--text2)">Aucun signalement</p></div>';
    } else {
      c.innerHTML = '<div style="padding:16px">' + data.map(r => {
        const cat = App.categories[r.category] || App.categories.other;
        const st = App.statuses[r.status] || App.statuses.pending;
        return `<div class="admin-report" style="cursor:pointer" onclick="UI.closeModal('modal-my-reports');Reports.openDetail('${r.id}')">
          <div class="admin-report__info"><div class="admin-report__title">${cat.emoji} ${App.esc(r.title)}</div><div class="admin-report__meta">${st.icon} ${st.label} · ${App.timeAgo(r.created_at)}</div></div>
        </div>`;
      }).join('') + '</div>';
    }
    UI.openModal('modal-my-reports');
  },

  async showAdmin() {
    if (App.currentProfile?.role !== 'admin') return;
    const { data } = await App.supabase.from('reports').select('*, profiles:user_id(username)').order('created_at', { ascending: false });
    const c = document.getElementById('admin-reports-list');
    if (!data?.length) {
      c.innerHTML = '<p style="text-align:center;color:var(--text2);padding:20px">Aucun signalement</p>';
    } else {
      c.innerHTML = data.map(r => {
        const cat = App.categories[r.category] || App.categories.other;
        return `<div class="admin-report" id="admin-${r.id}">
          <div class="admin-report__info"><div class="admin-report__title">${cat.emoji} ${App.esc(r.title)}</div><div class="admin-report__meta">Par ${App.esc(r.profiles?.username||'?')} · ${App.timeAgo(r.created_at)}</div></div>
          <select onchange="Auth.updateStatus('${r.id}',this.value)"><option value="pending" ${r.status==='pending'?'selected':''}>⏳ Attente</option><option value="acknowledged" ${r.status==='acknowledged'?'selected':''}>👁️ Vu</option><option value="in_progress" ${r.status==='in_progress'?'selected':''}>🔧 Cours</option><option value="resolved" ${r.status==='resolved'?'selected':''}>✅ Résolu</option><option value="rejected" ${r.status==='rejected'?'selected':''}>❌ Rejeté</option></select>
          <div style="width:100%"><textarea placeholder="Réponse officielle..." onchange="Auth.updateResponse('${r.id}',this.value)">${r.admin_response||''}</textarea></div>
        </div>`;
      }).join('');
    }
    UI.openModal('modal-admin');
  },

  async updateStatus(id, status) {
    const u = { status };
    if (status === 'resolved') u.resolved_at = new Date().toISOString();
    await App.supabase.from('reports').update(u).eq('id', id);
    UI.toast('Statut mis à jour', 'success');
    Reports.loadAll();
  },

  async updateResponse(id, response) {
    await App.supabase.from('reports').update({ admin_response: response }).eq('id', id);
    UI.toast('Réponse enregistrée', 'success');
  }
};
