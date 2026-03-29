modals() {
    // Close buttons
    document.addEventListener('click', function(e) {
      if (e.target.hasAttribute('data-close') || e.target.closest('[data-close]')) {
        var modal = e.target.closest('.modal');
        if (modal) {
          modal.classList.remove('open');
          document.body.style.overflow = '';
        }
      }
    });

    // Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.open').forEach(function(m) { m.classList.remove('open'); });
        document.body.style.overflow = '';
      }
    });

    // New report — NE PAS appeler resetForm ici, seulement au clic
    document.getElementById('btn-new-report').addEventListener('click', function() {
      if (!App.currentUser) {
        UI.toast('Connectez-vous d\'abord', 'warning');
        UI.openModal('modal-login');
        return;
      }
      // Reset form safely
      var form = document.getElementById('report-form');
      if (form) form.reset();
      ImageUpload.reset();

      // Reset steps UI
      document.querySelectorAll('.fstep').forEach(function(s) { s.classList.remove('active'); });
      var s1 = document.getElementById('step-1');
      if (s1) s1.classList.add('active');
      document.querySelectorAll('.steps__i').forEach(function(s) { s.classList.remove('active', 'done'); });
      var si = document.querySelector('.steps__i[data-step="1"]');
      if (si) si.classList.add('active');
      var b1 = document.getElementById('btn-step1-next');
      if (b1) b1.disabled = true;
      var b2 = document.getElementById('btn-step2-next');
      if (b2) b2.disabled = true;
      var li = document.getElementById('location-info');
      if (li) li.style.display = 'none';
      var dc = document.getElementById('desc-count');
      if (dc) dc.textContent = '0';

      UI.openModal('modal-report');
      setTimeout(function() { MapManager.initMiniMap(); }, 400);
    });
  },
