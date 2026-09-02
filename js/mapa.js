/* ============================================================================
   PROYECTO: SEGURIDAD PERÚ
   Módulo de Mapa Geográfico (Google Maps API + Fallback Leaflet) - mapa.js
   Visualización de todos los puntos de denuncias policiales del Perú
   ============================================================================ */

window.SeguridadMapa = (function () {
  function init() {
    const container = document.getElementById('mapa-peru-container');
    if (!container) return;

    if (window.google && window.google.maps) {
      console.log("Cargando mapa con Google Maps API oficial...");
      window.SeguridadGoogleMaps.initMap('mapa-peru-container');
    } else {
      console.log("Iniciando mapa alternativo Leaflet mientras se carga Google Maps...");
      initLeafletMap();
    }
  }

  function initLeafletMap() {
    if (window.L === undefined) return;

    const map = L.map('mapa-peru-container').setView([-9.19, -75.015], 6);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CARTO &copy; OpenStreetMap',
      subdomains: 'abcd',
      maxZoom: 18
    }).addTo(map);

    const ds = window.SeguridadSupabase.getLocalDataset();
    if (!ds) return;

    const coordsMap = {
      'LIMA METROPOLITANA': { lat: -12.046374, lng: -77.042793 },
      'REGION LIMA': { lat: -11.1066, lng: -77.605 },
      'PROV. CONST. DEL CALLAO': { lat: -12.0565, lng: -77.1181 },
      'AREQUIPA': { lat: -16.409047, lng: -71.537451 },
      'LA LIBERTAD': { lat: -8.11599, lng: -79.02998 },
      'PIURA': { lat: -5.19449, lng: -80.63282 },
      'LAMBAYEQUE': { lat: -6.77137, lng: -79.84088 },
      'CUSCO': { lat: -13.53195, lng: -71.96746 },
      'JUNIN': { lat: -12.06513, lng: -75.20486 },
      'ICA': { lat: -14.06777, lng: -75.72861 },
      'ANCASH': { lat: -9.52612, lng: -77.52878 },
      'CAJAMARCA': { lat: -7.16378, lng: -78.50027 },
      'PUNO': { lat: -15.8422, lng: -70.0199 },
      'HUANUCO': { lat: -9.93062, lng: -76.24223 },
      'SAN MARTIN': { lat: -6.48598, lng: -76.36442 },
      'AYACUCHO': { lat: -13.15878, lng: -74.22321 },
      'LORETO': { lat: -3.74912, lng: -73.25383 },
      'UCAYALI': { lat: -8.37915, lng: -74.55387 },
      'TACNA': { lat: -18.00656, lng: -70.24627 },
      'AMAZONAS': { lat: -6.23169, lng: -77.86903 },
      'APURIMAC': { lat: -13.63389, lng: -72.88139 },
      'HUANCAVELICA': { lat: -12.78261, lng: -74.97266 },
      'MOQUEGUA': { lat: -17.19832, lng: -70.93567 },
      'PASCO': { lat: -10.66748, lng: -76.25668 },
      'MADRE DE DIOS': { lat: -12.59331, lng: -69.18913 },
      'TUMBES': { lat: -3.56694, lng: -80.45153 }
    };

    const byDept = ds.aggregations.by_dept;
    const maxVal = byDept[0]?.cantidad || 1;

    byDept.forEach(item => {
      const dptoName = item.DPTO_HECHO_NEW;
      const coords = coordsMap[dptoName];
      if (!coords) return;

      const total = item.cantidad;
      const ratio = total / maxVal;
      const radius = Math.max(12, Math.min(45, Math.sqrt(ratio) * 45));

      let fillColor = '#10B981';
      if (ratio > 0.3) fillColor = '#F59E0B';
      if (ratio > 0.6) fillColor = '#EF4444';

      const circle = L.circleMarker([coords.lat, coords.lng], {
        radius: radius,
        fillColor: fillColor,
        color: '#FFFFFF',
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.65
      }).addTo(map);

      circle.bindPopup(`
        <div style="font-family: 'Inter', sans-serif; color: #0F172A; padding: 4px;">
          <h4 style="margin: 0 0 4px 0; color: #2563EB;">${dptoName}</h4>
          <p style="margin: 0; font-size: 13px;"><strong>Denuncias totales:</strong> ${total.toLocaleString('es-PE')}</p>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748B;">Fuente: Datos Abiertos PNP (2018-2026)</p>
        </div>
      `);
    });
  }

  return {
    init: init
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('mapa-peru-container')) {
    window.SeguridadMapa.init();
  }
});
