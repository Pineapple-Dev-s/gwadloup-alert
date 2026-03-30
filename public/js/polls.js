var Polls = {
  formVisible: false,

  toggleForm: function() {
    this.formVisible = !this.formVisible;
    var container = document.getElementById('poll-form-container');
    if (container) container.style.display = this.formVisible ? 'block' : 'none';
  },

  getFormHtml: function() {
    return '<div id="poll-form-container" style="display:none;margin-top:12px;padding:12px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r)">' +
      '<h4 style="font-size:.82rem;margin-bottom:8px;display:flex;align-items:center;gap:6px"><i class="fas fa-poll" style="color:var(--blue)"></i> Sondage (optionnel)</h4>' +
      '<div class="field"><label>Question</label><input type="text" class="inp" id="poll-question" placeholder="Votre question..." maxlength="200"></div>' +
      '<div id="poll-options">' +
        '<div class="poll-opt-row"><input type="text" class="inp poll-option-input" placeholder="Option 1" maxlength="100"></div>' +
        '<div class="poll-opt-row"><input type="text" class="inp poll-option-input" placeholder="Option 2" maxlength="100"></div>' +
      '</div>' +
      '<button type="button" class="btn btn--ghost" id="btn-add-poll-option" style="margin-top:4px;font-size:.72rem"><i class="fas fa-plus"></i> Ajouter option</button>' +
    '</div>';
  },

  initForm: function() {
    var addBtn = document.getElementById('btn-add-poll-option');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        var container = document.getElementById('poll-options');
        var count = container.querySelectorAll('.poll-opt-row').length;
        if (count >= 6) { UI.toast('Maximum 6 options', 'warning'); return; }
        var row = document.createElement('div');
        row.className = 'poll-opt-row';
        row.innerHTML = '<input type="text" class="inp poll-option-input" placeholder="Option ' + (count + 1) + '" maxlength="100">' +
          '<button type="button" class="btn btn--ghost" onclick="this.parentElement.remove()" style="padding:4px 8px"><i class="fas fa-times"></i></button>';
        container.appendChild(row);
      });
    }
  },

  getData: function() {
    var question = document.getElementById('poll-question');
    if (!question || !question.value.trim()) return null;

    var inputs = document.querySelectorAll('.poll-option-input');
    var options = [];
    for (var i = 0; i < inputs.length; i++) {
      var val = inputs[i].value.trim();
      if (val) options.push(val);
    }

    if (options.length < 2) return null;

    var votes = {};
    for (var j = 0; j < options.length; j++) {
      votes[options[j]] = [];
    }

    return {
      question: question.value.trim(),
      options: options,
      votes: votes
    };
  },

  renderPoll: function(pollData, articleId) {
    if (!pollData || !pollData.question) return '';

    var userId = App.currentUser ? App.currentUser.id : null;
    var hasVoted = false;
    var userVote = null;
    var totalVotes = 0;

    // Check if user voted and count totals
    for (var opt in pollData.votes) {
      var voters = pollData.votes[opt] || [];
      totalVotes += voters.length;
      if (userId && voters.indexOf(userId) !== -1) {
        hasVoted = true;
        userVote = opt;
      }
    }

    var html = '<div class="poll-box">' +
      '<div class="poll-box__title"><i class="fas fa-poll"></i> ' + App.esc(pollData.question) + '</div>';

    for (var opt in pollData.votes) {
      var voters = pollData.votes[opt] || [];
      var count = voters.length;
      var pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      var isSelected = userVote === opt;

      if (hasVoted || !userId) {
        // Result mode
        html += '<div class="poll-option poll-option--result' + (isSelected ? ' poll-option--selected' : '') + '">' +
          '<div class="poll-option__bar" style="width:' + pct + '%"></div>' +
          '<span class="poll-option__text">' + App.esc(opt) + '</span>' +
          '<span class="poll-option__pct">' + pct + '% (' + count + ')</span></div>';
      } else {
        // Vote mode
        html += '<button class="poll-option poll-option--vote" onclick="Polls.vote(\'' + articleId + '\',\'' + opt.replace(/'/g, "\\'") + '\')">' +
          '<span class="poll-option__text">' + App.esc(opt) + '</span></button>';
      }
    }

    html += '<div class="poll-box__total">' + totalVotes + ' vote' + (totalVotes !== 1 ? 's' : '') + '</div></div>';
    return html;
  },

  vote: async function(articleId, option) {
    if (!App.currentUser) { UI.toast('Connectez-vous pour voter', 'warning'); return; }

    try {
      // Fetch current poll data
      var result = await App.supabase.from('wiki_articles').select('poll_data').eq('id', articleId).single();
      if (!result.data || !result.data.poll_data) return;

      var pollData = result.data.poll_data;

      // Check if already voted
      for (var opt in pollData.votes) {
        if (pollData.votes[opt] && pollData.votes[opt].indexOf(App.currentUser.id) !== -1) {
          UI.toast('Vous avez déjà voté', 'info');
          return;
        }
      }

      // Add vote
      if (!pollData.votes[option]) pollData.votes[option] = [];
      pollData.votes[option].push(App.currentUser.id);

      // Save
      var updateResult = await App.supabase.from('wiki_articles').update({ poll_data: pollData }).eq('id', articleId);
      if (updateResult.error) throw updateResult.error;

      UI.toast('Vote enregistré !', 'success');

      // Refresh article
      if (typeof UI !== 'undefined' && UI.openArticle) UI.openArticle(articleId);
    } catch(e) {
      console.error('Poll vote error:', e);
      UI.toast('Erreur', 'error');
    }
  }
};
