const MapManager = {
  map: null, miniMap: null, miniMapMarker: null, markerCluster: null, markers: {},
  CENTER: [16.1745, -61.4510],
  BOUNDS: [[15.8, -61.9], [16.6, -60.9]],
  STRICT_BOUNDS: L.latLngBounds([[15.8, -61.9], [16.6, -60.9]]),

  init() {
    this.map = L.map('map', {
      center: this.CENTER, zoom: 11, minZoom: 9, maxZoom: 18,
      maxBounds: this.BOUNDS,
      maxBoundsViscosity: 1.0,
      zoomControl: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd', maxZoom: 20
    }).addTo(this.map);

    this.markerCluster = L.markerClusterGroup({
      chunkedLoading: true, maxClusterRadius: 50,
      iconCreateFunction: (c) => {
        const n = c.getChildCount();
        let s = n > 30 ? 'large' : n > 10 ? 'medium' : 'small';
        return L.divIcon({
          html: '<div class="cluster-icon cluster-icon--' + s + '">' + n + '</div>',
          className: '', iconSize: [46, 46]
        });
      }
    });
    this.map.addLayer(this.markerCluster);

    setTimeout(() => this.map.invalidateSize(), 200);
    setTimeout(() => this.map.invalidateSize(), 500);
  },

  getFaForCat(cat) {
    var c = App.categories[cat] || App.categories.other;
    var icons = UI && UI.catIcons ? UI.catIcons : {};
    return icons[c.icon] || 'fa-map-pin';
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
        '<div class="pop">' +
        '<span class="pop__cat"><i class="fas ' + fa + '"></i> ' + c.label + '</span>' +
        '<div class="pop__title">' + App.esc(r.title) + '</div>' +
        '<div class="pop__addr">' + (r.address ? App.esc(r.address.substring(0, 50)) : 'Guadeloupe') + '</div>' +
        '<div class="pop__foot">' +
        '<span class="pop__votes"><i class="fas fa-arrow-up"></i> ' + (r.upvotes || 0) + '</span>' +
        '<button class="pop__btn" onclick="Reports.openDetail(\'' + r.id + '\')">Details</button>' +
        '</div></div>',
        { maxWidth: 280 }
      );
    this.markers[r.id] = m;
    this.markerCluster.addLayer(m);
  },

  removeReport(id) {
    if (this.markers[id]) {
      this.markerCluster.removeLayer(this.markers[id]);
      delete this.markers[id];
    }
  },

  clear() { this.markerCluster.clearLayers(); this.markers = {}; },

  flyTo(lat, lng, z) {
    z = z || 16;
    this.map.flyTo([lat, lng], z, { duration: 1 });
  },

  isInGuadeloupe(lat, lng) {
    return lat >= 15.8 && lat <= 16.6 && lng >= -61.9 && lng <= -60.9;
  },

  initMiniMap() {
    if (this.miniMap) this.miniMap.remove();
    this.miniMapMarker = null;

    this.miniMap = L.map('mini-map', {
      center: this.CENTER, zoom: 11, minZoom: 10, maxZoom: 18,
      maxBounds: [[15.7, -62.0], [16.7, -60.8]],
      maxBoundsViscosity: 1.0
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 20
    }).addTo(this.miniMap);

    // Restrict dragging/zooming to Guadeloupe
    this.miniMap.on('drag', () => {
      this.miniMap.panInsideBounds(this.STRICT_BOUNDS, { animate: false });
    });

    this.miniMap.on('click', (e) => {
      var lat = e.latlng.lat;
      var lng = e.latlng.lng;
      if (!this.isInGuadeloupe(lat, lng)) {
        UI.toast('Veuillez choisir un lieu en Guadeloupe', 'warning');
        return;
      }
      this.setPin(lat, lng);
      this.reverseGeo(lat, lng);
    });

    setTimeout(() => this.miniMap.invalidateSize(), 100);
  },

  setPin(lat, lng) {
    if (!this.isInGuadeloupe(lat, lng)) {
      UI.toast('Lieu hors Guadeloupe', 'warning');
      return;
    }
    if (this.miniMapMarker) {
      this.miniMapMarker.setLatLng([lat, lng]);
    } else {
      this.miniMapMarker = L.marker([lat, lng], { draggable: true }).addTo(this.miniMap);
      this.miniMapMarker.on('dragend', (e) => {
        var p = e.target.getLatLng();
        if (!this.isInGuadeloupe(p.lat, p.lng)) {
          UI.toast('Lieu hors Guadeloupe', 'warning');
          this.miniMapMarker.setLatLng([lat, lng]);
          return;
        }
        document.getElementById('report-lat').value = p.lat;
        document.getElementById('report-lng').value = p.lng;
        this.reverseGeo(p.lat, p.lng);
      });
    }
    this.miniMap.setView([lat, lng], 16);
    document.getElementById('report-lat').value = lat;
    document.getElementById('report-lng').value = lng;
    document.getElementById('btn-step2-next').disabled = false;
  },

  async reverseGeo(lat, lng) {
    try {
      var r = await fetch(
        'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=18&addressdetails=1',
        { headers: { 'Accept-Language': 'fr' } }
      );
      var d = await r.json();
      if (d && d.display_name) {
        document.getElementById('report-address').value = d.display_name;
        document.getElementById('report-commune').value =
          (d.address && (d.address.city || d.address.town || d.address.village || d.address.municipality)) || '';
        document.getElementById('selected-address').textContent = d.display_name;
        document.getElementById('location-info').style.display = 'flex';
        document.getElementById('report-lat').value = lat;
        document.getElementById('report-lng').value = lng;
      }
    } catch (e) {
      document.getElementById('selected-address').textContent = lat.toFixed(5) + ', ' + lng.toFixed(5);
      document.getElementById('location-info').style.display = 'flex';
    }
  },

  async searchAddr(q) {
    try {
      var r = await fetch(
        'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q + ' Guadeloupe') + '&limit=5&viewbox=-61.9,15.8,-60.9,16.6&bounded=1',
        { headers: { 'Accept-Language': 'fr' } }
      );
      var results = await r.json();
      // Double-filter: only results within Guadeloupe bounds
      return results.filter(function(item) {
        var lat = parseFloat(item.lat);
        var lon = parseFloat(item.lon);
        return lat >= 15.8 && lat <= 16.6 && lon >= -61.9 && lon <= -60.9;
      });
    } catch (e) { return []; }
  }
};
