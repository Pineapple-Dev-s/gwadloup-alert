var PWA = {
  deferredPrompt: null,

  init: function() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(function(reg) {
        console.log('SW registered:', reg.scope);
      }).catch(function(err) {
        console.warn('SW registration failed:', err);
      });
    }

    // Install prompt
    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      PWA.deferredPrompt = e;
      PWA.showInstallButton();
    });

    window.addEventListener('appinstalled', function() {
      PWA.deferredPrompt = null;
      UI.toast('Application installée !', 'success');
      var btn = document.getElementById('pwa-install-btn');
      if (btn) btn.remove();
    });
  },

  showInstallButton: function() {
    if (document.getElementById('pwa-install-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'pwa-install-btn';
    btn.className = 'pwa-install-btn';
    btn.innerHTML = '<i class="fas fa-download"></i> Installer l\'app';
    btn.addEventListener('click', function() { PWA.install(); });
    document.body.appendChild(btn);
  },

  install: function() {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    this.deferredPrompt.userChoice.then(function(result) {
      if (result.outcome === 'accepted') UI.toast('Installation en cours...', 'info');
      PWA.deferredPrompt = null;
      var btn = document.getElementById('pwa-install-btn');
      if (btn) btn.remove();
    });
  }
};
