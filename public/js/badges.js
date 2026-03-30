var Badges = {
  list: [
    // SIGNALEMENTS (15)
    {id:'first_report',name:'Premier pas',icon:'fa-flag',desc:'Créer son premier signalement',color:'#3fb950',check:function(p,s){return p.reports_count>=1;}},
    {id:'reporter_5',name:'Citoyen actif',icon:'fa-flag-checkered',desc:'5 signalements créés',color:'#3fb950',check:function(p,s){return p.reports_count>=5;}},
    {id:'reporter_10',name:'Sentinelle',icon:'fa-binoculars',desc:'10 signalements',color:'#58a6ff',check:function(p,s){return p.reports_count>=10;}},
    {id:'reporter_25',name:'Vigile',icon:'fa-eye',desc:'25 signalements',color:'#58a6ff',check:function(p,s){return p.reports_count>=25;}},
    {id:'reporter_50',name:'Gardien',icon:'fa-shield-alt',desc:'50 signalements',color:'#bc8cff',check:function(p,s){return p.reports_count>=50;}},
    {id:'reporter_100',name:'Légende',icon:'fa-crown',desc:'100 signalements',color:'#e3b341',check:function(p,s){return p.reports_count>=100;}},
    {id:'reporter_250',name:'Titan',icon:'fa-gem',desc:'250 signalements',color:'#f85149',check:function(p,s){return p.reports_count>=250;}},
    {id:'pothole_hunter',name:'Chasseur de nids',icon:'fa-road',desc:'10 nids de poule signalés',color:'#d29922',check:function(p,s){return(s.cats.pothole||0)>=10;}},
    {id:'eco_warrior',name:'Éco-guerrier',icon:'fa-leaf',desc:'10 signalements nature',color:'#3fb950',check:function(p,s){return((s.cats.vegetation||0)+(s.cats.fallen_tree||0)+(s.cats.invasive_species||0))>=10;}},
    {id:'beach_guard',name:'Gardien des plages',icon:'fa-umbrella-beach',desc:'5 pollutions plage',color:'#58a6ff',check:function(p,s){return(s.cats.beach_pollution||0)>=5;}},
    {id:'night_watch',name:'Veilleur de nuit',icon:'fa-lightbulb',desc:'5 éclairages signalés',color:'#e3b341',check:function(p,s){return(s.cats.broken_light||0)>=5;}},
    {id:'water_det',name:'Détective des eaux',icon:'fa-tint',desc:'5 problèmes d\'eau',color:'#58a6ff',check:function(p,s){return((s.cats.water_leak||0)+(s.cats.flooding||0)+(s.cats.stagnant_water||0))>=5;}},
    {id:'safety',name:'Sécurité d\'abord',icon:'fa-hard-hat',desc:'5 zones dangereuses',color:'#f85149',check:function(p,s){return((s.cats.dangerous_area||0)+(s.cats.dangerous_road||0))>=5;}},
    {id:'clean',name:'Rues propres',icon:'fa-broom',desc:'10 dépôts sauvages',color:'#bc8cff',check:function(p,s){return(s.cats.illegal_dump||0)>=10;}},
    {id:'multi',name:'Polyvalent',icon:'fa-th',desc:'Signaler dans 10 catégories',color:'#d29922',check:function(p,s){var n=0;for(var k in s.cats)n++;return n>=10;}},

    // REPUTATION (10)
    {id:'rep_10',name:'Débutant',icon:'fa-seedling',desc:'10 points de réputation',color:'#3fb950',check:function(p){return p.reputation>=10;}},
    {id:'rep_50',name:'Reconnu',icon:'fa-star',desc:'50 points',color:'#3fb950',check:function(p){return p.reputation>=50;}},
    {id:'rep_100',name:'Respecté',icon:'fa-medal',desc:'100 points',color:'#58a6ff',check:function(p){return p.reputation>=100;}},
    {id:'rep_250',name:'Influent',icon:'fa-fire',desc:'250 points',color:'#d29922',check:function(p){return p.reputation>=250;}},
    {id:'rep_500',name:'Pilier',icon:'fa-monument',desc:'500 points',color:'#bc8cff',check:function(p){return p.reputation>=500;}},
    {id:'rep_1000',name:'Légende vivante',icon:'fa-trophy',desc:'1000 points',color:'#e3b341',check:function(p){return p.reputation>=1000;}},
    {id:'rep_2500',name:'Mythe',icon:'fa-dragon',desc:'2500 points',color:'#f85149',check:function(p){return p.reputation>=2500;}},
    {id:'rep_5000',name:'Divinité',icon:'fa-sun',desc:'5000 points',color:'#f85149',check:function(p){return p.reputation>=5000;}},
    {id:'top_3',name:'Podium',icon:'fa-award',desc:'Top 3 du classement',color:'#e3b341',check:function(p,s){return s.rank<=3;}},
    {id:'top_1',name:'Champion',icon:'fa-chess-king',desc:'N°1 du classement',color:'#e3b341',check:function(p,s){return s.rank===1;}},

    // VOTES (8)
    {id:'first_vote',name:'Supporteur',icon:'fa-thumbs-up',desc:'Premier vote donné',color:'#d29922',check:function(p,s){return s.votes_given>=1;}},
    {id:'voter_10',name:'Encourageant',icon:'fa-hands-clapping',desc:'10 votes donnés',color:'#d29922',check:function(p,s){return s.votes_given>=10;}},
    {id:'voter_50',name:'Motivateur',icon:'fa-hand-holding-heart',desc:'50 votes donnés',color:'#bc8cff',check:function(p,s){return s.votes_given>=50;}},
    {id:'popular_5',name:'Populaire',icon:'fa-heart',desc:'5 votes reçus sur un signalement',color:'#f85149',check:function(p,s){return s.max_upvotes>=5;}},
    {id:'popular_10',name:'Star locale',icon:'fa-star-half-alt',desc:'10 votes sur un signalement',color:'#e3b341',check:function(p,s){return s.max_upvotes>=10;}},
    {id:'popular_25',name:'Viral',icon:'fa-bolt',desc:'25 votes sur un signalement',color:'#f85149',check:function(p,s){return s.max_upvotes>=25;}},
    {id:'total_50',name:'Apprécié',icon:'fa-gift',desc:'50 votes reçus au total',color:'#bc8cff',check:function(p,s){return s.total_upvotes>=50;}},
    {id:'total_100',name:'Icône',icon:'fa-gem',desc:'100 votes reçus',color:'#e3b341',check:function(p,s){return s.total_upvotes>=100;}},

    // WIKI (7)
    {id:'first_art',name:'Rédacteur',icon:'fa-pen-fancy',desc:'Premier article wiki',color:'#58a6ff',check:function(p,s){return s.articles>=1;}},
    {id:'writer_5',name:'Auteur',icon:'fa-book',desc:'5 articles',color:'#58a6ff',check:function(p,s){return s.articles>=5;}},
    {id:'writer_20',name:'Encyclopédiste',icon:'fa-atlas',desc:'20 articles',color:'#bc8cff',check:function(p,s){return s.articles>=20;}},
    {id:'first_cmt',name:'Bavard',icon:'fa-comment',desc:'Premier commentaire',color:'#3fb950',check:function(p,s){return s.comments>=1;}},
    {id:'cmt_25',name:'Débatteur',icon:'fa-comments',desc:'25 commentaires',color:'#58a6ff',check:function(p,s){return s.comments>=25;}},
    {id:'cmt_100',name:'Orateur',icon:'fa-bullhorn',desc:'100 commentaires',color:'#bc8cff',check:function(p,s){return s.comments>=100;}},
    {id:'helpful',name:'Utile',icon:'fa-hands-helping',desc:'Article avec 10+ votes',color:'#e3b341',check:function(p,s){return s.max_art_votes>=10;}},

    // COMMUNES (5)
    {id:'local',name:'Héros local',icon:'fa-home',desc:'10 signalements dans sa commune',color:'#3fb950',check:function(p,s){return s.home_reports>=10;}},
    {id:'explorer_3',name:'Explorateur',icon:'fa-compass',desc:'3 communes différentes',color:'#58a6ff',check:function(p,s){return s.commune_count>=3;}},
    {id:'explorer_10',name:'Globe-trotter',icon:'fa-globe-americas',desc:'10 communes',color:'#bc8cff',check:function(p,s){return s.commune_count>=10;}},
    {id:'island',name:'Maître de l\'île',icon:'fa-map-marked-alt',desc:'20 communes couvertes',color:'#e3b341',check:function(p,s){return s.commune_count>=20;}},
    {id:'mg',name:'Aventurier',icon:'fa-ship',desc:'Signalement à Marie-Galante',color:'#d29922',check:function(p,s){return s.has_mg;}},

    // SPECIAL (5)
    {id:'pioneer',name:'Pionnier',icon:'fa-rocket',desc:'Parmi les 50 premiers inscrits',color:'#f85149',check:function(p,s){return s.user_num<=50;}},
    {id:'owl',name:'Oiseau de nuit',icon:'fa-moon',desc:'Signalement entre 00h et 5h',color:'#bc8cff',check:function(p,s){return s.night_report;}},
    {id:'streak',name:'Assidu',icon:'fa-calendar-check',desc:'7 jours de suite',color:'#d29922',check:function(p,s){return s.max_streak>=7;}},
    {id:'resolver',name:'Résolveur',icon:'fa-check-double',desc:'5 signalements résolus',color:'#3fb950',check:function(p,s){return s.resolved>=5;}},
    {id:'photo',name:'Photographe',icon:'fa-camera',desc:'20 signalements avec photo',color:'#58a6ff',check:function(p,s){return s.with_photos>=20;}}
  ],

  computeStats: async function(userId) {
    var s = {
      cats:{},votes_given:0,max_upvotes:0,total_upvotes:0,
      articles:0,comments:0,max_art_votes:0,
      home_reports:0,commune_count:0,has_mg:false,
      user_num:999,night_report:false,max_streak:0,
      resolved:0,with_photos:0,rank:999
    };

    try {
      // Reports
      var rr = await App.supabase.from('reports').select('category,commune,images,status,created_at,upvotes').eq('user_id',userId);
      if (rr.data && rr.data.length) {
        var communes = {}, dates = [];
        var mgList = ['Capesterre-de-Marie-Galante','Grand-Bourg','Saint-Louis'];
        for (var i = 0; i < rr.data.length; i++) {
          var r = rr.data[i];
          s.cats[r.category] = (s.cats[r.category]||0)+1;
          if (r.commune) { communes[r.commune] = (communes[r.commune]||0)+1; if (mgList.indexOf(r.commune)>=0) s.has_mg = true; }
          if (r.images && r.images.length) s.with_photos++;
          if (r.status === 'resolved') s.resolved++;
          var uv = r.upvotes||0; s.total_upvotes += uv; if (uv > s.max_upvotes) s.max_upvotes = uv;
          var h = new Date(r.created_at).getHours(); if (h >= 0 && h < 5) s.night_report = true;
          dates.push(new Date(r.created_at).toISOString().split('T')[0]);
        }
        s.commune_count = Object.keys(communes).length;
        // Home commune
        var profile = App.currentProfile;
        if (profile && profile.commune && communes[profile.commune]) s.home_reports = communes[profile.commune];
        // Streak
        if (dates.length) {
          dates.sort();
          var unique = []; for (var j=0;j<dates.length;j++) if (unique.indexOf(dates[j])<0) unique.push(dates[j]);
          var streak=1, best=1;
          for (var k=1;k<unique.length;k++) {
            var diff = (new Date(unique[k])-new Date(unique[k-1]))/86400000;
            if (diff===1) { streak++; if(streak>best) best=streak; } else streak=1;
          }
          s.max_streak = best;
        }
      }

      // Votes given
      var vg = await App.supabase.from('votes').select('id').eq('user_id',userId);
      s.votes_given = vg.data ? vg.data.length : 0;

      // Articles
      var wa = await App.supabase.from('wiki_articles').select('upvotes').eq('author_id',userId);
      s.articles = wa.data ? wa.data.length : 0;
      if (wa.data) for (var m=0;m<wa.data.length;m++) { if ((wa.data[m].upvotes||0) > s.max_art_votes) s.max_art_votes = wa.data[m].upvotes; }

      // Comments
      var c1 = await App.supabase.from('comments').select('id').eq('user_id',userId);
      var c2 = await App.supabase.from('wiki_comments').select('id').eq('user_id',userId);
      s.comments = (c1.data?c1.data.length:0) + (c2.data?c2.data.length:0);

      // Rank
      var pr = await App.supabase.from('profiles').select('id,reputation').order('reputation',{ascending:false});
      if (pr.data) for (var n=0;n<pr.data.length;n++) { if (pr.data[n].id===userId) { s.rank=n+1; break; } }

      // User number
      var ap = await App.supabase.from('profiles').select('id').order('created_at',{ascending:true});
      if (ap.data) for (var o=0;o<ap.data.length;o++) { if (ap.data[o].id===userId) { s.user_num=o+1; break; } }

    } catch(e) { console.error('Badge stats:', e); }
    return s;
  },

  getUnlocked: async function(profile, userId) {
    var stats = await this.computeStats(userId);
    var unlocked = [];
    for (var i = 0; i < this.list.length; i++) {
      try { if (this.list[i].check(profile, stats)) unlocked.push(this.list[i]); } catch(e) {}
    }
    return { unlocked: unlocked, total: this.list.length, stats: stats };
  },

  renderGrid: function(unlocked, showAll) {
    var all = this.list;
    var pct = Math.round(unlocked.length / all.length * 100);

    var html = '<div class="badges-header">' +
      '<div class="badges-header__left"><i class="fas fa-medal" style="color:var(--yellow);font-size:1.1rem"></i>' +
      '<div><div class="badges-header__title">Badges</div>' +
      '<div class="badges-header__sub">' + unlocked.length + ' / ' + all.length + ' débloqués</div></div></div>' +
      '<div class="badges-progress"><div class="badges-progress__bar" style="width:' + pct + '%"></div></div>' +
      '<span class="badges-progress__pct">' + pct + '%</span></div>';

    html += '<div class="badges-grid">';
    for (var i = 0; i < all.length; i++) {
      var b = all[i];
      var isUnlocked = false;
      for (var j = 0; j < unlocked.length; j++) { if (unlocked[j].id === b.id) { isUnlocked = true; break; } }
      if (!showAll && !isUnlocked) continue;

      html += '<div class="badge-card' + (isUnlocked ? ' badge-card--unlocked' : '') + '" title="' + App.esc(b.desc) + '">' +
        '<div class="badge-card__glow" style="' + (isUnlocked ? 'background:' + b.color : '') + '"></div>' +
        '<div class="badge-card__icon" style="' + (isUnlocked ? 'color:' + b.color + ';border-color:' + b.color + ';box-shadow:0 0 12px ' + b.color + '44' : '') + '">' +
        '<i class="fas ' + b.icon + '"></i></div>' +
        '<div class="badge-card__name">' + App.esc(b.name) + '</div>' +
        '<div class="badge-card__desc">' + App.esc(b.desc) + '</div>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }
};
