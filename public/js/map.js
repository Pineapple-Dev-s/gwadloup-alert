// ============================================
// GWADLOUP ALÈRT — Gestion de la carte
// ============================================

const MapManager = {
  map: null,
  miniMap: null,
  miniMapMarker: null,
  markerCluster: null,
  markers: {},

  // Centre de la Guadeloupe
  GUADELOUPE_CENTER: [16.1745, -61.4510],
  GUADELOUPE_BOUNDS: [
    [15.83, -61.85],
    [16.55, -60.95]
  ],

  init() {
    // Carte principale
    this.map = L.map('map', {
      center: this.GUADELOUPE_CENTER,
      zoom: 11,
      minZoom: 9,
      maxZoom: 18,
      maxBounds: [
        [15.5, -62.2],
        [16.8, -60.5]
      ],
      zoomControl: true
    });

    // Tuiles OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(this.map);

    // Cluster de marqueurs
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
          iconSize: L.point(44, 44)
        });
      }
    });

    this.map.addLayer(this.markerCluster);

    // Ajouter le style pour les clusters
    this.addClusterStyles();
  },

  addClusterStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .cluster-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        color: white;
        font-weight: 700;
        font-family: 'Space Grotesk', sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }
      .cluster-icon--small {
        width: 36px;
        height: 36px;
        font-size: 0.85rem;
        background: rgba(0, 135, 90, 0.85);
        border: 3px solid rgba(255,255,255,0.8);
      }
      .cluster-icon--medium {
        width: 44px;
        height: 44px;
        font-size: 1rem;
        background: rgba(255, 171, 0, 0.85);
        border: 3px solid rgba(255,255,255,0.8);
      }
      .cluster-icon--large {
        width: 52px;
        height: 52px;
        font-size: 1.1rem;
        background: rgba(222, 53, 11, 0.85);
        border: 3px solid rgba(255,255,255,0.8);
      }
    `;
    document.head.appendChild(style);
  },

  createMarkerIcon(category) {
    const cat = App.categories[category] || App.categories.other;
    return L.divIcon({
      html: `<div class="custom-marker marker-${category}">
               <span class="custom-marker__inner">${cat.emoji}</span>
             </div>`,
      className: '',
      iconSize: [36, 42],
      iconAnchor: [18, 42],
      popupAnchor: [0, -42]
    });
  },

  addReport(report) {
    if (this.markers[report.id]) return;

    const icon = this.createMarkerIcon(report.category);
    const cat = App.categories[report.category] || App.categories.other;
    const status = App.statuses[report.status] || App.statuses.pending;

    const marker = L.marker([report.latitude, report.longitude], { icon })
      .bindPopup(`
        <div class="popup-content">
          <span class="popup-content__category">${cat.emoji} ${cat.label}</span>
          <h3 class="popup-content__title">${App.escapeHtml(report.title)}</h3>
          <p class="popup-content__address">
            <i class="fas fa-map-pin"></i>
            ${report.address ? App.escapeHtml(report.address) : 'Position GPS'}
          </p>
          <div class="popup-content__footer">
            <span class="popup-content__votes">
              <i class="fas fa-arrow-up"></i> ${report.upvotes || 0}
            </span>
            <button class="popup-content__btn" onclick="Reports.openDetail('${report.id}')">
              Voir détails
            </button>
          </div>
        </div>
      `, { maxWidth: 300 });

    this.markers[report.id] = marker;
    this.markerCluster.addLayer(marker);
  },

  removeReport(reportId) {
    if (this.markers[reportId]) {
      this.markerCluster.removeLayer(this.markers[reportId]);
      delete this.markers[reportId];
    }
  },

  clearMarkers() {
    this.markerCluster.clearLayers();
    this.markers = {};
  },

  fitToMarkers() {
    if (this.markerCluster.getLayers().length > 0) {
      this.map.fitBounds(this.markerCluster.getBounds().pad(0.1));
    }
  },

  flyTo(lat, lng, zoom = 16) {
    this.map.flyTo([lat, lng], zoom, { duration: 1 });
  },

  // Mini carte pour le formulaire de signalement
  initMiniMap() {
    if (this.miniMap) {
      this.miniMap.remove();
    }

    this.miniMap = L.map('mini-map', {
      center: this.GUADELOUPE_CENTER,
      zoom: 11,
      minZoom: 9,
      maxZoom: 18
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OSM'
    }).addTo(this.miniMap);

    // Clic sur la mini carte pour placer un marqueur
    this.miniMap.on('click', (e) => {
      this.setMiniMapMarker(e.latlng.lat, e.latlng.lng);
      this.reverseGeocode(e.latlng.lat, e.latlng.lng);
    });
  },

  setMiniMapMarker(lat, lng) {
    if (this.miniMapMarker) {
      this.miniMapMarker.setLatLng([lat, lng]);
    } else {
      this.miniMapMarker = L.marker([lat, lng], {
        draggable: true
      }).addTo(this.miniMap);

      this.miniMapMarker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        this.reverseGeocode(pos.lat, pos.lng);
      });
    }

    this.miniMap.setView([lat, lng], 16);

    document.getElementById('report-lat').value = lat;
    document.getElementById('report-lng').value = lng;

    // Activer le bouton suivant
    document.getElementById('btn-step2-next').disabled = false;
  },

  async reverseGeocode(lat, lng) {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'fr'
          }
        }
      );
      const data = await resp.json();

      if (data && data.display_name) {
        const address = data.display_name;
        const commune = data.address?.city ||
                       data.address?.town ||
                       data.address?.village ||
                       data.address?.municipality ||
                       '';

        document.getElementById('report-address').value = address;
        document.getElementById('report-commune').value = commune;
        document.getElementById('selected-address').textContent = address;
        document.getElementById('location-info').style.display = 'flex';

        document.getElementById('report-lat').value = lat;
        document.getElementById('report-lng').value = lng;
      }
    } catch (error) {
      console.error('Erreur reverse geocoding:', error);
      document.getElementById('selected-address').textContent =
        `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
      document.getElementById('location-info').style.display = 'flex';
    }
  },

  async searchAddress(query) {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' Guadeloupe')}&limit=5&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'fr'
          }
        }
      );
      return await resp.json();
    } catch (error) {
      console.error('Erreur recherche adresse:', error);
      return [];
    }
  }
};
