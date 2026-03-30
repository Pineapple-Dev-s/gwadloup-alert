var MapManager = {
  map: null, miniMap: null, miniMapMarker: null, markerCluster: null, markers: {},

  // ─── Centré sur le canal des Saintes, entre Basse-Terre et Grande-Terre ───
  CENTER: [16.17, -61.45],

  // ─── Bounds élargis pour couvrir tout l'archipel sans forcer le recentrage ──
  // Inclut : Grande-Terre, Basse-Terre, Marie-Galante, Les Saintes, La Désirade
  BOUNDS: [[15.65, -62.05], [16.75, -60.75]],

  // ─── Zoom minimum abaissé à 9 pour voir l'archipel, max 18 pour le détail ──
  MIN_ZOOM: 9,
  DEFAULT_ZOOM: 11,   // zoom initial moins "écrasé"

  // ─── Validation géographique élargie aux îles ────────────────────────────
  GEO_BOUNDS: { latMin: 15.65, latMax: 16.75, lngMin: -62.05, lngMax: -60.75 },

  tileLayers: {
    'Carte':     { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',  attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>', sub: 'abcd' },
    'Sombre':    { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',             attr: '&copy; OSM &copy; CARTO', sub: 'abcd' },
    'Satellite': { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '&copy; Esri', sub: null },
    'Terrain':   { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',                         attr: '&copy; OpenTopoMap', sub: 'abc' },
    'OSM':       { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                       attr: '&copy; OpenStreetMap', sub: 'abc' }
  },
  currentLayer: null,

  // ─── Timeout par défaut pour les requêtes Nominatim (ms) ─────────────────
  GEO_TIMEOUT: 5000,

  init: function () {
    var self = this;

    this.map = L.map('map', {
      center:              this.CENTER,
      zoom:                this.DEFAULT_ZOOM,
      minZoom:             this.MIN_ZOOM,
      maxZoom:             18,
      maxBounds:           this.BOUNDS,
      // viscosité réduite : la carte résiste moins au déplacement vers les bords
      // → on peut naviguer en Basse-Terre sans être "aspiré" vers le centre
      maxBoundsViscosity:  0.5,
      zoomControl:         true
    });

    // Tuile par défaut
    this._applyLayer('Carte');

    // Cluster de marqueurs
    this.markerCluster = L.markerClusterGroup({
      chunkedLoading:    true,
      maxClusterRadius:  50,
      iconCreateFunction: function (c) {
        var n = c.getChildCount();
        var s = n > 30 ? 'large' : n > 10 ? 'medium' : 'small';
        return L.divIcon({
          html:      '<div class="cluster-icon cluster-icon--' + s + '">' + n + '</div>',
          className: '',
          iconSize:  [46, 46]
        });
      }
    });
    this.map.addLayer(this.markerCluster);

    this.addLayerSwitcher();

    // Un seul invalidateSize après que le layout est stable
    this._safeInvalidate(this.map, 300);
  },

  // ─── Applique une tuile sous les marqueurs (pane tiles) ──────────────────
  _applyLayer: function (name) {
    var def = this.tileLayers[name];
    if (!def) return;
    if (this.currentLayer) this.map.removeLayer(this.currentLayer);
    var opts = { attribution: def.attr, maxZoom: 20 };
    if (def.sub) opts.subdomains = def.sub;
    // addTo insère toujours sous le pane "overlayPane", donc sous les marqueurs
    this.currentLayer = L.tileLayer(def.url, opts).addTo(this.map);
    // S'assurer que la tuile reste derrière les marqueurs
    if (this.currentLayer.getPane) {
      this.currentLayer.setZIndex && this.currentLayer.setZIndex(1);
    }
  },

  // ─── invalidateSize unique avec délai configurable ────────────────────────
  _safeInvalidate: function (mapObj, delay) {
    setTimeout(function () {
      if (mapObj && mapObj.invalidateSize) mapObj.invalidateSize();
    }, delay || 200);
  },

  addLayerSwitcher: function () {
    var self = this;
    var LayerControl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: function () {
        var container = L.DomUtil.create('div', 'layer-switcher');
        container.innerHTML =
          '<button class="layer-switcher__btn" id="layer-switcher-btn" title="Changer de calque"><i class="fas fa-layer-group"></i></button>' +
          '<div class="layer-switcher__menu" id="layer-switcher-menu"></div>';
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        return container;
      }
    });
    this.map.addControl(new LayerControl());

    var menu  = document.getElementById('layer-switcher-menu');
    var icons = { 'Carte': 'fa-map', 'Sombre': 'fa-moon', 'Satellite': 'fa-satellite', 'Terrain': 'fa-mountain', 'OSM': 'fa-globe' };
    var names = Object.keys(this.tileLayers);
    menu.innerHTML = names.map(function (n) {
      return '<button class="layer-switcher__item' + (n === 'Carte' ? ' layer-switcher__item--active' : '') +
             '" data-layer="' + n + '"><i class="fas ' + (icons[n] || 'fa-map') + '"></i><span>' + n + '</span></button>';
    }).join('');

    document.getElementById('layer-switcher-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      menu.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.layer-switcher')) menu.classList.remove('open');
    });
    menu.querySelectorAll('.layer-switcher__item').forEach(function (item) {
      item.addEventListener('click', function () {
        self._applyLayer(item.getAttribute('data-layer'));
        menu.querySelectorAll('.layer-switcher__item').forEach(function (x) { x.classList.remove('layer-switcher__item--active'); });
        item.classList.add('layer-switcher__item--active');
        menu.classList.remove('open');
      });
    });
  },

  // switchLayer conservé pour compatibilité ascendante
  switchLayer: function (name) { this._applyLayer(name); },

  getFaForCat: function (cat) {
    var cats = (typeof App !== 'undefined' && App.categories) ? App.categories : {};
    var c    = cats[cat] || cats.other || {};
    var uiIcons = (typeof UI !== 'undefined' && UI.catIcons) ? UI.catIcons : {};
    return uiIcons[c.icon] || 'fa-map-pin';
  },

  mkIcon: function (cat) {
    var fa = this.getFaForCat(cat);
    return L.divIcon({
      html:        '<div class="custom-marker marker-' + cat + '"><span class="custom-marker__inner"><i class="fas ' + fa + '"></i></span></div>',
      className:   '',
      iconSize:    [34, 40],
      iconAnchor:  [17, 40],
      popupAnchor: [0, -40]
    });
  },

  // ─── Vérifie les coordonnées avant d'ajouter un rapport ──────────────────
  addReport: function (r) {
    if (!r || !r.id) return;
    if (this.markers[r.id]) return;

    var lat = parseFloat(r.latitude);
    var lng = parseFloat(r.longitude);
    if (isNaN(lat) || isNaN(lng) || !this.isInGuadeloupe(lat, lng)) {
      console.warn('[MapManager] Coordonnées invalides pour le rapport', r.id, lat, lng);
      return;
    }

    var cats = (typeof App !== 'undefined' && App.categories) ? App.categories : {};
    var c    = cats[r.category] || cats.other || { label: r.category };
    var fa   = this.getFaForCat(r.category);
    var esc  = (typeof App !== 'undefined' && App.esc) ? App.esc : function (s) { return String(s).replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; }); };

    var m = L.marker([lat, lng], { icon: this.mkIcon(r.category) })
      .bindPopup(
        '<div class="pop">' +
          '<span class="pop__cat"><i class="fas ' + fa + '"></i> ' + c.label + '</span>' +
          '<div class="pop__title">' + esc(r.title) + '</div>' +
          '<div class="pop__addr">' + (r.address ? esc(r.address.substring(0, 50)) : 'Guadeloupe') + '</div>' +
          '<div class="pop__foot">' +
            '<span class="pop__votes"><i class="fas fa-arrow-up"></i> ' + (r.upvotes || 0) + '</span>' +
            '<button class="pop__btn" onclick="Reports.openDetail(\'' + r.id + '\')">Détails</button>' +
          '</div>' +
        '</div>',
        { maxWidth: 280 }
      );

    this.markers[r.id] = m;
    this.markerCluster.addLayer(m);
  },

  removeReport: function (id) {
    if (this.markers[id]) {
      this.markerCluster.removeLayer(this.markers[id]);
      delete this.markers[id];
    }
  },

  // ─── clear propre : retire toutes les couches puis vide l'index ──────────
  clear: function () {
    this.markerCluster.clearLayers();
    this.markers = {};
  },

  flyTo: function (lat, lng, z) {
    this.map.flyTo([lat, lng], z || 16, { duration: 1 });
  },

  isInGuadeloupe: function (lat, lng) {
    var b = this.GEO_BOUNDS;
    return lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax;
  },

  // ─── Mini-map : initialisation robuste avec callback ─────────────────────
  initMiniMap: function (onReady) {
    var self = this;
    if (this.miniMap) { this.miniMap.remove(); this.miniMap = null; this.miniMapMarker = null; }

    var container = document.getElementById('mini-map');
    if (!container) { console.warn('[MapManager] #mini-map introuvable'); return; }

    container.style.width  = '100%';
    container.style.height = '220px';

    this.miniMap = L.map('mini-map', {
      center:             this.CENTER,
      zoom:               11,
      minZoom:            this.MIN_ZOOM,
      maxZoom:            18,
      maxBounds:          [[15.5, -62.2], [16.8, -60.7]],
      maxBoundsViscosity: 0.5
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 20
    }).addTo(this.miniMap);

    this.miniMap.on('click', function (e) {
      if (!self.isInGuadeloupe(e.latlng.lat, e.latlng.lng)) {
        if (typeof UI !== 'undefined') UI.toast('Choisissez un lieu en Guadeloupe', 'warning');
        return;
      }
      self.setPin(e.latlng.lat, e.latlng.lng);
      self.reverseGeo(e.latlng.lat, e.latlng.lng);
    });

    // Un seul invalidateSize suffit une fois le layout prêt
    this._safeInvalidate(this.miniMap, 200);
    if (typeof onReady === 'function') setTimeout(onReady, 250);
  },

  setPin: function (lat, lng) {
    if (!this.isInGuadeloupe(lat, lng)) {
      if (typeof UI !== 'undefined') UI.toast('Lieu hors Guadeloupe', 'warning');
      return;
    }
    // Garde les coords de la position valide précédente pour rollback
    var prevLat = lat, prevLng = lng;
    var self = this;

    if (!this.miniMap) { console.warn('[MapManager] setPin appelé avant initMiniMap'); return; }

    if (this.miniMapMarker) {
      this.miniMapMarker.setLatLng([lat, lng]);
    } else {
      var pinIcon = L.divIcon({
        html:      '<div class="pin-select"><div class="pin-select__dot"></div><div class="pin-select__pulse"></div></div>',
        className: '',
        iconSize:  [40, 40],
        iconAnchor:[20, 20]
      });
      this.miniMapMarker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(this.miniMap);
      this.miniMapMarker.on('dragend', function (e) {
        var p = e.target.getLatLng();
        if (!self.isInGuadeloupe(p.lat, p.lng)) {
          if (typeof UI !== 'undefined') UI.toast('Lieu hors Guadeloupe', 'warning');
          self.miniMapMarker.setLatLng([prevLat, prevLng]);
          return;
        }
        prevLat = p.lat; prevLng = p.lng;
        self._updateLatLng(p.lat, p.lng);
        self.reverseGeo(p.lat, p.lng);
      });
    }

    this._updateLatLng(lat, lng);
    this.miniMap.setView([lat, lng], 16, { animate: true });
  },

  // ─── Mise à jour centralisée des champs cachés + bouton ──────────────────
  _updateLatLng: function (lat, lng) {
    var fLat = document.getElementById('report-lat');
    var fLng = document.getElementById('report-lng');
    var btn  = document.getElementById('btn-step2-next');
    if (fLat) fLat.value = lat;
    if (fLng) fLng.value = lng;
    if (btn)  btn.disabled = false;
  },

  // ─── Géocodage inverse avec timeout ──────────────────────────────────────
  reverseGeo: async function (lat, lng) {
    var ctrl = new AbortController();
    var tid  = setTimeout(function () { ctrl.abort(); }, this.GEO_TIMEOUT);
    try {
      var r = await fetch(
        'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=18&addressdetails=1',
        { headers: { 'Accept-Language': 'fr' }, signal: ctrl.signal }
      );
      clearTimeout(tid);
      var d = await r.json();
      if (d && d.display_name) {
        this._fillAddressFields(d);
      } else {
        this._fillAddressRaw(lat, lng);
      }
    } catch (e) {
      clearTimeout(tid);
      this._fillAddressRaw(lat, lng);
    }
  },

  _fillAddressFields: function (d) {
    var addr = document.getElementById('report-address');
    var comm = document.getElementById('report-commune');
    var sel  = document.getElementById('selected-address');
    var info = document.getElementById('location-info');
    if (addr) addr.value = d.display_name;
    if (comm && d.address) comm.value = d.address.city || d.address.town || d.address.village || d.address.municipality || '';
    if (sel)  sel.textContent = d.display_name;
    if (info) info.style.display = 'flex';
  },

  _fillAddressRaw: function (lat, lng) {
    var sel  = document.getElementById('selected-address');
    var info = document.getElementById('location-info');
    if (sel)  sel.textContent = lat.toFixed(5) + ', ' + lng.toFixed(5);
    if (info) info.style.display = 'flex';
  },

  // ─── Recherche d'adresse avec timeout ────────────────────────────────────
  searchAddr: async function (q) {
    var ctrl = new AbortController();
    var tid  = setTimeout(function () { ctrl.abort(); }, this.GEO_TIMEOUT);
    try {
      var b = this.GEO_BOUNDS;
      var r = await fetch(
        'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q + ' Guadeloupe') +
        '&limit=5&viewbox=' + b.lngMin + ',' + b.latMin + ',' + b.lngMax + ',' + b.latMax + '&bounded=1',
        { headers: { 'Accept-Language': 'fr' }, signal: ctrl.signal }
      );
      clearTimeout(tid);
      var results = await r.json();
      var self = this;
      return results.filter(function (item) {
        return self.isInGuadeloupe(parseFloat(item.lat), parseFloat(item.lon));
      });
    } catch (e) {
      clearTimeout(tid);
      return [];
    }
  }
};
