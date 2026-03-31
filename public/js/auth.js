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
        // Show confirmation message
        UI._showEmailConfirmation(email);
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

    // Banner admin
    var html = UI.showBannerAdmin();

    // Analytics section
    html += '<div style="border-top:1px solid var(--border);margin:16px 0;padding-top:16px"></div>';
    html += '<h3 style="margin-bottom:14px;font-size:.9rem;display:flex;align-items:center;gap:6px"><i class="fas fa-chart-line" style="color:var(--blue)"></i> Analytics <button class="btn btn--ghost" onclick="Auth.loadAnalytics()" style="font-size:.7rem"><i class="fas fa-sync"></i></button></h3>';
    html += '<div id="admin-analytics"><p style="color:var(--text3);font-size:.8rem">Chargement...</p></div>';

    // Reports management
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

    // Load analytics
    this.loadAnalytics();
  },

  loadAnalytics: async function() {
    var el = document.getElementById('admin-analytics');
    if (!el) return;
    el.innerHTML = '<p style="color:var(--text3);font-size:.8rem"><span class="spinner"></span> Chargement analytics...</p>';

    try {
      var resp = await fetch('/api/analytics?days=30');
      var data = await resp.json();
      if (data.error) throw new Error(data.error);

      var html = '';

      // ─── HERO STATS ───
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:16px">';
      html += '<div class="sc sc--b" style="padding:12px"><div class="sc__v" style="font-size:1.4rem">' + (data.allTimePageviews || 0).toLocaleString() + '</div><div class="sc__l">Pages vues (total)</div></div>';
      html += '<div class="sc sc--g" style="padding:12px"><div class="sc__v" style="font-size:1.4rem">' + (data.allTimeVisitors || 0).toLocaleString() + '</div><div class="sc__l">Visiteurs uniques</div></div>';
      html += '<div class="sc sc--o" style="padding:12px"><div class="sc__v" style="font-size:1.4rem">' + (data.todayPageviews || 0) + '</div><div class="sc__l">Vues aujourd\'hui</div></div>';
      html += '<div class="sc sc--p" style="padding:12px"><div class="sc__v" style="font-size:1.4rem">' + (data.todayVisitors || 0) + '</div><div class="sc__l">Visiteurs aujourd\'hui</div></div>';
      html += '<div class="sc" style="padding:12px;border-color:var(--cyan)"><div class="sc__v" style="font-size:1.4rem;color:var(--cyan)">' + (data.currentConcurrent || 0) + '</div><div class="sc__l">🟢 En ligne</div></div>';
      html += '<div class="sc" style="padding:12px;border-color:var(--yellow)"><div class="sc__v" style="font-size:1.4rem;color:var(--yellow)">' + (data.peakConcurrent || 0) + '</div><div class="sc__l">Pic concurrent</div></div>';
      html += '</div>';

      // ─── INSIGHTS ROW ───
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:16px">';
      html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:10px;text-align:center"><div style="font-size:1.1rem;font-weight:700;color:var(--text)">' + (data.avgDailyPageviews || 0) + '</div><div style="font-size:.68rem;color:var(--text2)">Moy. vues/jour</div></div>';
      html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:10px;text-align:center"><div style="font-size:1.1rem;font-weight:700;color:var(--text)">' + (data.avgPagesPerVisit || '0') + '</div><div style="font-size:.68rem;color:var(--text2)">Pages/visite</div></div>';
      html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:10px;text-align:center"><div style="font-size:1.1rem;font-weight:700;color:' + ((data.growthPercent || 0) >= 0 ? 'var(--green)' : 'var(--red)') + '">' + ((data.growthPercent || 0) >= 0 ? '+' : '') + (data.growthPercent || 0) + '%</div><div style="font-size:.68rem;color:var(--text2)">Croissance 7j</div></div>';
      html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:10px;text-align:center"><div style="font-size:1.1rem;font-weight:700;color:var(--text)">' + (data.bounceRate || '0%') + '</div><div style="font-size:.68rem;color:var(--text2)">Taux rebond est.</div></div>';
      if (data.bestDay) {
        html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:10px;text-align:center"><div style="font-size:.85rem;font-weight:700;color:var(--yellow)">' + data.bestDayPageviews + '</div><div style="font-size:.68rem;color:var(--text2)">Record le ' + data.bestDay + '</div></div>';
      }
      html += '</div>';

      // ─── DAILY CHART ───
      if (data.daily && data.daily.length > 0) {
        html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:14px;margin-bottom:14px">';
        html += '<h4 style="font-size:.82rem;margin-bottom:10px;color:var(--text2)"><i class="fas fa-chart-area" style="color:var(--blue)"></i> Trafic 30 derniers jours</h4>';
        var maxPv = 1;
        for (var i = 0; i < data.daily.length; i++) { if (data.daily[i].pageviews > maxPv) maxPv = data.daily[i].pageviews; }
        html += '<div style="display:flex;align-items:flex-end;gap:2px;height:90px">';
        for (var i = 0; i < data.daily.length; i++) {
          var d = data.daily[i];
          var h = Math.max(3, Math.round((d.pageviews / maxPv) * 80));
          html += '<div title="' + d.date + '\n' + d.pageviews + ' vues\n' + d.visitors + ' visiteurs\n' + (d.newVisitors || 0) + ' nouveaux" style="flex:1;min-width:3px;height:' + h + 'px;background:linear-gradient(to top,var(--blue),var(--green));border-radius:2px 2px 0 0;cursor:pointer;transition:opacity .15s" onmouseover="this.style.opacity=0.6" onmouseout="this.style.opacity=1"></div>';
        }
        html += '</div>';
        html += '<div style="display:flex;justify-content:space-between;font-size:.62rem;color:var(--text3);margin-top:4px"><span>' + data.daily[0].date + '</span><span>Période: ' + data.period + '</span><span>' + data.daily[data.daily.length - 1].date + '</span></div>';
        html += '</div>';
      }

      // ─── COLUMNS ───
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';

      // Top pages
      html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:12px">';
      html += '<h4 style="font-size:.8rem;margin-bottom:8px;color:var(--text2)"><i class="fas fa-file" style="color:var(--green)"></i> Pages populaires</h4>';
      if (data.topPages && data.topPages.length > 0) {
        for (var i = 0; i < Math.min(data.topPages.length, 10); i++) {
          var p = data.topPages[i];
          html += '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:.72rem"><span style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px" title="' + App.esc(p.name) + '">' + App.esc(p.name) + '</span><span style="color:var(--text2);font-weight:600">' + p.count + '</span></div>';
        }
      } else html += '<p style="color:var(--text3);font-size:.72rem">Aucune donnée</p>';
      html += '</div>';

      // Top referrers
      html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:12px">';
      html += '<h4 style="font-size:.8rem;margin-bottom:8px;color:var(--text2)"><i class="fas fa-external-link-alt" style="color:var(--orange)"></i> Sources de trafic</h4>';
      if (data.topReferrers && data.topReferrers.length > 0) {
        for (var i = 0; i < Math.min(data.topReferrers.length, 10); i++) {
          var r = data.topReferrers[i];
          var refIcon = r.name.indexOf('facebook') !== -1 ? '📘' : r.name.indexOf('instagram') !== -1 ? '📸' : r.name.indexOf('twitter') !== -1 || r.name.indexOf('x.com') !== -1 ? '🐦' : r.name.indexOf('tiktok') !== -1 ? '🎵' : r.name.indexOf('google') !== -1 ? '🔍' : r.name.indexOf('whatsapp') !== -1 ? '💬' : '🔗';
          html += '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:.72rem"><span style="color:var(--text)">' + refIcon + ' ' + App.esc(r.name) + '</span><span style="color:var(--text2);font-weight:600">' + r.count + '</span></div>';
        }
      } else html += '<p style="color:var(--text3);font-size:.72rem">Trafic direct uniquement</p>';
      html += '</div>';
      html += '</div>';

      // ─── DEVICES + BROWSERS + COUNTRIES ───
      html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:12px">';

      // Devices
      html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:12px">';
      html += '<h4 style="font-size:.8rem;margin-bottom:8px;color:var(--text2)"><i class="fas fa-mobile-alt" style="color:var(--purple)"></i> Appareils</h4>';
      var devTotal = (data.devices.mobile || 0) + (data.devices.tablet || 0) + (data.devices.desktop || 0);
      if (devTotal > 0) {
        var devItems = [{ name: '📱 Mobile', count: data.devices.mobile || 0, color: 'var(--purple)' }, { name: '💻 Desktop', count: data.devices.desktop || 0, color: 'var(--blue)' }, { name: '📋 Tablet', count: data.devices.tablet || 0, color: 'var(--orange)' }];
        for (var i = 0; i < devItems.length; i++) {
          var pct = Math.round((devItems[i].count / devTotal) * 100);
          html += '<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-size:.7rem;margin-bottom:2px"><span>' + devItems[i].name + '</span><span style="color:var(--text2);font-weight:600">' + pct + '% (' + devItems[i].count + ')</span></div><div style="height:4px;background:var(--bg4);border-radius:2px"><div style="height:100%;width:' + pct + '%;background:' + devItems[i].color + ';border-radius:2px;transition:width .6s ease"></div></div></div>';
        }
      }
      html += '</div>';

      // Browsers
      html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:12px">';
      html += '<h4 style="font-size:.8rem;margin-bottom:8px;color:var(--text2)"><i class="fas fa-globe" style="color:var(--blue)"></i> Navigateurs</h4>';
      if (data.browsers && data.browsers.length > 0) {
        var browserIcons = { Chrome: '🌐', Firefox: '🦊', Safari: '🧭', Edge: '🔷', Opera: '🔴', Autre: '❓' };
        for (var i = 0; i < Math.min(data.browsers.length, 6); i++) {
          html += '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:.72rem"><span>' + (browserIcons[data.browsers[i].name] || '🌐') + ' ' + App.esc(data.browsers[i].name) + '</span><span style="color:var(--text2);font-weight:600">' + data.browsers[i].count + '</span></div>';
        }
      }
      html += '</div>';

      // Countries
      html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:12px">';
      html += '<h4 style="font-size:.8rem;margin-bottom:8px;color:var(--text2)"><i class="fas fa-flag" style="color:var(--green)"></i> Pays/Régions</h4>';
      if (data.countries && data.countries.length > 0) {
        var flagMap = { France: '🇫🇷', Guadeloupe: '🇬🇵', Martinique: '🇲🇶', Guyane: '🇬🇫', Réunion: '🇷🇪', 'États-Unis': '🇺🇸', 'Royaume-Uni': '🇬🇧', Canada: '🇨🇦', Belgique: '🇧🇪', Suisse: '🇨🇭', Haïti: '🇭🇹', Sénégal: '🇸🇳', Cameroun: '🇨🇲', Allemagne: '🇩🇪', Espagne: '🇪🇸', Italie: '🇮🇹', Brésil: '🇧🇷', Maroc: '🇲🇦' };
        for (var i = 0; i < Math.min(data.countries.length, 8); i++) {
          var flag = flagMap[data.countries[i].name] || '🌍';
          html += '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:.72rem"><span>' + flag + ' ' + App.esc(data.countries[i].name) + '</span><span style="color:var(--text2);font-weight:600">' + data.countries[i].count + '</span></div>';
        }
      }
      html += '</div>';
      html += '</div>';

      // ─── HOURLY HEATMAP ───
      if (data.hourly && Object.keys(data.hourly).length > 0) {
        html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:12px;margin-top:12px">';
        html += '<h4 style="font-size:.8rem;margin-bottom:8px;color:var(--text2)"><i class="fas fa-clock" style="color:var(--cyan)"></i> Activité par heure</h4>';
        var maxH = 1;
        for (var h = 0; h < 24; h++) { var val = data.hourly[String(h)] || 0; if (val > maxH) maxH = val; }
        html += '<div style="display:flex;gap:2px;align-items:flex-end;height:50px">';
        for (var h = 0; h < 24; h++) {
          var val = data.hourly[String(h)] || 0;
          var barH = Math.max(2, Math.round((val / maxH) * 45));
          var opacity = val > 0 ? 0.4 + (val / maxH) * 0.6 : 0.1;
          html += '<div title="' + h + 'h: ' + val + ' vues" style="flex:1;height:' + barH + 'px;background:var(--cyan);opacity:' + opacity + ';border-radius:2px 2px 0 0;cursor:pointer"></div>';
        }
        html += '</div>';
        html += '<div style="display:flex;justify-content:space-between;font-size:.55rem;color:var(--text3);margin-top:2px"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>';
        html += '</div>';
      }

      // ─── EVENTS ───
      if (data.events && Object.keys(data.events).length > 0) {
        html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:12px;margin-top:12px">';
        html += '<h4 style="font-size:.8rem;margin-bottom:8px;color:var(--text2)"><i class="fas fa-bolt" style="color:var(--yellow)"></i> Événements trackés</h4>';
        var eventIcons = { report_created: '📝', report_voted: '👍', comment_added: '💬', article_published: '📖', user_registered: '👤', profile_viewed: '👁️' };
        for (var ev in data.events) {
          html += '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:.72rem"><span style="color:var(--text)">' + (eventIcons[ev] || '⚡') + ' ' + App.esc(ev) + '</span><span style="color:var(--yellow);font-weight:700">' + data.events[ev] + '</span></div>';
        }
        html += '</div>';
      }

      // ─── LIVE VISITORS ───
      if (data.live && data.live.length > 0) {
        html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:12px;margin-top:12px">';
        html += '<h4 style="font-size:.8rem;margin-bottom:8px;color:var(--text2)"><span style="display:inline-block;width:8px;height:8px;background:var(--green);border-radius:50%;margin-right:4px;animation:blink 1.5s infinite"></span> Visiteurs en direct (' + data.live.length + ')</h4>';
        for (var i = 0; i < Math.min(data.live.length, 15); i++) {
          var v = data.live[i];
          var t = new Date(v.time);
          var timeStr = t.getHours().toString().padStart(2, '0') + ':' + t.getMinutes().toString().padStart(2, '0') + ':' + t.getSeconds().toString().padStart(2, '0');
          var deviceEmoji = v.device === 'mobile' ? '📱' : v.device === 'tablet' ? '📋' : '💻';
          html += '<div style="display:flex;gap:6px;align-items:center;padding:3px 0;font-size:.68rem;color:var(--text2)">' +
            '<span style="color:var(--text3);min-width:52px;font-family:\'JetBrains Mono\',monospace">' + timeStr + '</span>' +
            '<span style="min-width:16px">' + deviceEmoji + '</span>' +
            '<span style="color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + App.esc(v.page) + '</span>' +
            '<span style="color:var(--text3)">' + App.esc(v.browser || '') + '</span>' +
            (v.ref ? '<span style="color:var(--orange);font-size:.6rem">' + App.esc(v.ref) + '</span>' : '') +
            '<span style="color:var(--text3);font-size:.6rem">' + App.esc(v.country || '') + '</span>' +
          '</div>';
        }
        html += '</div>';
      }

      // ─── PERIOD SELECTOR ───
      html += '<div style="display:flex;gap:4px;margin-top:12px;justify-content:center">';
      html += '<button class="btn btn--ghost" onclick="Auth._loadAnalyticsPeriod(7)" style="font-size:.7rem">7j</button>';
      html += '<button class="btn btn--ghost" onclick="Auth._loadAnalyticsPeriod(30)" style="font-size:.7rem">30j</button>';
      html += '<button class="btn btn--ghost" onclick="Auth._loadAnalyticsPeriod(90)" style="font-size:.7rem">90j</button>';
      html += '<button class="btn btn--ghost" onclick="Auth._loadAnalyticsPeriod(365)" style="font-size:.7rem">1 an</button>';
      html += '<button class="btn btn--ghost" onclick="Auth.loadAnalytics()" style="font-size:.7rem"><i class="fas fa-sync"></i></button>';
      html += '</div>';

      el.innerHTML = html;
    } catch(e) {
      console.error('Analytics error:', e);
      el.innerHTML = '<p style="color:var(--red);font-size:.8rem"><i class="fas fa-exclamation-circle"></i> Erreur : ' + App.esc(e.message || 'Échec chargement') + '</p>';
    }
  },

  _loadAnalyticsPeriod: async function(days) {
    var el = document.getElementById('admin-analytics');
    if (!el) return;
    el.innerHTML = '<p style="color:var(--text3);font-size:.8rem"><span class="spinner"></span> Chargement ' + days + ' jours...</p>';
    try {
      var resp = await fetch('/api/analytics?days=' + days);
      var data = await resp.json();
      // Re-use the same render logic
      Auth.loadAnalytics();
    } catch(e) {
      el.innerHTML = '<p style="color:var(--red)">Erreur</p>';
    }
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
  },

  _showEmailConfirmation: function(email) {
    var overlay = document.createElement('div');
    overlay.id = 'email-confirm-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.6);backdrop-filter:blur(6px)';

    var box = document.createElement('div');
    box.style.cssText = 'background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);padding:32px;max-width:420px;width:100%;text-align:center;box-shadow:var(--shadow-xl);animation:mslide .25s ease';

    box.innerHTML = '<div style="width:64px;height:64px;border-radius:50%;background:var(--green-bg);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:1.8rem"><i class="fas fa-envelope" style="color:var(--green)"></i></div>' +
      '<h2 style="font-size:1.2rem;font-weight:700;margin-bottom:8px">Vérifiez votre email !</h2>' +
      '<p style="color:var(--text2);font-size:.88rem;line-height:1.6;margin-bottom:16px">Un email de confirmation a été envoyé à :<br><strong style="color:var(--text)">' + App.esc(email) + '</strong></p>' +
      '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:14px;margin-bottom:16px;text-align:left">' +
        '<p style="font-size:.82rem;color:var(--text2);margin-bottom:8px"><strong style="color:var(--text)">📋 Étapes :</strong></p>' +
        '<p style="font-size:.8rem;color:var(--text2);margin-bottom:4px">1. Ouvrez votre boîte mail (' + App.esc(email.split('@')[1]) + ')</p>' +
        '<p style="font-size:.8rem;color:var(--text2);margin-bottom:4px">2. Cliquez sur le lien de confirmation</p>' +
        '<p style="font-size:.8rem;color:var(--text2)">3. Revenez ici et connectez-vous !</p>' +
      '</div>' +
      '<p style="font-size:.75rem;color:var(--text3);margin-bottom:16px">💡 Vérifiez aussi vos spams/courrier indésirable</p>' +
      '<button class="btn btn--primary btn--full btn--lg" onclick="document.getElementById(\'email-confirm-overlay\').remove()"><i class="fas fa-check"></i> J\'ai compris</button>';

    overlay.appendChild(box);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  },
};
