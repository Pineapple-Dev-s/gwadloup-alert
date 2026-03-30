var Polls = {
  // Create poll form HTML
  getFormHtml: function() {
    return '<div id="poll-section" style="display:none;margin-top:12px">' +
      '<div style="background:var(--bg3);padding:12px;border-radius:var(--r);border:1px solid var(--border)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<label style="font-size:.78rem;font-weight:600;color:var(--text2)"><i class="fas fa-poll"></i> Sondage</label>' +
      '<button type="button" class="btn btn--ghost" style="font-size:.65rem" onclick="Polls.toggleForm()"><i class="fas fa-times"></i></button></div>' +
      '<input type="text" class="inp" id="poll-question" placeholder="Question du sondage" style="margin-bottom:8px;font-size:.8rem">' +
      '<div id="poll-options">' +
      '<div class="poll-opt-row"><input type="text" class="inp" placeholder="Option 1" style="font-size:.78rem"><button type="button" class="btn btn--ghost" style="font-size:.6rem" onclick="this.parentNode.remove()"><i class="fas fa-times"></i></button></div>' +
      '<div class="poll-opt-row"><input type="text" class="inp" placeholder="Option 2" style="font-size:.78rem"><button type="button" class="btn btn--ghost" style="font-size:.6rem" onclick="this.parentNode.remove()"><i class="fas fa-times"></i></button></div>' +
      '</div>' +
      '<button type="button" class="btn btn--ghost" style="font-size:.7rem;margin-top:6px" onclick="Polls.addOption()"><i class="fas fa-plus"></i> Ajouter une option</button>' +
      '</div></div>';
  },

  toggleForm: function() {
    var section = document.getElementById('poll-section');
    if (section) section.style.display = section.style.display === 'none' ? 'block' : 'none';
  },

  addOption: function() {
    var container = document.getElementById('poll-options');
    if (!container) return;
    var count = container.children.length;
    if (count >= 6) { UI.toast('Max 6 options', 'warning'); return; }
    var div = document.createElement('div');
    div.className = 'poll-opt-row';
    div.innerHTML = '<input type="text" class="inp" placeholder="Option ' + (count + 1) + '" style="font-size:.78rem"><button type="button" class="btn btn--ghost" style="font-size:.6rem" onclick="this.parentNode.remove()"><i class="fas fa-times"></i></button>';
    container.appendChild(div);
  },

  // Extract poll data from form
  getData: function() {
    var section = document.getElementById('poll-section');
    if (!section || section.style.display === 'none') return null;
    var question = document.getElementById('poll-question').value.trim();
    if (!question) return null;
    var options = [];
    var inputs = document.querySelectorAll('#poll-options .poll-opt-row input');
    for (var i = 0; i < inputs.length; i++) {
      var v = inputs[i].value.trim();
      if (v) options.push(v);
    }
    if (options.length < 2) return null;
    return { question: question, options: options, votes: {} };
  },

  // Render poll in article detail
  renderPoll: function(pollData, articleId) {
    if (!pollData || !pollData.question) return '';
    var html = '<div class="poll-box">' +
      '<div class="poll-box__title"><i class="fas fa-poll"></i> ' + App.esc(pollData.question) + '</div>';

    var totalVotes = 0;
    var votes = pollData.votes || {};
    for (var k in votes) totalVotes += (votes[k] || []).length;

    // Check if user already voted
    var userVoted = null;
    if (App.currentUser) {
      for (var opt in votes) {
        if (votes[opt] && votes[opt].indexOf(App.currentUser.id) >= 0) { userVoted = opt; break; }
      }
    }

    for (var i = 0; i < pollData.options.length; i++) {
      var option = pollData.options[i];
      var optVotes = (votes[option] || []).length;
      var pct = totalVotes > 0 ? Math.round(optVotes / totalVotes * 100) : 0;
      var isSelected = userVoted === option;

      if (userVoted !== null || !App.currentUser) {
        // Show results
        html += '<div class="poll-option poll-option--result' + (isSelected ? ' poll-option--selected' : '') + '">' +
          '<div class="poll-option__bar" style="width:' + pct + '%"></div>' +
          '<span class="poll-option__text">' + App.esc(option) + '</span>' +
          '<span class="poll-option__pct">' + pct + '% (' + optVotes + ')</span></div>';
      } else {
        // Show vote buttons
        html += '<button class="poll-option poll-option--vote" onclick="Polls.vote(\'' + articleId + '\',\'' + App.esc(option).replace(/'/g, "\\'") + '\')">' +
          '<span class="poll-option__text">' + App.esc(option) + '</span></button>';
      }
    }

    html += '<div class="poll-box__total">' + totalVotes + ' vote' + (totalVotes > 1 ? 's' : '') + '</div></div>';
    return html;
  },

  // Vote on a poll
  vote: async function(articleId, option) {
    if (!App.currentUser) { UI.toast('Connectez-vous', 'warning'); return; }
    try {
      var result = await App.supabase.from('wiki_articles').select('poll_data').eq('id', articleId).single();
      if (result.error) throw result.error;
      var pollData = result.data.poll_data;
      if (!pollData) return;

      // Check already voted
      for (var k in pollData.votes) {
        if (pollData.votes[k] && pollData.votes[k].indexOf(App.currentUser.id) >= 0) {
          UI.toast('Vous avez déjà voté', 'info');
          return;
        }
      }

      if (!pollData.votes[option]) pollData.votes[option] = [];
      pollData.votes[option].push(App.currentUser.id);

      var upd = await App.supabase.from('wiki_articles').update({ poll_data: pollData }).eq('id', articleId);
      if (upd.error) throw upd.error;
      UI.toast('Vote enregistré !', 'success');
      UI.openArticle(articleId);
    } catch (e) {
      console.error('Poll vote error:', e);
      UI.toast('Erreur', 'error');
    }
  }
};
