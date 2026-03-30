var Share = {
  init: function() {
    // Listen for deep links on page load
    var params = new URLSearchParams(window.location.search);
    var reportId = params.get('report');
    var articleId = params.get('article');
    if (reportId) {
      setTimeout(function() { Reports.openDetail(reportId); }, 1500);
    }
    if (articleId) {
      setTimeout(function() {
        // Switch to wiki tab
        var wikiTab = document.querySelector('[data-view="wiki"]');
        if (wikiTab) wikiTab.click();
        setTimeout(function() { UI.openArticle(articleId); }, 500);
      }, 1500);
    }
  },

  shareReport: function(reportId) {
    var report = null;
    for (var i = 0; i < App.reports.length; i++) {
      if (App.reports[i].id === reportId) { report = App.reports[i]; break; }
    }
    if (!report) { UI.toast('Signalement introuvable', 'error'); return; }
    var url = window.location.origin + '/?report=' + reportId;
    var title = report.title || 'Signalement';
    this._open(url, title, (report.description || '').substring(0, 120));
  },

  shareArticle: function(articleId, articleTitle) {
    var url = window.location.origin + '/?article=' + articleId;
    var title = articleTitle || 'Article';
    this._open(url, title, '');
  },

  _open: function(url, title, desc) {
    // Try native share first (mobile)
    if (navigator.share) {
      navigator.share({
        title: 'Gwadloup Alert — ' + title,
        text: desc || title,
        url: url
      }).then(function() {
        UI.toast('Partagé !', 'success');
      }).catch(function(err) {
        // User cancelled or error — show fallback
        if (err.name !== 'AbortError') {
          Share._showPopup(url, title);
        }
      });
      return;
    }
    // Desktop fallback
    this._showPopup(url, title);
  },

  _showPopup: function(url, title) {
    // Remove existing
    var old = document.getElementById('share-modal');
    if (old) old.remove();

    var fullTitle = 'Gwadloup Alert — ' + title;

    var modal = document.createElement('div');
    modal.id = 'share-modal';
    modal.className = 'modal open';
    modal.innerHTML = '<div class="modal__bg" id="share-modal-bg"></div>' +
      '<div class="modal__box modal__box--sm" style="max-width:380px">' +
      '<div class="modal__top"><h2><i class="fas fa-share-alt" style="color:var(--green)"></i> Partager</h2>' +
      '<button class="modal__x" id="share-modal-close"><i class="fas fa-times"></i></button></div>' +
      '<div style="padding:16px">' +
      '<p style="font-size:.78rem;color:var(--text2);margin-bottom:12px">' + App.esc(title) + '</p>' +

      '<div class="share-grid">' +
      '<button class="share-item share-item--whatsapp" id="share-wa"><div class="share-item__icon"><i class="fab fa-whatsapp"></i></div><span>WhatsApp</span></button>' +
      '<button class="share-item share-item--facebook" id="share-fb"><div class="share-item__icon"><i class="fab fa-facebook-f"></i></div><span>Facebook</span></button>' +
      '<button class="share-item share-item--twitter" id="share-tw"><div class="share-item__icon"><i class="fab fa-twitter"></i></div><span>Twitter</span></button>' +
      '<button class="share-item share-item--telegram" id="share-tg"><div class="share-item__icon"><i class="fab fa-telegram-plane"></i></div><span>Telegram</span></button>' +
      '<button class="share-item share-item--email" id="share-email"><div class="share-item__icon"><i class="fas fa-envelope"></i></div><span>Email</span></button>' +
      '<button class="share-item share-item--copy" id="share-copy"><div class="share-item__icon"><i class="fas fa-link"></i></div><span>Copier</span></button>' +
      '</div>' +

      '<div class="share-url-box">' +
      '<input type="text" class="inp" id="share-url-input" value="' + url + '" readonly style="font-family:\'JetBrains Mono\',monospace;font-size:.72rem">' +
      '<button class="btn btn--primary" id="share-url-copy" style="flex-shrink:0"><i class="fas fa-copy"></i></button>' +
      '</div>' +

      '</div></div>';

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Encode for URLs
    var encUrl = encodeURIComponent(url);
    var encTitle = encodeURIComponent(fullTitle);
    var encBoth = encodeURIComponent(fullTitle + '\n' + url);

    // Close handlers
    var closeModal = function() {
      modal.remove();
      if (!document.querySelector('.modal.open')) document.body.style.overflow = '';
    };
    document.getElementById('share-modal-bg').addEventListener('click', closeModal);
    document.getElementById('share-modal-close').addEventListener('click', closeModal);

    // Share handlers
    document.getElementById('share-wa').addEventListener('click', function() {
      window.open('https://wa.me/?text=' + encBoth, '_blank');
      closeModal();
    });
    document.getElementById('share-fb').addEventListener('click', function() {
      window.open('https://www.facebook.com/sharer/sharer.php?u=' + encUrl, '_blank', 'width=600,height=400');
      closeModal();
    });
    document.getElementById('share-tw').addEventListener('click', function() {
      window.open('https://twitter.com/intent/tweet?text=' + encTitle + '&url=' + encUrl, '_blank', 'width=600,height=400');
      closeModal();
    });
    document.getElementById('share-tg').addEventListener('click', function() {
      window.open('https://t.me/share/url?url=' + encUrl + '&text=' + encTitle, '_blank', 'width=600,height=400');
      closeModal();
    });
    document.getElementById('share-email').addEventListener('click', function() {
      window.location.href = 'mailto:?subject=' + encTitle + '&body=' + encBoth;
      closeModal();
    });
    document.getElementById('share-copy').addEventListener('click', function() {
      Share._copy(url);
      closeModal();
    });

    // URL copy
    document.getElementById('share-url-copy').addEventListener('click', function() {
      Share._copy(url);
    });
    document.getElementById('share-url-input').addEventListener('click', function() {
      this.select();
    });
  },

  _copy: function(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function() {
        UI.toast('Lien copié dans le presse-papier !', 'success');
      }).catch(function() {
        Share._fallbackCopy(text);
      });
    } else {
      Share._fallbackCopy(text);
    }
  },

  _fallbackCopy: function(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      UI.toast('Lien copié !', 'success');
    } catch (e) {
      UI.toast('Erreur — copiez manuellement', 'error');
    }
    ta.remove();
  }
};
