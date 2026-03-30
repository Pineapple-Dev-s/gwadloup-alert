var Share = {
  init: function() {
    var hash = window.location.hash;
    if (hash) {
      var parts = hash.replace('#', '').split('/');
      if (parts[0] === 'report' && parts[1]) {
        setTimeout(function() { Reports.openDetail(parts[1]); }, 2000);
      }
      if (parts[0] === 'article' && parts[1]) {
        setTimeout(function() {
          var wikiTab = document.querySelector('[data-view="wiki"]');
          if (wikiTab) wikiTab.click();
          setTimeout(function() { UI.openArticle(parts[1]); }, 500);
        }, 2000);
      }
    }
    var params = new URLSearchParams(window.location.search);
    if (params.get('report')) {
      setTimeout(function() { Reports.openDetail(params.get('report')); }, 2000);
    }
    if (params.get('article')) {
      setTimeout(function() {
        var wikiTab = document.querySelector('[data-view="wiki"]');
        if (wikiTab) wikiTab.click();
        setTimeout(function() { UI.openArticle(params.get('article')); }, 500);
      }, 2000);
    }
  },

  shareReport: function(reportId) {
    var report = null;
    for (var i = 0; i < App.reports.length; i++) {
      if (App.reports[i].id === reportId) { report = App.reports[i]; break; }
    }
    if (!report) { UI.toast('Signalement introuvable', 'error'); return; }
    var url = window.location.origin + '/#report/' + reportId;
    this._openShareModal(url, report.title);
  },

  // ALIAS — fixes onclick="Share.report(...)" calls
  report: function(reportId) {
    this.shareReport(reportId);
  },

  shareArticle: function(articleId, articleTitle) {
    var url = window.location.origin + '/#article/' + articleId;
    this._openShareModal(url, articleTitle || 'Article');
  },

  _openShareModal: function(url, title) {
    if (navigator.share) {
      navigator.share({
        title: 'Gwadloup Alert',
        text: title,
        url: url
      }).catch(function() {
        Share._showModal(url, title);
      });
      return;
    }
    this._showModal(url, title);
  },

  _showModal: function(url, title) {
    var old = document.getElementById('share-overlay');
    if (old) old.remove();

    var fullText = title + ' — Gwadloup Alert';
    var encUrl = encodeURIComponent(url);
    var encText = encodeURIComponent(fullText);
    var encBoth = encodeURIComponent(fullText + '\n' + url);

    var overlay = document.createElement('div');
    overlay.id = 'share-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.6);backdrop-filter:blur(4px)';

    var box = document.createElement('div');
    box.style.cssText = 'background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:0;max-width:380px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,.4);animation:mslide .2s ease';

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border)';
    header.innerHTML = '<h3 style="font-size:.9rem;font-weight:700;display:flex;align-items:center;gap:6px"><i class="fas fa-share-alt" style="color:var(--green)"></i> Partager</h3>';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'modal__x';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.addEventListener('click', function() { overlay.remove(); });
    header.appendChild(closeBtn);
    box.appendChild(header);

    var body = document.createElement('div');
    body.style.cssText = 'padding:16px';

    body.innerHTML = '<p style="font-size:.78rem;color:var(--text2);margin-bottom:14px;padding:8px;background:var(--bg);border-radius:var(--r);border:1px solid var(--border)"><i class="fas fa-link" style="color:var(--green);margin-right:4px"></i> ' + App.esc(title) + '</p>';

    var grid = document.createElement('div');
    grid.className = 'share-grid';

    var buttons = [
      { id: 'wa', icon: 'fab fa-whatsapp', label: 'WhatsApp', url: 'https://wa.me/?text=' + encBoth, cls: 'share-item--whatsapp' },
      { id: 'fb', icon: 'fab fa-facebook-f', label: 'Facebook', url: 'https://www.facebook.com/sharer/sharer.php?u=' + encUrl, cls: 'share-item--facebook' },
      { id: 'tw', icon: 'fab fa-twitter', label: 'Twitter', url: 'https://twitter.com/intent/tweet?text=' + encText + '&url=' + encUrl, cls: 'share-item--twitter' },
      { id: 'tg', icon: 'fab fa-telegram-plane', label: 'Telegram', url: 'https://t.me/share/url?url=' + encUrl + '&text=' + encText, cls: 'share-item--telegram' },
      { id: 'em', icon: 'fas fa-envelope', label: 'Email', url: 'mailto:?subject=' + encText + '&body=' + encBoth, cls: 'share-item--email' },
      { id: 'cp', icon: 'fas fa-link', label: 'Copier', url: null, cls: 'share-item--copy' }
    ];

    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var btn = document.createElement('button');
      btn.className = 'share-item ' + b.cls;
      btn.innerHTML = '<div class="share-item__icon"><i class="' + b.icon + '"></i></div><span>' + b.label + '</span>';
      if (b.url) {
        (function(shareUrl) {
          btn.addEventListener('click', function() {
            if (shareUrl.startsWith('mailto:')) {
              window.location.href = shareUrl;
            } else {
              window.open(shareUrl, '_blank', 'width=600,height=400,noopener');
            }
            overlay.remove();
          });
        })(b.url);
      } else {
        btn.addEventListener('click', function() {
          Share._copyText(url);
          overlay.remove();
        });
      }
      grid.appendChild(btn);
    }
    body.appendChild(grid);

    var urlBox = document.createElement('div');
    urlBox.style.cssText = 'display:flex;gap:4px;margin-top:4px';
    var urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'inp';
    urlInput.value = url;
    urlInput.readOnly = true;
    urlInput.style.cssText = 'flex:1;font-family:"JetBrains Mono",monospace;font-size:.7rem';
    urlInput.addEventListener('click', function() { this.select(); });
    var copyBtn2 = document.createElement('button');
    copyBtn2.className = 'btn btn--primary';
    copyBtn2.innerHTML = '<i class="fas fa-copy"></i>';
    copyBtn2.addEventListener('click', function() { Share._copyText(url); });
    urlBox.appendChild(urlInput);
    urlBox.appendChild(copyBtn2);
    body.appendChild(urlBox);

    box.appendChild(body);
    overlay.appendChild(box);

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  },

  _copyText: function(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function() {
        UI.toast('Lien copié !', 'success');
      }).catch(function() {
        Share._fallback(text);
      });
    } else {
      Share._fallback(text);
    }
  },

  _fallback: function(text) {
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
      UI.toast('Copiez manuellement le lien', 'warning');
    }
    ta.remove();
  }
};
