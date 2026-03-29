const MapManager = {
  map: null, miniMap: null, miniMapMarker: null, markerCluster: null, markers: {},
  CENTER: [16.1745, -61.4510],

  init() {
    this.map = L.map('map', {
      center: this.CENTER, zoom: 11, minZoom: 9, maxZoom: 18,
      maxBounds: [[15.5, -62.2], [16.8, -60.5]], zoomControl: true
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
        return L.divIcon({ html: `<div class="cluster-icon cluster-icon--${s}">${n}</div>`, className: '', iconSize: [46, 46] });
      }
    });
    this.map.addLayer(this.markerCluster);

    // Fix map not rendering on load
    setTimeout(() => this.map.invalidateSize(), 200);
    setTimeout(() => this.map.invalidateSize(), 500);
  },

  mkIcon(cat) {
    const c = App.categories[cat] || App.categories.other;
    return L.divIcon({
      html: `<div class="custom-marker marker-${cat}"><span class="custom-marker__inner">${c.emoji}</span></div>`,
      className: '', iconSize: [34, 40], iconAnchor: [17, 40], popupAnchor: [0, -40]
    });
  },

  addReport(r) {
    if (this.markers[r.id]) return;
    const c = App.categories[r.category] || App.categories.other;
    const m = L.marker([r.latitude, r.longitude], { icon: this.mkIcon(r.category) })
      .bindPopup(`<div class="popup">
        <span class="popup__cat">${c.emoji} ${c.label}</span>
        <div class="popup__title">${App.esc(r.title)}</div>
        <div class="popup__addr">${r.address ? App.esc(r.address.substring(0, 50)) : 'Guadeloupe'}</div>
        <div class="popup__foot">
          <span class="popup__votes"><i class="fas fa-arrow-up"></i> ${r.upvotes || 0}</span>
          <button class="popup__btn" onclick="Reports.openDetail('${r.id}')">Détails</button>
        </div>
      </div>`, { maxWidth: 280 });
    this.markers[r.id] = m;
    this.markerCluster.addLayer(m);
  },

  removeReport(id) { if (this.markers[id]) { this.markerCluster.removeLayer(this.markers[id]); delete this.markers[id]; } },
  clear() { this.markerCluster.clearLayers(); this.markers = {}; },
  flyTo(lat, lng, z = 16) { this.map.flyTo([lat, lng], z, { duration: 1 }); },

  initMiniMap() {
    if (this.miniMap) this.miniMap.remove();
    this.miniMapMarker = null;
    this.miniMap = L.map('mini-map', { center: this.CENTER, zoom: 11, minZoom: 9, maxZoom: 18 });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 20
    }).addTo(this.miniMap);
    this.miniMap.on('click', (e) => { this.setPin(e.latlng.lat, e.latlng.lng); this.reverseGeo(e.latlng.lat, e.latlng.lng); });
    setTimeout(() => this.miniMap.invalidateSize(), 100);
  },

  setPin(lat, lng) {
    if (this.miniMapMarker) this.miniMapMarker.setLatLng([lat, lng]);
    else {
      this.miniMapMarker = L.marker([lat, lng], { draggable: true }).addTo(this.miniMap);
      this.miniMapMarker.on('dragend', (e) => { const p = e.target.getLatLng(); this.reverseGeo(p.lat, p.lng); });
    }
    this.miniMap.setView([lat, lng], 16);
    document.getElementById('report-lat').value = lat;
    document.getElementById('report-lng').value = lng;
    document.getElementById('btn-step2-next').disabled = false;
  },

  async reverseGeo(lat, lng) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { headers: { 'Accept-Language': 'fr' } });
      const d = await r.json();
      if (d?.display_name) {
        document.getElementById('report-address').value = d.display_name;
        document.getElementById('report-commune').value = d.address?.city || d.address?.town || d.address?.village || d.address?.municipality || '';
        document.getElementById('selected-address').textContent = d.display_name;
        document.getElementById('location-info').style.display = 'flex';
        document.getElementById('report-lat').value = lat;
        document.getElementById('report-lng').value = lng;
      }
    } catch (e) {
      document.getElementById('selected-address').textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      document.getElementById('location-info').style.display = 'flex';
    }
  },

  async searchAddr(q) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ' Guadeloupe')}&limit=5`, { headers: { 'Accept-Language': 'fr' } });
      return await r.json();
    } catch (e) { return []; }
  }
};
