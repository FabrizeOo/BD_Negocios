/* ============================================================================
   PROYECTO: SEGURIDAD PERÚ
   Supabase Client & Real PostgreSQL Data Connector - supabase.js
   Conexión activa a la base de datos oficial en Supabase Cloud
   ============================================================================ */

window.SeguridadSupabase = (function () {
  let supabaseClient = null;
  let isConnected = false;

  // Real Supabase Credentials Provided
  const SUPABASE_URL = "https://hxkeheonfeqjftbnymdg.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4a2VoZW9uZmVxamZ0Ym55bWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3OTQyOTQsImV4cCI6MjEwMzM3MDI5NH0.xo03Gxry6mxn2lYun3oW35wXr8Utx1YZV12nH17W7xY";

  function init() {
    if (window.supabase) {
      try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        isConnected = true;
        console.log("Conexión exitosa a Supabase PostgreSQL Cloud:", SUPABASE_URL);
      } catch (err) {
        console.warn("Error al inicializar cliente Supabase, usando respaldo local:", err);
        isConnected = false;
      }
    } else {
      console.warn("Librería de Supabase no cargada en la página.");
      isConnected = false;
    }
    updateConnectionUI();
  }

  function updateConnectionUI() {
    const badge = document.getElementById('supabase-status-badge');
    const text = document.getElementById('supabase-status-text');
    if (badge && text) {
      if (isConnected) {
        badge.className = 'status-badge';
        badge.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
        badge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        badge.style.color = '#10B981';
        text.textContent = 'Supabase Cloud (PostgreSQL Live)';
      } else {
        badge.className = 'status-badge';
        text.textContent = 'Modo Desconectado';
      }
    }
  }

  function getLocalDataset() {
    return window.SEGURIDAD_DATASET || null;
  }

  return {
    init: init,
    isConnected: function () { return isConnected; },
    getClient: function () { return supabaseClient; },
    getLocalDataset: getLocalDataset,
    getUrl: function() { return SUPABASE_URL; },
    getAnonKey: function() { return SUPABASE_ANON_KEY; }
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  window.SeguridadSupabase.init();
});
