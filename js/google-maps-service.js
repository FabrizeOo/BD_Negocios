/* ============================================================================
   PROYECTO: SEGURIDAD PERÚ
   Módulo de Integración Oficial con Google Maps API - google-maps-service.js
   Visualización espacial de alta resolución con API Key oficial
   ============================================================================ */

window.SeguridadGoogleMaps = (function () {
  let mapInstance = null;
  let markers = [];
  let infoWindow = null;

  const API_KEY = "AIzaSyCJ3ihp8E2H4kD_91iiVMwglv0KMUgQfbw";

  // Coordinates dataset for Peruvian Departments & Primary District Hotspots
  const COORDS_DATA = {
    // 26 Departments
    'LIMA METROPOLITANA': { lat: -12.046374, lng: -77.042793, type: 'dept' },
    'REGION LIMA': { lat: -11.1066, lng: -77.605, type: 'dept' },
    'PROV. CONST. DEL CALLAO': { lat: -12.0565, lng: -77.1181, type: 'dept' },
    'AREQUIPA': { lat: -16.409047, lng: -71.537451, type: 'dept' },
    'LA LIBERTAD': { lat: -8.11599, lng: -79.02998, type: 'dept' },
    'PIURA': { lat: -5.19449, lng: -80.63282, type: 'dept' },
    'LAMBAYEQUE': { lat: -6.77137, lng: -79.84088, type: 'dept' },
    'CUSCO': { lat: -13.53195, lng: -71.96746, type: 'dept' },
    'JUNIN': { lat: -12.06513, lng: -75.20486, type: 'dept' },
    'ICA': { lat: -14.06777, lng: -75.72861, type: 'dept' },
    'ANCASH': { lat: -9.52612, lng: -77.52878, type: 'dept' },
    'CAJAMARCA': { lat: -7.16378, lng: -78.50027, type: 'dept' },
    'PUNO': { lat: -15.8422, lng: -70.0199, type: 'dept' },
    'HUANUCO': { lat: -9.93062, lng: -76.24223, type: 'dept' },
    'SAN MARTIN': { lat: -6.48598, lng: -76.36442, type: 'dept' },
    'AYACUCHO': { lat: -13.15878, lng: -74.22321, type: 'dept' },
    'LORETO': { lat: -3.74912, lng: -73.25383, type: 'dept' },
    'UCAYALI': { lat: -8.37915, lng: -74.55387, type: 'dept' },
    'TACNA': { lat: -18.00656, lng: -70.24627, type: 'dept' },
    'AMAZONAS': { lat: -6.23169, lng: -77.86903, type: 'dept' },
    'APURIMAC': { lat: -13.63389, lng: -72.88139, type: 'dept' },
    'HUANCAVELICA': { lat: -12.78261, lng: -74.97266, type: 'dept' },
    'MOQUEGUA': { lat: -17.19832, lng: -70.93567, type: 'dept' },
    'PASCO': { lat: -10.66748, lng: -76.25668, type: 'dept' },
    'MADRE DE DIOS': { lat: -12.59331, lng: -69.18913, type: 'dept' },
    'TUMBES': { lat: -3.56694, lng: -80.45153, type: 'dept' },

    // Primary High-Volume Districts
    'SAN JUAN DE LURIGANCHO': { lat: -11.9767, lng: -76.9996, type: 'dist' },
    'SAN MARTIN DE PORRES': { lat: -12.0167, lng: -77.0833, type: 'dist' },
    'ATE': { lat: -12.0264, lng: -76.9189, type: 'dist' },
    'COMAS': { lat: -11.9353, lng: -77.0456, type: 'dist' },
    'VILLA EL SALVADOR': { lat: -12.2167, lng: -76.9333, type: 'dist' },
    'TRUJILLO': { lat: -8.116, lng: -79.03, type: 'dist' },
    'CHICLAYO': { lat: -6.7714, lng: -79.8409, type: 'dist' },
    'PIURA DISTRITO': { lat: -5.1945, lng: -80.6328, type: 'dist' },
    'CHIMBOTE': { lat: -9.0853, lng: -78.5783, type: 'dist' },
    'HUANCAYO DISTRITO': { lat: -12.0651, lng: -75.2049, type: 'dist' },
    'JULIACA': { lat: -15.498, lng: -70.133, type: 'dist' },
    'IQUITOS': { lat: -3.7491, lng: -73.2538, type: 'dist' },
    'PUCALLPA': { lat: -8.3792, lng: -74.5539, type: 'dist' },
    'TARAPOTO': { lat: -6.486, lng: -76.3644, type: 'dist' },
    'SULLANA': { lat: -4.9039, lng: -80.6853, type: 'dist' }
  };

  function initMap(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (window.google && window.google.maps) {
      console.log("Inicializando Google Maps con API Key oficial...");
      
      mapInstance = new google.maps.Map(el, {
        center: { lat: -9.19, lng: -75.015 },
        zoom: 6,
        mapTypeId: 'roadmap',
        styles: [
          { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
          { elementType: "labels.text.highlight", stylers: [{ color: "#1f2835" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
          { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#4b687a" }] },
          { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#4b687a" }] },
          { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#023e58" }] },
          { featureType: "poi", elementType: "geometry", stylers: [{ color: "#283d6a" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] }
        ]
      });

      infoWindow = new google.maps.InfoWindow();

      renderAllPoints();
    } else {
      console.warn("Cargando SDK de Google Maps...");
    }
  }

  function renderAllPoints() {
    const ds = window.SeguridadSupabase.getLocalDataset();
    if (!ds || !mapInstance) return;

    // Clear existing markers
    markers.forEach(m => m.setMap(null));
    markers = [];

    const byDept = ds.aggregations.by_dept;
    const maxVal = byDept[0]?.cantidad || 1;

    byDept.forEach(item => {
      const name = item.DPTO_HECHO_NEW;
      const coords = COORDS_DATA[name];
      if (!coords) return;

      const total = item.cantidad;
      const ratio = total / maxVal;
      const radius = Math.max(16, Math.min(50, Math.sqrt(ratio) * 50));

      let fillColor = '#10B981';
      if (ratio > 0.3) fillColor = '#F59E0B';
      if (ratio > 0.6) fillColor = '#EF4444';

      const circle = new google.maps.Circle({
        strokeColor: '#FFFFFF',
        strokeOpacity: 0.9,
        strokeWeight: 1.5,
        fillColor: fillColor,
        fillOpacity: 0.65,
        map: mapInstance,
        center: { lat: coords.lat, lng: coords.lng },
        radius: radius * 3500
      });

      const marker = new google.maps.Marker({
        position: { lat: coords.lat, lng: coords.lng },
        map: mapInstance,
        title: `${name}: ${total.toLocaleString('es-PE')} denuncias`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: '#FFFFFF',
          fillOpacity: 1,
          strokeWeight: 1,
          strokeColor: '#000000'
        }
      });

      const contentString = `
        <div style="font-family: 'Inter', sans-serif; color: #0F172A; padding: 6px; min-width: 180px;">
          <h4 style="margin: 0 0 6px 0; color: #2563EB; font-size: 14px; font-weight: 700;">${name}</h4>
          <p style="margin: 0; font-size: 12px;"><strong>Denuncias Totales:</strong> ${total.toLocaleString('es-PE')}</p>
          <p style="margin: 3px 0 0 0; font-size: 11px; color: #10B981;"><strong>Macroregión:</strong> ${item.MACROREGION || 'CENTRO'}</p>
          <p style="margin: 4px 0 0 0; font-size: 10px; color: #64748B;">Fuente: Datos Abiertos PNP (2018-2026)</p>
        </div>
      `;

      marker.addListener("click", () => {
        infoWindow.setContent(contentString);
        infoWindow.open(mapInstance, marker);
      });

      markers.push(marker);
    });

    // Render High-Volume District Hotspots
    const topDists = ds.aggregations.top_distritos.slice(0, 15);
    topDists.forEach(dist => {
      const distName = dist.DIST_HECHO;
      const coords = COORDS_DATA[distName];
      if (!coords) return;

      const distMarker = new google.maps.Marker({
        position: { lat: coords.lat, lng: coords.lng },
        map: mapInstance,
        title: `Distrito ${distName}: ${dist.cantidad.toLocaleString('es-PE')} denuncias`,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 5,
          fillColor: '#EF4444',
          fillOpacity: 0.9,
          strokeWeight: 1,
          strokeColor: '#FFFFFF'
        }
      });

      distMarker.addListener("click", () => {
        infoWindow.setContent(`
          <div style="font-family: 'Inter', sans-serif; color: #0F172A; padding: 6px;">
            <h4 style="margin: 0 0 4px 0; color: #EF4444; font-size: 13px;">DISTRITO: ${distName}</h4>
            <p style="margin: 0; font-size: 12px;"><strong>Provincia:</strong> ${dist.PROV_HECHO}</p>
            <p style="margin: 2px 0 0 0; font-size: 12px;"><strong>Departamento:</strong> ${dist.DPTO_HECHO_NEW}</p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #2563EB;"><strong>Total Denuncias:</strong> ${dist.cantidad.toLocaleString('es-PE')}</p>
          </div>
        `);
        infoWindow.open(mapInstance, distMarker);
      });

      markers.push(distMarker);
    });
  }

  return {
    initMap: initMap,
    renderAllPoints: renderAllPoints,
    getApiKey: function() { return API_KEY; }
  };
})();
