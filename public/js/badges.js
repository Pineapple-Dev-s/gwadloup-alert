var Badges = {
  // 50 badges organized by category
  list: [
    // === SIGNALEMENTS (15) ===
    { id: 'first_report', name: 'Premier pas', icon: 'fa-flag', desc: 'Créer son premier signalement', condition: function(p) { return p.reports_count >= 1; }, color: '#3fb950' },
    { id: 'reporter_5', name: 'Citoyen actif', icon: 'fa-flag-checkered', desc: '5 signalements créés', condition: function(p) { return p.reports_count >= 5; }, color: '#3fb950' },
    { id: 'reporter_10', name: 'Sentinelle', icon: 'fa-binoculars', desc: '10 signalements', condition: function(p) { return p.reports_count >= 10; }, color: '#58a6ff' },
    { id: 'reporter_25', name: 'Vigile', icon: 'fa-eye', desc: '25 signalements', condition: function(p) { return p.reports_count >= 25; }, color: '#58a6ff' },
    { id: 'reporter_50', name: 'Gardien', icon: 'fa-shield-alt', desc: '50 signalements', condition: function(p) { return p.reports_count >= 50; }, color: '#bc8cff' },
    { id: 'reporter_100', name: 'Légende', icon: 'fa-crown', desc: '100 signalements', condition: function(p) { return p.reports_count >= 100; }, color: '#e3b341' },
    { id: 'reporter_250', name: 'Titan', icon: 'fa-gem', desc: '250 signalements', condition: function(p) { return p.reports_count >= 250; }, color: '#f85149' },
    { id: 'pothole_hunter', name: 'Chasseur de nids', icon: 'fa-road', desc: '10 nids de poule signalés', condition: function(p, s) { return (s.cats.pothole || 0) >= 10; }, color: '#d29922' },
    { id: 'eco_warrior', name: 'Éco-guerrier', icon: 'fa-leaf', desc: '10 signalements nature', condition: function(p, s) { return ((s.cats.vegetation || 0) + (s.cats.fallen_tree || 0) + (s.cats.invasive_species || 0)) >= 10; }, color: '#3fb950' },
    { id: 'beach_guardian', name: 'Gardien des plages', icon: 'fa-umbrella-beach', desc: '5 pollutions plage', condition: function(p, s) { return (s.cats.beach_pollution || 0) >= 5; }, color: '#58a6ff' },
    { id: 'night_watcher', name: 'Veilleur de nuit', icon: 'fa-lightbulb', desc: '5 éclairages signalés', condition: function(p, s) { return (s.cats.broken_light || 0) >= 5; }, color: '#e3b341' },
    { id: 'water_detective', name: 'Détective des eaux', icon: 'fa-tint', desc: '5 problèmes d\'eau', condition: function(p, s) { return ((s.cats.water_leak || 0) + (s.cats.flooding || 0) + (s.cats.stagnant_water || 0)) >= 5; }, color: '#58a6ff' },
    { id: 'safety_first', name: 'Sécurité d\'abord', icon: 'fa-hard-hat', desc: '5 zones dangereuses', condition: function(p, s) { return ((s.cats.dangerous_area || 0) + (s.cats.dangerous_road || 0)) >= 5; }, color: '#f85149' },
    { id: 'clean_streets', name: 'Rues propres', icon: 'fa-broom', desc: '10 dépôts sauvages', condition: function(p, s) { return (s.cats.illegal_dump || 0) >= 10; }, color: '#bc8cff' },
    { id: 'multi_cat', name: 'Polyvalent', icon: 'fa-th', desc: 'Signaler dans 10 catégories différentes', condition: function(p, s) { return Object.keys(s.cats).length >= 10; }, color: '#d29922' },

    // === REPUTATION (10) ===
    { id: 'rep_10', name: 'Débutant', icon: 'fa-seedling', desc: '10 points de réputation', condition: function(p) { return p.reputation >= 10; }, color: '#3fb950' },
    { id: 'rep_50', name: 'Reconnu', icon: 'fa-star', desc: '50 points', condition: function(p) { return p.reputation >= 50; }, color: '#3fb950' },
    { id: 'rep_100', name: 'Respecté', icon: 'fa-medal', desc: '100 points', condition: function(p) { return p.reputation >= 100; }, color: '#58a6ff' },
    { id: 'rep_250', name: 'Influent', icon: 'fa-fire', desc: '250 points', condition: function(p) { return p.reputation >= 250; }, color: '#d29922' },
    { id: 'rep_500', name: 'Pilier', icon: 'fa-monument', desc: '500 points', condition: function(p) { return p.reputation >= 500; }, color: '#bc8cff' },
    { id: 'rep_1000', name: 'Légende vivante', icon: 'fa-trophy', desc: '1000 points', condition: function(p) { return p.reputation >= 1000; }, color: '#e3b341' },
    { id: 'rep_2500', name: 'Mythe', icon: 'fa-dragon', desc: '2500 points', condition: function(p) { return p.reputation >= 2500; }, color: '#f85149' },
    { id: 'rep_5000', name: 'Divinité', icon: 'fa-sun', desc: '5000 points', condition: function(p) { return p.reputation >= 5000; }, color: '#f85149' },
    { id: 'top_3', name: 'Podium', icon: 'fa-award', desc: 'Top 3 du classement', condition: function(p, s) { return s.rank <= 3; }, color: '#e3b341' },
    { id: 'top_1', name: 'Champion', icon: 'fa-chess-king', desc: 'N°1 du classement', condition: function(p, s) { return s.rank === 1; }, color: '#e3b341' },

    // === VOTES (8) ===
    { id: 'first_vote', name: 'Supporteur', icon: 'fa-thumbs-up', desc: 'Premier vote', condition: function(p, s) { return s.votes_given >= 1; }, color: '#d29922' },
    { id: 'voter_10', name: 'Encourageant', icon: 'fa-hands-clapping', desc: '10 votes donnés', condition: function(p, s) { return s.votes_given >= 10; }, color: '#d29922' },
    { id: 'voter_50', name: 'Motivateur', icon: 'fa-hand-holding-heart', desc: '50 votes', condition: function(p, s) { return s.votes_given >= 50; }, color: '#bc8cff' },
    { id: 'popular_5', name: 'Populaire', icon: 'fa-heart', desc: '5 votes reçus sur un signalement', condition: function(p, s) { return s.max_votes_received >= 5; }, color: '#f85149' },
    { id: 'popular_10', name: 'Star locale', icon: 'fa-star-half-alt', desc: '10 votes sur un signalement', condition: function(p, s) { return s.max_votes_received >= 10; }, color: '#e3b341' },
    { id: 'popular_25', name: 'Viral', icon: 'fa-bolt', desc: '25 votes sur un signalement', condition: function(p, s) { return s.max_votes_received >= 25; }, color: '#f85149' },
    { id: 'total_votes_50', name: 'Apprécié', icon: 'fa-gift', desc: '50 votes reçus au total', condition: function(p, s) { return s.total_votes_received >= 50; }, color: '#bc8cff' },
    { id: 'total_votes_100', name: 'Icône', icon: 'fa-gem', desc: '100 votes reçus', condition: function(p, s) { return s.total_votes_received >= 100; }, color: '#e3b341' },

    // === WIKI / FORUM (7) ===
    { id: 'first_article', name: 'Rédacteur', icon: 'fa-pen-fancy', desc: 'Premier article wiki', condition: function(p, s) { return s.articles_count >= 1; }, color: '#58a6ff' },
    { id: 'writer_5', name: 'Auteur', icon: 'fa-book', desc: '5 articles', condition: function(p, s) { return s.articles_count >= 5; }, color: '#58a6ff' },
    { id: 'writer_20', name: 'Encyclopédiste', icon: 'fa-atlas', desc: '20 articles', condition: function(p, s) { return s.articles_count >= 20; }, color: '#bc8cff' },
    { id: 'first_comment', name: 'Bavard', icon: 'fa-comment', desc: 'Premier commentaire', condition: function(p, s) { return s.comments_count >= 1; }, color: '#3fb950' },
    { id: 'commenter_25', name: 'Débatteur', icon: 'fa-comments', desc: '25 commentaires', condition: function(p, s) { return s.comments_count >= 25; }, color: '#58a6ff' },
    { id: 'commenter_100', name: 'Orateur', icon: 'fa-bullhorn', desc: '100 commentaires', condition: function(p, s) { return s.comments_count >= 100; }, color: '#bc8cff' },
    { id: 'helpful_article', name: 'Utile', icon: 'fa-hands-helping', desc: 'Article avec 10+ votes', condition: function(p, s) { return s.max_article_votes >= 10; }, color: '#e3b341' },

    // === COMMUNES (5) ===
    { id: 'local_hero', name: 'Héros local', icon: 'fa-home', desc: '10 signalements dans sa commune', condition: function(p, s) { return s.home_commune_reports >= 10; }, color: '#3fb950' },
    { id: 'explorer_3', name: 'Explorateur', icon: 'fa-compass', desc: 'Signaler dans 3 communes', condition: function(p, s) { return s.communes_count >= 3; }, color: '#58a6ff' },
    { id: 'explorer_10', name: 'Globe-trotter', icon: 'fa-globe-americas', desc: '10 communes différentes', condition: function(p, s) { return s.communes_count >= 10; }, color: '#bc8cff' },
    { id: 'island_master', name: 'Maître de l\'île', icon: 'fa-island-tropical', desc: '20 communes couvertes', condition: function(p, s) { return s.communes_count >= 20; }, color: '#e3b341' },
    { id: 'marie_galante', name: 'Aventurier', icon: 'fa-ship', desc: 'Signalement à Marie-Galante', condition: function(p, s) { return s.has_marie_galante; }, color: '#d29922' },

    // === SPECIAL (5) ===
    { id: 'early_adopter', name: 'Pionnier', icon: 'fa-rocket', desc: 'Parmi les 50 premiers inscrits', condition: function(p, s) { return s.user_number <= 50; }, color: '#f85149' },
    { id: 'night_owl', name: 'Oiseau de nuit', icon: 'fa-moon', desc: 'Signalement entre 00h et 5h', condition: function(p, s) { return s.has_night_report; }, color: '#bc8cff' },
    { id: 'streak_7', name: 'Assidu', icon: 'fa-calendar-check', desc: 'Signaler 7 jours de suite', condition: function(p, s) { return s.max_streak >= 7; }, color: '#d29922' },
    { id: 'resolver', name: 'Résolveur', icon: 'fa-check-double', desc: '5 signalements résolus', condition: function(p, s) { return s.resolved_count >= 5; }, color: '#3fb950' },
    { id: 'photographer', name: 'Photographe', icon: 'fa-camera', desc: '20 signalements avec photo', condition: function(p, s) { return s.reports_with_photos >= 20; }, color: '#58a6ff' }
  ],

  // Compute stats for a user
  computeStats: async function(userId) {
    var stats = {
      cats: {}, votes_given: 0, max_votes_received: 0, total_votes_received: 0,
      articles_count: 0, comments_count: 0, max_article_votes: 0,
      home_commune_reports: 0, communes_count: 0, has_marie_galante: false,
      user_number: 999, has_night_report: false, max_streak: 0,
      resolved_count: 0, reports_with_photos: 0, rank: 999
    };

    try {
      // User reports with categories
      var rr = await App.supabase.from('reports').select('category, commune, images, status, created_at').eq('user_id', userId);
      if (rr.data) {
        var communes = {};
        var dates = [];
        var mgCommunes = ['Capesterre-de-Marie-Galante', 'Grand-Bourg', 'Saint-Louis'];
        for (var i = 0; i < rr.data.length; i++) {
          var r = rr.data[i];
          stats.cats[r.category] = (stats.cats[r.category] || 0) + 1;
          if (r.commune) {
            communes[r.commune] = (communes[r.commune] || 0) + 1;
            if (mgCommunes.indexOf(r.commune) >= 0) stats.has_marie_galante = true;
          }
          if (r.images && r.images.length > 0) stats.reports_with_photos++;
          if (r.status === 'resolved') stats.resolved_count++;
          var h = new Date(r.created_at).getHours();
          if (h >= 0 && h < 5) stats.has_night_report = true;
          dates.push(new Date(r.created_at).toISOString().split('T')[0]);
        }
        stats.communes_count = Object.keys(communes).length;
        // Home commune
        var profile = App.currentProfile;
        if (profile && profile.commune && communes[profile.commune]) {
          stats.home_commune_reports = communes[profile.commune];
        }
        // Streak
        if (dates.length > 0) {
          dates.sort();
          var unique = dates.filter(function(d, i, a) { return a.indexOf(d) === i; });
          var streak = 1, maxStreak = 1;
          for (var j = 1; j < unique.length; j++) {
            var diff = (new Date(unique[j]) - new Date(unique[j-1])) / 86400000;
            if (diff === 1) { streak++; if (streak > maxStreak) maxStreak = streak; }
            else streak = 1;
          }
          stats.max_streak = maxStreak;
        }
      }

      // Votes given
      var vg = await App.supabase.from('votes').select('id', { count: 'exact', head: true }).eq('user_id', userId);
      stats.votes_given = vg.count || 0;

      // Votes received on reports
      var ur = await App.supabase.from('reports').select('upvotes').eq('user_id', userId);
      if (ur.data) {
        for (var k = 0; k < ur.data.length; k++) {
          var uv = ur.data[k].upvotes || 0;
          stats.total_votes_received += uv;
          if (uv > stats.max_votes_received) stats.max_votes_received = uv;
        }
      }

      // Wiki articles
      var wa = await App.supabase.from('wiki_articles').select('upvotes', { count: 'exact' }).eq('author_id', userId);
      stats.articles_count = wa.count || 0;
      if (wa.data) {
        for (var m = 0; m < wa.data.length; m++) {
          if ((wa.data[m].upvotes || 0) > stats.max_article_votes) stats.max_article_votes = wa.data[m].upvotes;
        }
      }

      // Comments
      var cc = await App.supabase.from('comments').select('id', { count: 'exact', head: true }).eq('user_id', userId);
      var wc = await App.supabase.from('wiki_comments').select('id', { count: 'exact', head: true }).eq('user_id', userId);
      stats.comments_count = (cc.count || 0) + (wc.count || 0);

      // Rank
      var profiles = await App.supabase.from('profiles').select('id, reputation').order('reputation', { ascending: false });
      if (profiles.data) {
        for (var n = 0; n < profiles.data.length; n++) {
          if (profiles.data[n].id === userId) { stats.rank = n + 1; break; }
        }
      }

      // User number (order of creation)
      var allProfiles = await App.supabase.from('profiles').select('id').order('created_at', { ascending: true });
      if (allProfiles.data) {
        for (var o = 0; o < allProfiles.data.length; o++) {
          if (allProfiles.data[o].id === userId) { stats.user_number = o + 1; break; }
        }
      }
    } catch (e) { console.error('Badge stats error:', e); }

    return stats;
  },

  // Get unlocked badges
  getUnlocked: async function(profile, userId) {
    var stats = await this.computeStats(userId);
    var unlocked = [];
    for (var i = 0; i < this.list.length; i++) {
      try {
        if (this.list[i].condition(profile, stats)) unlocked.push(this.list[i]);
      } catch (e) {}
    }
    return { unlocked: unlocked, total: this.list.length, stats: stats };
  },

  // Render badges grid
  renderBadges: function(unlocked, total, compact) {
    var html = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
      '<span style="font-size:.85rem;font-weight:700"><i class="fas fa-medal" style="color:var(--yellow)"></i> Badges</span>' +
      '<span style="font-size:.72rem;color:var(--text2)">' + unlocked.length + '/' + total + '</span>' +
      '<div style="flex:1;height:4px;background:var(--bg3);border-radius:2px;overflow:hidden">' +
      '<div style="width:' + Math.round(unlocked.length / total * 100) + '%;height:100%;background:var(--green);border-radius:2px"></div></div></div>';

    html += '<div class="badges-grid">';
    var all = this.list;
    for (var i = 0; i < all.length; i++) {
      var b = all[i];
      var isUnlocked = unlocked.some(function(u) { return u.id === b.id; });
      if (compact && !isUnlocked) continue;
      html += '<div class="badge-item' + (isUnlocked ? ' badge-item--unlocked' : '') + '" title="' + App.esc(b.desc) + '">' +
        '<div class="badge-item__icon" style="' + (isUnlocked ? 'color:' + b.color + ';border-color:' + b.color : '') + '">' +
        '<i class="fas ' + b.icon + '"></i></div>' +
        '<div class="badge-item__name">' + App.esc(b.name) + '</div></div>';
    }
    html += '</div>';
    return html;
  }
};
