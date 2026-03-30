var MapManager = {
  map: null, miniMap: null, miniMapMarker: null, markerCluster: null, markers: {},
  CENTER: [16.1745, -61.4510],
  BOUNDS: [[15.6, -62.1], [16.7, -60.8]],

  tileLayers: {
    'Carte': {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      sub: 'abcd'
    },
    'Sombre': {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attr: '&copy; OSM &copy; CARTO',
      sub: 'abcd'
    },
    'Satellite': {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attr: '&copy; Esri',
      sub: null
    },
    'Terrain': {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attr: '&copy; OpenTopoMap',
      sub: 'abc'
    },
    'OSM': {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attr: '&copy; OpenStreetMap',
      sub: 'abc'
    }
  },
  currentLayer: null,

  init: function() {
    var self = this;
    this.map = L.map('map', {
      center: this.CENTER, zoom: 10, minZoom: 8, maxZoom: 18,
      maxBounds: this.BOUNDS, maxBoundsViscosity: 0.8, zoomControl: true
    });

    var def = this.tileLayers['Carte'];
    var opts = { attribution: def.attr, maxZoom: 20 };
    if (def.sub) opts.subdomains = def.sub;
    this.currentLayer = L.tileLayer(def.url, opts).addTo(this.map);

    this.markerCluster = L.markerClusterGroup({
      chunkedLoading: true, maxClusterRadius: 50,
      iconCreateFunction: function(c) {
        var n = c.getChildCount();
        var s = n > 30 ? 'large' : n > 10 ? 'medium' : 'small';
        return L.divIcon({ html: '<div class="cluster-icon cluster-icon--' + s + '">' + n + '</div>', className: '', iconSize: [46, 46] });
      }
    });
    this.map.addLayer(this.markerCluster);
    this.addLayerSwitcher();
    setTimeout(function() { self.map.invalidateSize(); }, 200);
    setTimeout(function() { self.map.invalidateSize(); }, 500);
  },

  addLayerSwitcher: function() {
    var self = this;
    var LayerControl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: function() {
        var container = L.DomUtil.create('div', 'layer-switcher');
        container.innerHTML = '<button class="layer-switcher__btn" id="layer-switcher-btn" title="Changer de calque"><i class="fas fa-layer-group"></i></button>' +
          '<div class="layer-switcher__menu" id="layer-switcher-menu"></div>';
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        return container;
      }
    });
    this.map.addControl(new LayerControl());

    var menu = document.getElementById('layer-switcher-menu');
    var icons = { 'Carte': 'fa-map', 'Sombre': 'fa-moon', 'Satellite': 'fa-satellite', 'Terrain': 'fa-mountain', 'OSM': 'fa-globe' };
    var names = Object.keys(this.tileLayers);
    var html = '';
    for (var i = 0; i < names.length; i++) {
      html += '<button class="layer-switcher__item' + (names[i] === 'Carte' ? ' layer-switcher__item--active' : '') + '" data-layer="' + names[i] + '"><i class="fas ' + (icons[names[i]] || 'fa-map') + '"></i><span>' + names[i] + '</span></button>';
    }
    menu.innerHTML = html;

    document.getElementById('layer-switcher-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      menu.classList.toggle('open');
    });
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.layer-switcher')) menu.classList.remove('open');
    });
    menu.querySelectorAll('.layer-switcher__item').forEach(function(item) {
      item.addEventListener('click', function() {
        self.switchLayer(item.getAttribute('data-layer'));
        menu.querySelectorAll('.layer-switcher__item').forEach(function(x) { x.classList.remove('layer-switcher__item--active'); });
        item.classList.add('layer-switcher__item--active');
        menu.classList.remove('open');
      });
    });
  },

  switchLayer: function(name) {
    var def = this.tileLayers[name];
    if (!def) return;
    if (this.currentLayer) this.map.removeLayer(this.currentLayer);
    var opts = { attribution: def.attr, maxZoom: 20 };
    if (def.sub) opts.subdomains = def.sub;
    this.currentLayer = L.tileLayer(def.url, opts).addTo(this.map);
  },

  getFaForCat: function(cat) {
    var c = App.categories[cat] || App.categories.other;
    return (UI && UI.catIcons) ? (UI.catIcons[c.icon] || 'fa-map-pin') : 'fa-map-pin';
  },

  mkIcon: function(cat) {
    var fa = this.getFaForCat(cat);
    return L.divIcon({
      html: '<div class="custom-marker marker-' + cat + '"><span class="custom-marker__inner"><i class="fas ' + fa + '"></i></span></div>',
      className: '', iconSize: [34, 40], iconAnchor: [17, 40], popupAnchor: [0, -40]
    });
  },

  addReport: function(r) {
    if (this.markers[r.id]) return;
    var c = App.categories[r.category] || App.categories.other;
    var fa = this.getFaForCat(r.category);
    var m = L.marker([r.latitude, r.longitude], { icon: this.mkIcon(r.category) })
      .bindPopup(
        '<div class="pop"><span class="pop__cat"><i class="fas ' + fa + '"></i> ' + c.label + '</span>' +
        '<div class="pop__title">' + App.esc(r.title) + '</div>' +
        '<div class="pop__addr">' + (r.address ? App.esc(r.address.substring(0, 50)) : 'Guadeloupe') + '</div>' +
        '<div class="pop__foot"><span class="pop__votes"><i class="fas fa-arrow-up"></i> ' + (r.upvotes || 0) + '</span>' +
        '<button class="pop__btn" onclick="Reports.openDetail(\'' + r.id + '\')">Détails</button></div></div>',
        { maxWidth: 280 }
      );
    this.markers[r.id] = m;
    this.markerCluster.addLayer(m);
  },

  removeReport: function(id) {
    if (this.markers[id]) { this.markerCluster.removeLayer(this.markers[id]); delete this.markers[id]; }
  },

  clear: function() { this.markerCluster.clearLayers(); this.markers = {}; },

  flyTo: function(lat, lng, z) { this.map.flyTo([lat, lng], z || 16, { duration: 1 }); },

  isInGuadeloupe: function(lat, lng) {
    return lat >= 15.6 && lat <= 16.7 && lng >= -62.1 && lng <= -60.8;
  },

  initMiniMap: function() {
    var self = this;
    if (this.miniMap) { this.miniMap.remove(); this.miniMap = null; }
    this.miniMapMarker = null;

    setTimeout(function() {
      var container = document.getElementById('mini-map');
      if (!container) return;
      container.style.width = '100%';
      container.style.height = '220px';

      self.miniMap = L.map('mini-map', {
        center: self.CENTER, zoom: 10, minZoom: 8, maxZoom: 18,
        maxBounds: [[15.5, -62.2], [16.8, -60.7]], maxBoundsViscosity: 0.8
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd', maxZoom: 20
      }).addTo(self.miniMap);

      self.miniMap.on('click', function(e) {
        if (!self.isInGuadeloupe(e.latlng.lat, e.latlng.lng)) { UI.toast('Choisissez un lieu en Guadeloupe', 'warning'); return; }
        self.setPin(e.latlng.lat, e.latlng.lng);
        self.reverseGeo(e.latlng.lat, e.latlng.lng);
      });

      setTimeout(function() { if (self.miniMap) self.miniMap.invalidateSize(); }, 100);
      setTimeout(function() { if (self.miniMap) self.miniMap.invalidateSize(); }, 300);
      setTimeout(function() { if (self.miniMap) self.miniMap.invalidateSize(); }, 600);
    }, 150);
  },

  setPin: function(lat, lng) {
    if (!this.isInGuadeloupe(lat, lng)) { UI.toast('Lieu hors Guadeloupe', 'warning'); return; }
    var self = this;

    if (this.miniMapMarker) {
      this.miniMapMarker.setLatLng([lat, lng]);
    } else {
      var pinIcon = L.divIcon({
        html: '<div class="pin-select"><div class="pin-select__dot"></div><div class="pin-select__pulse"></div></div>',
        className: '', iconSize: [40, 40], iconAnchor: [20, 20]
      });
      this.miniMapMarker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(this.miniMap);
      this.miniMapMarker.on('dragend', function(e) {
        var p = e.target.getLatLng();
        if (!self.isInGuadeloupe(p.lat, p.lng)) {
          UI.toast('Lieu hors Guadeloupe', 'warning');
          self.miniMapMarker.setLatLng([lat, lng]);
          return;
        }
        document.getElementById('report-lat').value = p.lat;
        document.getElementById('report-lng').value = p.lng;
        self.reverseGeo(p.lat, p.lng);
      });
    }

    document.getElementById('report-lat').value = lat;
    document.getElementById('report-lng').value = lng;
    document.getElementById('btn-step2-next').disabled = false;

    setTimeout(function() {
      if (self.miniMap) {
        self.miniMap.invalidateSize();
        self.miniMap.setView([lat, lng], 16, { animate: true });
      }
    }, 50);
  },

  reverseGeo: async function(lat, lng) {
    try {
      var r = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=18&addressdetails=1', { headers: { 'Accept-Language': 'fr' } });
      var d = await r.json();
      if (d && d.display_name) {
        document.getElementById('report-address').value = d.display_name;
        document.getElementById('report-commune').value = (d.address && (d.address.city || d.address.town || d.address.village || d.address.municipality)) || '';
        document.getElementById('selected-address').textContent = d.display_name;
        document.getElementById('location-info').style.display = 'flex';
      }
    } catch (e) {
      document.getElementById('selected-address').textContent = lat.toFixed(5) + ', ' + lng.toFixed(5);
      document.getElementById('location-info').style.display = 'flex';
    }
  },

  searchAddr: async function(q) {
    try {
      var r = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q + ' Guadeloupe') + '&limit=5&viewbox=-62.1,15.6,-60.8,16.7&bounded=1', { headers: { 'Accept-Language': 'fr' } });
      var results = await r.json();
      return results.filter(function(item) {
        var lat = parseFloat(item.lat), lon = parseFloat(item.lon);
        return lat >= 15.6 && lat <= 16.7 && lon >= -62.1 && lon <= -60.8;
      });
    } catch (e) { return []; }
  }
};
