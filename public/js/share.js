var Share = {
  _currentReport: null,
  _currentArticle: null,

  report: function(id) {
    var report = App.reports.find(function(r) { return r.id === id; });
    if (!report) { UI.toast('Signalement introuvable', 'error'); return; }
    var url = window.location.origin + '?report=' + id;
    var text = '🏝️ ' + report.title + ' — Gwadloup Alert';
    var desc = (report.description || '').substring(0, 100);

    if (navigator.share) {
      navigator.share({ title: text, text: desc, url: url }).catch(function() {});
    } else {
      Share._showMenu(url, text);
    }
  },

  article: function(id) {
    var url = window.location.origin + '?article=' + id;
    var titleEl = document.querySelector('#wiki-article-detail h1');
    var title = titleEl ? titleEl.textContent : 'Article';
    var text = '📖 ' + title + ' — Gwadloup Alert';

    if (navigator.share) {
      navigator.share({ title: text, url: url }).catch(function() {});
    } else {
      Share._showMenu(url, text);
    }
  },

  _showMenu: function(url, text) {
    var existing = document.getElementById('share-popup');
    if (existing) existing.remove();

    var encodedText = encodeURIComponent(text);
    var encodedUrl = encodeURIComponent(url);
    var encodedBoth = encodeURIComponent(text + ' ' + url);

    var popup = document.createElement('div');
    popup.id = 'share-popup';
    popup.className = 'share-popup';

    var boxHtml = '<div class="share-popup__box">' +
      '<div class="share-popup__title"><i class="fas fa-share-alt"></i> Partager</div>' +
      '<div class="share-popup__buttons">' +
      '<button class="share-btn share-btn--wa" data-url="https://wa.me/?text=' + encodedBoth + '"><i class="fab fa-whatsapp"></i> WhatsApp</button>' +
      '<button class="share-btn share-btn--fb" data-url="https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl + '"><i class="fab fa-facebook"></i> Facebook</button>' +
      '<button class="share-btn share-btn--tw" data-url="https://twitter.com/intent/tweet?text=' + encodedText + '&url=' + encodedUrl + '"><i class="fab fa-twitter"></i> Twitter</button>' +
      '<button class="share-btn share-btn--tg" data-url="https://t.me/share/url?url=' + encodedUrl + '&text=' + encodedText + '"><i class="fab fa-telegram"></i> Telegram</button>' +
      '<button class="share-btn share-btn--email" data-url="mailto:?subject=' + encodedText + '&body=' + encodedBoth + '"><i class="fas fa-envelope"></i> Email</button>' +
      '<button class="share-btn share-btn--copy" data-copy="' + url + '"><i class="fas fa-link"></i> Copier le lien</button>' +
      '</div>' +
      '<div class="share-popup__url"><input type="text" value="' + url + '" readonly><button class="share-copy-btn"><i class="fas fa-copy"></i></button></div>' +
      '<button class="btn btn--ghost share-close-btn" style="width:100%;margin-top:8px">Fermer</button>' +
      '</div>';

    popup.innerHTML = '<div class="share-popup__bg"></div>' + boxHtml;
    document.body.appendChild(popup);

    // Event listeners
    popup.querySelector('.share-popup__bg').addEventListener('click', function() { popup.remove(); });
    popup.querySelector('.share-close-btn').addEventListener('click', function() { popup.remove(); });

    // Share buttons
    popup.querySelectorAll('.share-btn[data-url]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        window.open(btn.getAttribute('data-url'), '_blank', 'width=600,height=400');
        popup.remove();
      });
    });

    // Copy button in buttons grid
    var copyBtn = popup.querySelector('.share-btn--copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        Share._copyToClipboard(copyBtn.getAttribute('data-copy'));
        popup.remove();
      });
    }

    // Copy button next to URL
    var urlCopyBtn = popup.querySelector('.share-copy-btn');
    if (urlCopyBtn) {
      urlCopyBtn.addEventListener('click', function() {
        var input = popup.querySelector('.share-popup__url input');
        Share._copyToClipboard(input.value);
        popup.remove();
      });
    }

    // Select URL on click
    var urlInput = popup.querySelector('.share-popup__url input');
    if (urlInput) urlInput.addEventListener('click', function() { this.select(); });
  },

  _copyToClipboard: function(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        UI.toast('Lien copié !', 'success');
      }).catch(function() {
        Share._fallbackCopy(text);
      });
    } else {
      Share._fallbackCopy(text);
    }
  },

  _fallbackCopy: function(text) {
    var input = document.createElement('textarea');
    input.value = text;
    input.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(input);
    input.select();
    try { document.execCommand('copy'); UI.toast('Lien copié !', 'success'); }
    catch (e) { UI.toast('Impossible de copier', 'error'); }
    input.remove();
  }
};
