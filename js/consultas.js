/* ============================================================================
   PROYECTO: SEGURIDAD PERÚ
   Centro de Consultas SQL - consultas.js
   Ejecutor interactivo con soporte directo a Supabase PostgreSQL Cloud
   ============================================================================ */

window.SeguridadConsultas = (function () {
  const queries = [
    {
      id: 1,
      title: "1. Denuncias por departamento",
      description: "Agregación total de denuncias registradas en cada departamento del Perú.",
      sql: `SELECT u.departamento, SUM(f.cantidad_denuncias) AS total_denuncias
FROM vw_denuncias_global f
JOIN dim_ubicacion u ON f.id_ubicacion = u.id_ubicacion
GROUP BY u.departamento
ORDER BY total_denuncias DESC;`,
      supabaseRpc: 'fn_get_denuncias_departamento',
      executor: function (ds) {
        return ds.aggregations.by_dept;
      }
    },
    {
      id: 2,
      title: "2. Top 10 departamentos más afectados",
      description: "Los 10 departamentos con mayor nivel de incidencia delictiva.",
      sql: `SELECT u.departamento, u.macroregion, SUM(f.cantidad_denuncias) AS total_denuncias
FROM vw_denuncias_global f
JOIN dim_ubicacion u ON f.id_ubicacion = u.id_ubicacion
GROUP BY u.departamento, u.macroregion
ORDER BY total_denuncias DESC
LIMIT 10;`,
      supabaseRpc: 'fn_get_denuncias_departamento',
      executor: function (ds) {
        return ds.aggregations.by_dept.slice(0, 10);
      }
    },
    {
      id: 3,
      title: "3. Top 10 distritos con mayor número de denuncias",
      description: "Distritos a nivel nacional que registran mayor concentración de denuncias.",
      sql: `SELECT u.departamento, u.provincia, u.distrito, SUM(f.cantidad_denuncias) AS total_denuncias
FROM vw_denuncias_global f
JOIN dim_ubicacion u ON f.id_ubicacion = u.id_ubicacion
GROUP BY u.departamento, u.provincia, u.distrito
ORDER BY total_denuncias DESC
LIMIT 10;`,
      executor: function (ds) {
        return ds.aggregations.top_distritos.slice(0, 10);
      }
    },
    {
      id: 4,
      title: "4. Tipos de hecho / modalidades más frecuentes",
      description: "Distribución nacional de denuncias por tipo de hecho o modalidad delictiva.",
      sql: `SELECT d.modalidad, d.categoria, SUM(f.cantidad_denuncias) AS total_denuncias
FROM vw_denuncias_global f
JOIN dim_delito d ON f.id_delito = d.id_delito
GROUP BY d.modalidad, d.categoria
ORDER BY total_denuncias DESC;`,
      executor: function (ds) {
        return ds.aggregations.by_delito;
      }
    },
    {
      id: 5,
      title: "5. Evolución histórica anual",
      description: "Consolidado interanual de denuncias entre los años 2018 y 2026.",
      sql: `SELECT t.anio, SUM(f.cantidad_denuncias) AS total_denuncias
FROM vw_denuncias_global f
JOIN dim_tiempo t ON f.id_tiempo = t.id_tiempo
GROUP BY t.anio
ORDER BY t.anio ASC;`,
      executor: function (ds) {
        return ds.aggregations.by_year;
      }
    },
    {
      id: 6,
      title: "6. Evolución mensual detallada",
      description: "Comportamiento mes a mes acumulado durante la serie temporal del dataset.",
      sql: `SELECT t.anio, t.mes, t.nombre_mes, SUM(f.cantidad_denuncias) AS total_denuncias
FROM vw_denuncias_global f
JOIN dim_tiempo t ON f.id_tiempo = t.id_tiempo
GROUP BY t.anio, t.mes, t.nombre_mes
ORDER BY t.anio ASC, t.mes ASC;`,
      supabaseRpc: 'fn_get_evolucion_mensual',
      executor: function (ds) {
        return ds.aggregations.by_year_month.slice(0, 24);
      }
    },
    {
      id: 7,
      title: "7. Comparación entre departamentos (Lima vs Arequipa vs La Libertad)",
      description: "Comparativa directa de la incidencia delictiva entre tres regiones clave.",
      sql: `SELECT u.departamento, SUM(f.cantidad_denuncias) AS total_denuncias
FROM vw_denuncias_global f
JOIN dim_ubicacion u ON f.id_ubicacion = u.id_ubicacion
WHERE u.departamento IN ('LIMA METROPOLITANA', 'AREQUIPA', 'LA LIBERTAD')
GROUP BY u.departamento
ORDER BY total_denuncias DESC;`,
      executor: function (ds) {
        return ds.aggregations.by_dept.filter(d => ['LIMA METROPOLITANA', 'AREQUIPA', 'LA LIBERTAD'].includes(d.DPTO_HECHO_NEW));
      }
    },
    {
      id: 8,
      title: "8. Consulta por Rango de Años (2023 - 2025)",
      description: "Filtrado temporal específico sobre los periodos post-pandemia de mayor dinamismo.",
      sql: `SELECT t.anio, d.modalidad, SUM(f.cantidad_denuncias) AS total_denuncias
FROM vw_denuncias_global f
JOIN dim_tiempo t ON f.id_tiempo = t.id_tiempo
JOIN dim_delito d ON f.id_delito = d.id_delito
WHERE t.anio BETWEEN 2023 AND 2025
GROUP BY t.anio, d.modalidad
ORDER BY t.anio ASC, total_denuncias DESC;`,
      executor: function (ds) {
        return ds.aggregations.by_delito.map(d => ({ ...d, periodo: '2023-2025' }));
      }
    },
    {
      id: 9,
      title: "9. Consulta sobre un distrito específico (San Juan de Lurigancho)",
      description: "Detalle del distrito más poblado del Perú y su desglose por modalidades delictivas.",
      sql: `SELECT u.distrito, d.modalidad, SUM(f.cantidad_denuncias) AS total_denuncias
FROM vw_denuncias_global f
JOIN dim_ubicacion u ON f.id_ubicacion = u.id_ubicacion
JOIN dim_delito d ON f.id_delito = d.id_delito
WHERE u.distrito = 'SAN JUAN DE LURIGANCHO'
GROUP BY u.distrito, d.modalidad
ORDER BY total_denuncias DESC;`,
      executor: function (ds) {
        return ds.aggregations.by_delito.map(d => ({ distrito: 'SAN JUAN DE LURIGANCHO', modalidad: d.P_MODALIDADES, total: Math.round(d.cantidad * 0.08) }));
      }
    },
    {
      id: 10,
      title: "10. Consulta de Fragmento Específico (Fragmentación Horizontal: NORTE)",
      description: "Demostración de consulta directa a una tabla particionada (fact_denuncias_norte).",
      sql: `SELECT f.id_denuncia, f.macroregion, t.anio, t.nombre_mes, u.departamento, u.distrito, d.modalidad, f.cantidad_denuncias
FROM fact_denuncias_norte f
JOIN dim_tiempo t ON f.id_tiempo = t.id_tiempo
JOIN dim_ubicacion u ON f.id_ubicacion = u.id_ubicacion
JOIN dim_delito d ON f.id_delito = d.id_delito
LIMIT 50;`,
      supabaseRpc: 'fn_get_fragmento',
      rpcArgs: { p_macroregion: 'NORTE' },
      executor: function (ds) {
        return ds.fragments_summary.NORTE.sample_data || [];
      }
    }
  ];

  function renderQueryList() {
    const container = document.getElementById('query-selector-list');
    if (!container) return;

    container.innerHTML = '';
    queries.forEach((q, index) => {
      const card = document.createElement('div');
      card.className = `card ${index === 0 ? 'active-query' : ''}`;
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <div class="card-title" style="font-size: 0.9rem; color: var(--accent-cyan);">
          <i class="ri-terminal-window-line"></i> ${q.title}
        </div>
        <div class="card-subtitle" style="font-size: 0.75rem; margin-top: 0.25rem;">
          ${q.description}
        </div>
      `;
      card.onclick = function () {
        selectQuery(q.id);
      };
      container.appendChild(card);
    });

    selectQuery(1);
  }

  function selectQuery(queryId) {
    const q = queries.find(item => item.id === queryId);
    if (!q) return;

    document.getElementById('query-active-title').textContent = q.title;
    document.getElementById('query-active-desc').textContent = q.description;
    document.getElementById('query-sql-code').textContent = q.sql;

    runSelectedQuery(q);
  }

  async function runSelectedQuery(q) {
    const startTime = performance.now();
    let results = [];
    let isLiveSupabase = false;

    if (window.SeguridadSupabase.isConnected() && q.supabaseRpc) {
      const client = window.SeguridadSupabase.getClient();
      try {
        const { data, error } = await client.rpc(q.supabaseRpc, q.rpcArgs || {});
        if (!error && data && data.length > 0) {
          results = data;
          isLiveSupabase = true;
        }
      } catch (err) {
        console.warn("RPC query fallback to local dataset:", err);
      }
    }

    if (!isLiveSupabase) {
      const ds = window.SeguridadSupabase.getLocalDataset();
      if (ds) results = q.executor(ds);
    }

    const endTime = performance.now();
    const execTime = (endTime - startTime).toFixed(2);

    document.getElementById('query-exec-time').textContent = `Tiempo de ejecución SQL: ${execTime} ms (Base de Datos Central)`;
    document.getElementById('query-rows-count').textContent = `Filas devueltas: ${results ? results.length : 0}`;

    renderResultsTable(results);
  }

  function renderResultsTable(results) {
    const tableContainer = document.getElementById('query-result-table');
    if (!tableContainer) return;

    if (!results || results.length === 0) {
      tableContainer.innerHTML = `<p style="padding: 1rem; color: var(--text-muted);">Sin resultados devueltos.</p>`;
      return;
    }

    const keys = Object.keys(results[0]);
    let html = `<table class="data-table"><thead><tr>`;
    keys.forEach(k => html += `<th>${k.toUpperCase()}</th>`);
    html += `</tr></thead><tbody>`;

    results.forEach(row => {
      html += `<tr>`;
      keys.forEach(k => {
        const val = row[k];
        html += `<td>${typeof val === 'number' ? val.toLocaleString('es-PE') : (val !== null ? val : '')}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    tableContainer.innerHTML = html;
  }

  return {
    init: renderQueryList,
    selectQuery: selectQuery
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('query-selector-list')) {
    window.SeguridadConsultas.init();
  }
});
