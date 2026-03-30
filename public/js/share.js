var Share = {
  report: function(report) {
    var url = window.location.origin + '?report=' + report.id;
    var text = '🏝️ ' + report.title + ' — Gwadloup Alert';

    if (navigator.share) {
      // For mobile (Native share)
      navigator.share({ title: text, text: report.description.substring(0, 100) + '...', url: url }).catch(function() {
        // Fallback if browser blocks or user cancels native share
        Share.showMenu(url, text, report);
      });
    } else {
      // Fallback for PC / Desktop
      Share.showMenu(url, text, report);
    }
  },

  article: function(article) {
    var url = window.location.origin + '?article=' + article.id;
    var text = '📖 ' + article.title + ' — Gwadloup Alert';

    if (navigator.share) {
      navigator.share({ title: text, url: url }).catch(function() {
        Share.showMenu(url, text);
      });
    } else {
      Share.showMenu(url, text);
    }
  },

  showMenu: function(url, text, report) {
    var existing = document.getElementById('share-popup');
    if (existing) existing.remove();

    var popup = document.createElement('div');
    popup.id = 'share-popup';
    popup.className = 'share-popup';
    popup.innerHTML = '<div class="share-popup__bg" onclick="this.parentNode.remove()"></div>' +
      '<div class="share-popup__box">' +
      '<div class="share-popup__title"><i class="fas fa-share-alt"></i> Partager</div>' +
      '<div class="share-popup__buttons">' +
      '<button class="share-btn share-btn--wa" onclick="Share.openUrl(\'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url) + '\')"><i class="fab fa-whatsapp"></i> WhatsApp</button>' +
      '<button class="share-btn share-btn--fb" onclick="Share.openUrl(\'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) + '\')"><i class="fab fa-facebook"></i> Facebook</button>' +
      '<button class="share-btn share-btn--tw" onclick="Share.openUrl(\'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url) + '\')"><i class="fab fa-twitter"></i> Twitter</button>' +
      '<button class="share-btn share-btn--tg" onclick="Share.openUrl(\'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text) + '\')"><i class="fab fa-telegram"></i> Telegram</button>' +
      '<button class="share-btn share-btn--email" onclick="Share.openUrl(\'mailto:?subject=' + encodeURIComponent(text) + '&body=' + encodeURIComponent(text + '\\n\\n' + url) + '\')"><i class="fas fa-envelope"></i> Email</button>' +
      '<button class="share-btn share-btn--copy" onclick="Share.copyLink(\'' + url + '\')"><i class="fas fa-link"></i> Copier le lien</button>' +
      '</div>' +
      '<div class="share-popup__url"><input type="text" value="' + url + '" readonly onclick="this.select()"><button onclick="Share.copyLink(\'' + url + '\')"><i class="fas fa-copy"></i></button></div>' +
      '<button class="btn btn--ghost" style="width:100%;margin-top:8px" onclick="this.closest(\'.share-popup\').remove()">Fermer</button>' +
      '</div>';
    document.body.appendChild(popup);
  },

  openUrl: function(url) {
    window.open(url, '_blank', 'width=600,height=400');
    var popup = document.getElementById('share-popup');
    if (popup) popup.remove();
  },

  copyLink: function(url) {
    navigator.clipboard.writeText(url).then(function() {
      UI.toast('Lien copié !', 'success');
    }).catch(function() {
      var input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
      UI.toast('Lien copié !', 'success');
    });
    var popup = document.getElementById('share-popup');
    if (popup) popup.remove();
  }
};
