var Badges = {
  list: [
    // Signalements
    { id: 'first_report', name: 'Premier pas', icon: 'fa-flag', color: '#3fb950', desc: '1er signalement', check: function(p) { return (p.reports_count || 0) >= 1; } },
    { id: 'reporter_5', name: 'Observateur', icon: 'fa-binoculars', color: '#58a6ff', desc: '5 signalements', check: function(p) { return (p.reports_count || 0) >= 5; } },
    { id: 'reporter_10', name: 'Vigilant', icon: 'fa-eye', color: '#bc8cff', desc: '10 signalements', check: function(p) { return (p.reports_count || 0) >= 10; } },
    { id: 'reporter_25', name: 'Sentinelle', icon: 'fa-shield-alt', color: '#f85149', desc: '25 signalements', check: function(p) { return (p.reports_count || 0) >= 25; } },
    { id: 'reporter_50', name: 'Gardien', icon: 'fa-crown', color: '#d29922', desc: '50 signalements', check: function(p) { return (p.reports_count || 0) >= 50; } },
    { id: 'reporter_100', name: 'Héros citoyen', icon: 'fa-gem', color: '#e3b341', desc: '100 signalements', check: function(p) { return (p.reports_count || 0) >= 100; } },

    // Catégories
    { id: 'road_expert', name: 'Expert routes', icon: 'fa-road', color: '#f85149', desc: '5 signalements routes', check: function(p, s) { return (s.catCounts.pothole || 0) + (s.catCounts.dangerous_road || 0) >= 5; } },
    { id: 'eco_warrior', name: 'Éco-guerrier', icon: 'fa-leaf', color: '#3fb950', desc: '5 signalements nature', check: function(p, s) { return (s.catCounts.illegal_dump || 0) + (s.catCounts.beach_pollution || 0) + (s.catCounts.river_pollution || 0) >= 5; } },
    { id: 'beach_guardian', name: 'Gardien plages', icon: 'fa-umbrella-beach', color: '#58a6ff', desc: '3 pollutions plage', check: function(p, s) { return (s.catCounts.beach_pollution || 0) >= 3; } },
    { id: 'light_hunter', name: 'Chasseur ombre', icon: 'fa-lightbulb', color: '#e3b341', desc: '3 éclairages', check: function(p, s) { return (s.catCounts.broken_light || 0) >= 3; } },
    { id: 'water_guardian', name: 'Gardien eau', icon: 'fa-tint', color: '#58a6ff', desc: '3 problèmes eau', check: function(p, s) { return (s.catCounts.water_leak || 0) + (s.catCounts.flooding || 0) >= 3; } },
    { id: 'safety_first', name: 'Sécurité', icon: 'fa-hard-hat', color: '#d29922', desc: '3 signalements sécurité', check: function(p, s) { return (s.catCounts.dangerous_area || 0) + (s.catCounts.missing_crosswalk || 0) + (s.catCounts.school_zone_issue || 0) >= 3; } },
    { id: 'clean_streets', name: 'Rues propres', icon: 'fa-broom', color: '#bc8cff', desc: '5 dépôts sauvages', check: function(p, s) { return (s.catCounts.illegal_dump || 0) >= 5; } },

    // Réputation
    { id: 'rep_50', name: 'Étoile montante', icon: 'fa-star', color: '#e3b341', desc: '50 pts réputation', check: function(p) { return (p.reputation || 0) >= 50; } },
    { id: 'rep_200', name: 'Médaillé', icon: 'fa-medal', color: '#d29922', desc: '200 pts', check: function(p) { return (p.reputation || 0) >= 200; } },
    { id: 'rep_500', name: 'Flamme', icon: 'fa-fire', color: '#f85149', desc: '500 pts', check: function(p) { return (p.reputation || 0) >= 500; } },
    { id: 'rep_1000', name: 'Monument', icon: 'fa-monument', color: '#bc8cff', desc: '1000 pts', check: function(p) { return (p.reputation || 0) >= 1000; } },
    { id: 'rep_2000', name: 'Trophée', icon: 'fa-trophy', color: '#e3b341', desc: '2000 pts', check: function(p) { return (p.reputation || 0) >= 2000; } },
    { id: 'rep_3000', name: 'Dragon', icon: 'fa-dragon', color: '#f85149', desc: '3000 pts', check: function(p) { return (p.reputation || 0) >= 3000; } },
    { id: 'rep_5000', name: 'Soleil', icon: 'fa-sun', color: '#e3b341', desc: '5000 pts', check: function(p) { return (p.reputation || 0) >= 5000; } },

    // Votes
    { id: 'first_vote', name: 'Supporter', icon: 'fa-thumbs-up', color: '#d29922', desc: '1er vote', check: function(p, s) { return s.votesGiven >= 1; } },
    { id: 'voter_10', name: 'Encourageur', icon: 'fa-hands-clapping', color: '#58a6ff', desc: '10 votes', check: function(p, s) { return s.votesGiven >= 10; } },
    { id: 'voter_50', name: 'Mécène', icon: 'fa-hand-holding-heart', color: '#bc8cff', desc: '50 votes', check: function(p, s) { return s.votesGiven >= 50; } },
    { id: 'popular_5', name: 'Populaire', icon: 'fa-heart', color: '#f85149', desc: '5 votes reçus', check: function(p, s) { return s.votesReceived >= 5; } },
    { id: 'popular_25', name: 'Star', icon: 'fa-star-half-alt', color: '#e3b341', desc: '25 votes reçus', check: function(p, s) { return s.votesReceived >= 25; } },
    { id: 'viral', name: 'Viral', icon: 'fa-bolt', color: '#d29922', desc: '50 votes reçus', check: function(p, s) { return s.votesReceived >= 50; } },

    // Wiki
    { id: 'first_article', name: 'Auteur', icon: 'fa-pen-fancy', color: '#58a6ff', desc: '1er article wiki', check: function(p, s) { return s.wikiArticles >= 1; } },
    { id: 'writer_5', name: 'Écrivain', icon: 'fa-book', color: '#bc8cff', desc: '5 articles', check: function(p, s) { return s.wikiArticles >= 5; } },
    { id: 'writer_10', name: 'Encyclopédiste', icon: 'fa-atlas', color: '#e3b341', desc: '10 articles', check: function(p, s) { return s.wikiArticles >= 10; } },
    { id: 'first_comment', name: 'Commentateur', icon: 'fa-comment', color: '#3fb950', desc: '1er commentaire', check: function(p, s) { return s.commentsCount >= 1; } },
    { id: 'commenter_10', name: 'Bavard', icon: 'fa-comments', color: '#58a6ff', desc: '10 commentaires', check: function(p, s) { return s.commentsCount >= 10; } },
    { id: 'community_voice', name: 'Porte-voix', icon: 'fa-bullhorn', color: '#d29922', desc: '25 commentaires', check: function(p, s) { return s.commentsCount >= 25; } },
    { id: 'helper', name: 'Entraideur', icon: 'fa-hands-helping', color: '#3fb950', desc: '3 articles + 10 commentaires', check: function(p, s) { return s.wikiArticles >= 3 && s.commentsCount >= 10; } },

    // Localisation
    { id: 'local_hero', name: 'Héros local', icon: 'fa-home', color: '#3fb950', desc: '10 signalements même commune', check: function(p, s) { return s.maxCommuneCount >= 10; } },
    { id: 'explorer_3', name: 'Explorateur', icon: 'fa-compass', color: '#58a6ff', desc: '3 communes', check: function(p, s) { return s.uniqueCommunes >= 3; } },
    { id: 'explorer_10', name: 'Globe-trotteur', icon: 'fa-globe-americas', color: '#bc8cff', desc: '10 communes', check: function(p, s) { return s.uniqueCommunes >= 10; } },
    { id: 'cartographer', name: 'Cartographe', icon: 'fa-map-marked-alt', color: '#d29922', desc: '20 communes', check: function(p, s) { return s.uniqueCommunes >= 20; } },
    { id: 'island_hopper', name: 'Navigateur', icon: 'fa-ship', color: '#58a6ff', desc: 'Marie-Galante ou Saintes', check: function(p, s) { return s.hasIslands; } },

    // Spéciaux
    { id: 'fast_reporter', name: 'Rapide', icon: 'fa-rocket', color: '#f85149', desc: '3 signalements en 1 jour', check: function(p, s) { return s.maxDailyReports >= 3; } },
    { id: 'night_owl', name: 'Oiseau de nuit', icon: 'fa-moon', color: '#bc8cff', desc: 'Signalement nocturne', check: function(p, s) { return s.nightReport; } },
    { id: 'streak_7', name: 'Régulier', icon: 'fa-calendar-check', color: '#3fb950', desc: '7 jours consécutifs', check: function(p, s) { return s.maxStreak >= 7; } },
    { id: 'resolver', name: 'Résolveur', icon: 'fa-check-double', color: '#3fb950', desc: '5 signalements résolus', check: function(p, s) { return s.resolvedCount >= 5; } },
    { id: 'photographer', name: 'Photographe', icon: 'fa-camera', color: '#d29922', desc: '10 photos uploadées', check: function(p, s) { return s.photosCount >= 10; } },
    { id: 'generous', name: 'Généreux', icon: 'fa-gift', color: '#bc8cff', desc: 'Vote + commentaire + article', check: function(p, s) { return s.votesGiven >= 1 && s.commentsCount >= 1 && s.wikiArticles >= 1; } }
  ],

  computeStats: async function() {
    var userId = App.currentUser ? App.currentUser.id : null;
    var stats = {
      catCounts: {},
      votesGiven: 0,
      votesReceived: 0,
      wikiArticles: 0,
      commentsCount: 0,
      uniqueCommunes: 0,
      maxCommuneCount: 0,
      hasIslands: false,
      maxDailyReports: 0,
      nightReport: false,
      maxStreak: 0,
      resolvedCount: 0,
      photosCount: 0
    };

    if (!userId) return stats;

    try {
      // User reports analysis
      var myReports = App.reports.filter(function(r) { return r.user_id === userId; });
      var communeCounts = {};
      var dailyCounts = {};
      var dates = [];
      var islandCommunes = ['Capesterre-de-Marie-Galante','Grand-Bourg','Saint-Louis','Terre-de-Haut','Terre-de-Bas','La Desirade'];

      for (var i = 0; i < myReports.length; i++) {
        var r = myReports[i];
        // Category counts
        stats.catCounts[r.category] = (stats.catCounts[r.category] || 0) + 1;

        // Commune
        if (r.commune) {
          communeCounts[r.commune] = (communeCounts[r.commune] || 0) + 1;
          if (islandCommunes.indexOf(r.commune) !== -1) stats.hasIslands = true;
        }

        // Resolved
        if (r.status === 'resolved') stats.resolvedCount++;

        // Photos
        if (r.images && r.images.length) stats.photosCount += r.images.length;

        // Date analysis
        var d = new Date(r.created_at);
        var dayKey = d.toISOString().split('T')[0];
        dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
        dates.push(dayKey);

        // Night report (0h-5h)
        var h = d.getHours();
        if (h >= 0 && h < 5) stats.nightReport = true;
      }

      // Unique communes
      var communeKeys = Object.keys(communeCounts);
      stats.uniqueCommunes = communeKeys.length;
      for (var c = 0; c < communeKeys.length; c++) {
        if (communeCounts[communeKeys[c]] > stats.maxCommuneCount) {
          stats.maxCommuneCount = communeCounts[communeKeys[c]];
        }
      }

      // Max daily
      var dailyKeys = Object.keys(dailyCounts);
      for (var d = 0; d < dailyKeys.length; d++) {
        if (dailyCounts[dailyKeys[d]] > stats.maxDailyReports) {
          stats.maxDailyReports = dailyCounts[dailyKeys[d]];
        }
      }

      // Streak
      if (dates.length > 0) {
        var uniqueDates = [];
        for (var u = 0; u < dates.length; u++) { if (uniqueDates.indexOf(dates[u]) === -1) uniqueDates.push(dates[u]); }
        uniqueDates.sort();
        var streak = 1, maxStreak = 1;
        for (var s = 1; s < uniqueDates.length; s++) {
          var prev = new Date(uniqueDates[s - 1]);
          var curr = new Date(uniqueDates[s]);
          var diff = Math.round((curr - prev) / 86400000);
          if (diff === 1) { streak++; if (streak > maxStreak) maxStreak = streak; }
          else { streak = 1; }
        }
        stats.maxStreak = maxStreak;
      }

      // Votes given
      var votesResult = await App.supabase.from('votes').select('id').eq('user_id', userId);
      stats.votesGiven = (votesResult.data && votesResult.data.length) || 0;

      // Votes received
      var totalVotesReceived = 0;
      for (var v = 0; v < myReports.length; v++) {
        totalVotesReceived += (myReports[v].upvotes || 0);
      }
      stats.votesReceived = totalVotesReceived;

      // Wiki articles
      var wikiResult = await App.supabase.from('wiki_articles').select('id').eq('author_id', userId);
      stats.wikiArticles = (wikiResult.data && wikiResult.data.length) || 0;

      // Comments (reports + wiki)
      var cmtResult = await App.supabase.from('comments').select('id').eq('user_id', userId);
      var wikiCmtResult = await App.supabase.from('wiki_comments').select('id').eq('user_id', userId);
      stats.commentsCount = ((cmtResult.data && cmtResult.data.length) || 0) + ((wikiCmtResult.data && wikiCmtResult.data.length) || 0);

    } catch(e) {
      console.error('Badge stats error:', e);
    }

    return stats;
  },

  getUnlocked: function(profile, stats) {
    var unlocked = [];
    for (var i = 0; i < this.list.length; i++) {
      try {
        if (this.list[i].check(profile, stats)) unlocked.push(this.list[i]);
      } catch(e) {}
    }
    return unlocked;
  },

  renderGrid: function(profile, stats) {
    var unlocked = this.getUnlocked(profile, stats);
    var unlockedIds = unlocked.map(function(b) { return b.id; });
    var pct = Math.round((unlocked.length / this.list.length) * 100);

    var html = '<div class="badges-header">' +
      '<div class="badges-header__left"><span class="badges-header__title"><i class="fas fa-award" style="color:var(--yellow)"></i> ' + unlocked.length + '/' + this.list.length + '</span>' +
      '<span class="badges-header__sub">badges débloqués</span></div>' +
      '<div class="badges-progress"><div class="badges-progress__bar" style="width:' + pct + '%"></div></div>' +
      '<span class="badges-progress__pct">' + pct + '%</span></div>';

    html += '<div class="badges-grid">';
    for (var i = 0; i < this.list.length; i++) {
      var b = this.list[i];
      var isUnlocked = unlockedIds.indexOf(b.id) !== -1;
      html += '<div class="badge-card' + (isUnlocked ? ' badge-card--unlocked' : '') + '" title="' + App.esc(b.desc) + '">' +
        '<div class="badge-card__glow" style="background:' + b.color + '"></div>' +
        '<div class="badge-card__icon" style="' + (isUnlocked ? 'color:' + b.color + ';border-color:' + b.color : '') + '">' +
          '<i class="fas ' + b.icon + '"></i></div>' +
        '<div class="badge-card__name">' + App.esc(b.name) + '</div>' +
        '<div class="badge-card__desc">' + App.esc(b.desc) + '</div></div>';
    }
    html += '</div>';
    return html;
  }
};
