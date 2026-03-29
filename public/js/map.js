const MapManager = {
  map: null,
  miniMap: null,
  miniMapMarker: null,
  markerCluster: null,
  markers: {},

  GUADELOUPE_CENTER: [16.1745, -61.4510],

  init() {
    this.map = L.map('map', {
      center: this.GUADELOUPE_CENTER,
      zoom: 11,
      minZoom: 9,
      maxZoom: 18,
      maxBounds: [[15.5, -62.2], [16.8, -60.5]],
      zoomControl: true
    });

    // CartoDB Voyager — Pas de blocage referer !
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(this.map);

    this.markerCluster = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        let size = 'small';
        if (count > 10) size = 'medium';
        if (count > 30) size = 'large';
        return L.divIcon({
          html: `<div class="cluster-icon cluster-icon--${size}"><span>${count}</span></div>`,
          className: '',
          iconSize: L.point(46, 46)
        });
      }
    });

    this.map.addLayer(this.markerCluster);
  },

  createMarkerIcon(category) {
    const cat = App.categories[category] || App.categories.other;
    return L.divIcon({
      html: `<div class="custom-marker marker-${category}"><span class="custom-marker__inner">${cat.emoji}</span></div>`,
      className: '',
      iconSize: [38, 44],
      iconAnchor: [19, 44],
      popupAnchor: [0, -44]
    });
  },

  addReport(report) {
    if (this.markers[report.id]) return;

    const icon = this.createMarkerIcon(report.category);
    const cat = App.categories[report.category] || App.categories.other;

    const marker = L.marker([report.latitude, report.longitude], { icon })
      .bindPopup(`
        <div class="popup-content">
          <span class="popup-content__category">${cat.emoji} ${cat.label}</span>
          <h3 class="popup-content__title">${App.escapeHtml(report.title)}</h3>
          <p class="popup-content__address"><i class="fas fa-map-pin"></i> ${report.address ? App.escapeHtml(report.address.substring(0, 60)) : 'Guadeloupe'}</p>
          <div class="popup-content__footer">
            <span class="popup-content__votes"><i class="fas fa-arrow-up"></i> ${report.upvotes || 0}</span>
            <button class="popup-content__btn" onclick="Reports.openDetail('${report.id}')">Voir détails</button>
          </div>
        </div>
      `, { maxWidth: 300 });

    this.markers[report.id] = marker;
    this.markerCluster.addLayer(marker);
  },

  removeReport(id) {
    if (this.markers[id]) {
      this.markerCluster.removeLayer(this.markers[id]);
      delete this.markers[id];
    }
  },

  clearMarkers() {
    this.markerCluster.clearLayers();
    this.markers = {};
  },

  flyTo(lat, lng, zoom = 16) {
    this.map.flyTo([lat, lng], zoom, { duration: 1.2 });
  },

  initMiniMap() {
    if (this.miniMap) this.miniMap.remove();

    this.miniMap = L.map('mini-map', {
      center: this.GUADELOUPE_CENTER,
      zoom: 11,
      minZoom: 9,
      maxZoom: 18
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(this.miniMap);

    this.miniMap.on('click', (e) => {
      this.setMiniMapMarker(e.latlng.lat, e.latlng.lng);
      this.reverseGeocode(e.latlng.lat, e.latlng.lng);
    });
  },

  setMiniMapMarker(lat, lng) {
    if (this.miniMapMarker) {
      this.miniMapMarker.setLatLng([lat, lng]);
    } else {
      this.miniMapMarker = L.marker([lat, lng], { draggable: true }).addTo(this.miniMap);
      this.miniMapMarker.on('dragend', (e) => {
        const p = e.target.getLatLng();
        this.reverseGeocode(p.lat, p.lng);
      });
    }

    this.miniMap.setView([lat, lng], 16);
    document.getElementById('report-lat').value = lat;
    document.getElementById('report-lng').value = lng;
    document.getElementById('btn-step2-next').disabled = false;
  },

  async reverseGeocode(lat, lng) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'fr' }
      });
      const data = await r.json();

      if (data?.display_name) {
        const address = data.display_name;
        const commune = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || '';

        document.getElementById('report-address').value = address;
        document.getElementById('report-commune').value = commune;
        document.getElementById('selected-address').textContent = address;
        document.getElementById('location-info').style.display = 'flex';
        document.getElementById('report-lat').value = lat;
        document.getElementById('report-lng').value = lng;
      }
    } catch (e) {
      document.getElementById('selected-address').textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      document.getElementById('location-info').style.display = 'flex';
    }
  },

  async searchAddress(query) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' Guadeloupe')}&limit=5&addressdetails=1`, {
        headers: { 'Accept-Language': 'fr' }
      });
      return await r.json();
    } catch (e) {
      return [];
    }
  }
};
