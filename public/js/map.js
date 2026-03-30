const MapManager = {
  map: null, miniMap: null, miniMapMarker: null, markerCluster: null, markers: {},
  CENTER: [16.1745, -61.4510],
  BOUNDS: [[15.8, -61.9], [16.6, -60.9]],
  currentLayer: null,
  layerControl: null,

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

  init() {
    this.map = L.map('map', {
      center: this.CENTER, zoom: 11, minZoom: 9, maxZoom: 18,
      maxBounds: this.BOUNDS, maxBoundsViscosity: 1.0, zoomControl: true
    });

    // Default layer
    var defaultTile = this.tileLayers['Carte'];
    var opts = { attribution: defaultTile.attr, maxZoom: 20 };
    if (defaultTile.sub) opts.subdomains = defaultTile.sub;
    this.currentLayer = L.tileLayer(defaultTile.url, opts).addTo(this.map);

    this.markerCluster = L.markerClusterGroup({
      chunkedLoading: true, maxClusterRadius: 50,
      iconCreateFunction: function(c) {
        var n = c.getChildCount();
        var s = n > 30 ? 'large' : n > 10 ? 'medium' : 'small';
        return L.divIcon({ html: '<div class="cluster-icon cluster-icon--' + s + '">' + n + '</div>', className: '', iconSize: [46, 46] });
      }
    });
    this.map.addLayer(this.markerCluster);

    // Add layer switcher button
    this.addLayerSwitcher();

    setTimeout(function() { MapManager.map.invalidateSize(); }, 200);
    setTimeout(function() { MapManager.map.invalidateSize(); }, 500);
  },

  addLayerSwitcher: function() {
    var self = this;

    // Create custom control
    var LayerControl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: function() {
        var container = L.DomUtil.create('div', 'layer-switcher');
        container.innerHTML =
          '<button class="layer-switcher__btn" id="layer-switcher-btn" title="Changer de calque">' +
          '<i class="fas fa-layer-group"></i></button>' +
          '<div class="layer-switcher__menu" id="layer-switcher-menu"></div>';

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        return container;
      }
    });

    this.map.addControl(new LayerControl());

    // Populate menu
    var menu = document.getElementById('layer-switcher-menu');
    var layerNames = Object.keys(this.tileLayers);
    var html = '';
    for (var i = 0; i < layerNames.length; i++) {
      var name = layerNames[i];
      var icons = {
        'Carte': 'fa-map',
        'Sombre': 'fa-moon',
        'Satellite': 'fa-satellite',
        'Terrain': 'fa-mountain',
        'OSM': 'fa-globe'
      };
      var icon = icons[name] || 'fa-map';
      var activeClass = name === 'Carte' ? ' layer-switcher__item--active' : '';
      html += '<button class="layer-switcher__item' + activeClass + '" data-layer="' + name + '">' +
        '<i class="fas ' + icon + '"></i><span>' + name + '</span></button>';
    }
    menu.innerHTML = html;

    // Toggle menu
    var btn = document.getElementById('layer-switcher-btn');
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      menu.classList.toggle('open');
    });

    // Close on outside click
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.layer-switcher')) {
        menu.classList.remove('open');
      }
    });

    // Layer selection
    menu.querySelectorAll('.layer-switcher__item').forEach(function(item) {
      item.addEventListener('click', function() {
        var layerName = item.getAttribute('data-layer');
        self.switchLayer(layerName);
        // Update active state
        menu.querySelectorAll('.layer-switcher__item').forEach(function(i) { i.classList.remove('layer-switcher__item--active'); });
        item.classList.add('layer-switcher__item--active');
        menu.classList.remove('open');
      });
    });
  },

  switchLayer: function(name) {
    var layerDef = this.tileLayers[name];
    if (!layerDef) return;
    if (this.currentLayer) this.map.removeLayer(this.currentLayer);
    var opts = { attribution: layerDef.attr, maxZoom: 20 };
    if (layerDef.sub) opts.subdomains = layerDef.sub;
    this.currentLayer = L.tileLayer(layerDef.url, opts).addTo(this.map);
  },

  getFaForCat(cat) {
    var c = App.categories[cat] || App.categories.other;
    return (UI && UI.catIcons ? UI.catIcons : {})[c.icon] || 'fa-map-pin';
  },

  mkIcon(cat) {
    var fa = this.getFaForCat(cat);
    return L.divIcon({
      html: '<div class="custom-marker marker-' + cat + '"><span class="custom-marker__inner"><i class="fas ' + fa + '"></i></span></div>',
      className: '', iconSize: [34, 40], iconAnchor: [17, 40], popupAnchor: [0, -40]
    });
  },

  addReport(r) {
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

  removeReport(id) { if (this.markers[id]) { this.markerCluster.removeLayer(this.markers[id]); delete this.markers[id]; } },
  clear() { this.markerCluster.clearLayers(); this.markers = {}; },
  flyTo(lat, lng, z) { this.map.flyTo([lat, lng], z || 16, { duration: 1 }); },
  isInGuadeloupe(lat, lng) { return lat >= 15.8 && lat <= 16.6 && lng >= -61.9 && lng <= -60.9; },

  initMiniMap() {
    if (this.miniMap) this.miniMap.remove();
    this.miniMapMarker = null;
    this.miniMap = L.map('mini-map', {
      center: this.CENTER, zoom: 11, minZoom: 10, maxZoom: 18,
      maxBounds: [[15.7, -62.0], [16.7, -60.8]], maxBoundsViscosity: 1.0
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 20
    }).addTo(this.miniMap);

    this.miniMap.on('click', function(e) {
      if (!MapManager.isInGuadeloupe(e.latlng.lat, e.latlng.lng)) { UI.toast('Choisissez un lieu en Guadeloupe', 'warning'); return; }
      MapManager.setPin(e.latlng.lat, e.latlng.lng);
      MapManager.reverseGeo(e.latlng.lat, e.latlng.lng);
    });
    setTimeout(function() { MapManager.miniMap.invalidateSize(); }, 100);
  },

  setPin(lat, lng) {
    if (!this.isInGuadeloupe(lat, lng)) { UI.toast('Lieu hors Guadeloupe', 'warning'); return; }
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
        if (!MapManager.isInGuadeloupe(p.lat, p.lng)) {
          UI.toast('Lieu hors Guadeloupe', 'warning');
          MapManager.miniMapMarker.setLatLng([lat, lng]);
          return;
        }
        document.getElementById('report-lat').value = p.lat;
        document.getElementById('report-lng').value = p.lng;
        MapManager.reverseGeo(p.lat, p.lng);
      });
    }
    this.miniMap.setView([lat, lng], 16);
    document.getElementById('report-lat').value = lat;
    document.getElementById('report-lng').value = lng;
    document.getElementById('btn-step2-next').disabled = false;
  },

  async reverseGeo(lat, lng) {
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

  async searchAddr(q) {
    try {
      var r = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q + ' Guadeloupe') + '&limit=5&viewbox=-61.9,15.8,-60.9,16.6&bounded=1', { headers: { 'Accept-Language': 'fr' } });
      var results = await r.json();
      return results.filter(function(item) { var lat = parseFloat(item.lat); var lon = parseFloat(item.lon); return lat >= 15.8 && lat <= 16.6 && lon >= -61.9 && lon <= -60.9; });
    } catch (e) { return []; }
  }
};
