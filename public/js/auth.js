// ============================================
// GWADLOUP ALÈRT — Authentification
// ============================================

const Auth = {
  async init() {
    // Vérifier la session existante
    const { data: { session } } = await App.supabase.auth.getSession();
    if (session) {
      App.currentUser = session.user;
      await this.loadProfile();
      this.showLoggedInUI();
    }

    // Écouter les changements de session
    App.supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        App.currentUser = session.user;
        await this.loadProfile();
        this.showLoggedInUI();
      } else if (event === 'SIGNED_OUT') {
        App.currentUser = null;
        App.currentProfile = null;
        this.showLoggedOutUI();
      }
    });

    this.bindEvents();
  },

  bindEvents() {
    // Boutons auth
    document.getElementById('btn-login').addEventListener('click', () => {
      UI.openModal('modal-login');
    });

    document.getElementById('btn-register').addEventListener('click', () => {
      UI.openModal('modal-register');
    });

    // Switch entre login et register
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

    // Formulaire de connexion
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.login();
    });

    // Formulaire d'inscription
    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.register();
    });

    // Déconnexion
    document.getElementById('btn-logout').addEventListener('click', async (e) => {
      e.preventDefault();
      await this.logout();
    });

    // Menu utilisateur
    document.getElementById('user-menu-btn').addEventListener('click', () => {
      document.getElementById('user-dropdown').classList.toggle('open');
    });

    // Fermer le dropdown si on clique ailleurs
    document.addEventListener('click', (e) => {
      const userMenu = document.getElementById('user-menu');
      const dropdown = document.getElementById('user-dropdown');
      if (userMenu && !userMenu.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  },

  async login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btnSubmit = document.getElementById('btn-login-submit');

    errorEl.style.display = 'none';
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner-inline"></span> Connexion...';

    try {
      const { data, error } = await App.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      UI.closeModal('modal-login');
      UI.toast('Connexion réussie ! Bienvenue 👋', 'success');

      // Reset form
      document.getElementById('login-form').reset();
    } catch (error) {
      console.error('Erreur login:', error);
      let msg = 'Erreur de connexion';
      if (error.message.includes('Invalid login')) {
        msg = 'Email ou mot de passe incorrect';
      } else if (error.message.includes('Email not confirmed')) {
        msg = 'Veuillez confirmer votre email avant de vous connecter';
      }
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i class="fas fa-sign-in-alt"></i> Se connecter';
    }
  },

  async register() {
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const commune = document.getElementById('register-commune').value;
    const password = document.getElementById('register-password').value;
    const passwordConfirm = document.getElementById('register-password-confirm').value;
    const errorEl = document.getElementById('register-error');
    const btnSubmit = document.getElementById('btn-register-submit');

    errorEl.style.display = 'none';

    // Validations
    if (password !== passwordConfirm) {
      errorEl.textContent = 'Les mots de passe ne correspondent pas';
      errorEl.style.display = 'block';
      return;
    }

    if (username.length < 3) {
      errorEl.textContent = 'Le nom d\'utilisateur doit faire au moins 3 caractères';
      errorEl.style.display = 'block';
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner-inline"></span> Création...';

    try {
      const { data, error } = await App.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
            commune: commune
          }
        }
      });

      if (error) throw error;

      // Mettre à jour la commune dans le profil
      if (data.user && commune) {
        await App.supabase
          .from('profiles')
          .update({ commune: commune })
          .eq('id', data.user.id);
      }

      UI.closeModal('modal-register');

      if (data.user && !data.session) {
        UI.toast('Compte créé ! Vérifiez votre email pour confirmer votre inscription.', 'info');
      } else {
        UI.toast('Compte créé avec succès ! Bienvenue sur Gwadloup Alèrt 🎉', 'success');
      }

      document.getElementById('register-form').reset();
    } catch (error) {
      console.error('Erreur inscription:', error);
      let msg = 'Erreur lors de l\'inscription';
      if (error.message.includes('already registered')) {
        msg = 'Cet email est déjà utilisé';
      } else if (error.message.includes('Password')) {
        msg = 'Le mot de passe doit contenir au moins 6 caractères';
      }
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i class="fas fa-user-plus"></i> Créer mon compte';
    }
  },

  async logout() {
    await App.supabase.auth.signOut();
    document.getElementById('user-dropdown').classList.remove('open');
    UI.toast('Déconnexion réussie', 'info');
  },

  async loadProfile() {
    if (!App.currentUser) return;

    const { data, error } = await App.supabase
      .from('profiles')
      .select('*')
      .eq('id', App.currentUser.id)
      .single();

    if (!error && data) {
      App.currentProfile = data;
    }
  },

  showLoggedInUI() {
    document.getElementById('auth-buttons').style.display = 'none';
    document.getElementById('user-menu').style.display = 'block';
    document.getElementById('btn-new-report').style.display = 'inline-flex';

    const displayName = App.currentProfile?.username || 'Citoyen';
    document.getElementById('user-display-name').textContent = displayName;

    const avatarEl = document.getElementById('user-avatar');
    avatarEl.textContent = displayName.charAt(0).toUpperCase();
  },

  showLoggedOutUI() {
    document.getElementById('auth-buttons').style.display = 'flex';
    document.getElementById('user-menu').style.display = 'none';
    document.getElementById('btn-new-report').style.display = 'none';
  }
};
