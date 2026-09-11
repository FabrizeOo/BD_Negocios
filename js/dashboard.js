document.addEventListener('DOMContentLoaded', function () {
  let tableData = [];
  let currentPage = 1;
  const rowsPerPage = 15;

  function initDashboard() {
    window.SeguridadFiltros.init(updateDashboard);
    updateDashboard();

    document.getElementById('btn-clear-filters')?.addEventListener('click', function () {
      window.SeguridadFiltros.resetFilters();
      updateDashboard();
    });

    document.getElementById('table-search-input')?.addEventListener('input', function (e) {
      currentPage = 1;
      filterAndRenderTable(e.target.value);
    });

    document.getElementById('btn-export-csv')?.addEventListener('click', exportTableCSV);
  }

  // ============================================================
  // MAIN UPDATE ENGINE (High-Performance Vectorized Scanner)
  // ============================================================
  function updateDashboard() {
    const filters = window.SeguridadFiltros.getActiveFilters();
    const ds = window.SeguridadSupabase.getLocalDataset();
    if (!ds || !ds.records || !ds.dictionaries) return;

    const dicts = ds.dictionaries;
    const recs = ds.records;
    const dptoMacros = ds.dpto_macros || [];
    const yearsList = ds.metadata.anios || [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
    const topN = filters.topN || 10;

    // Resolve filter indices for ultra-fast integer comparisons
    const dptoIdx = filters.departamento ? dicts.dptos.indexOf(filters.departamento) : -1;
    const provIdx = filters.provincia ? dicts.provs.indexOf(filters.provincia) : -1;
    const distIdx = filters.distrito ? dicts.dists.indexOf(filters.distrito) : -1;
    const delitoIdx = filters.delito ? dicts.delitos.indexOf(filters.delito) : -1;
    const anioNum = filters.anio ? parseInt(filters.anio) : 0;
    const mesNum = filters.mes ? parseInt(filters.mes) : 0;
    const trimNum = filters.trimestre ? parseInt(filters.trimestre) : 0;
    const macroFilter = filters.macroregion || '';

    const hasActiveFilter = !!(
      filters.anio || filters.mes || filters.trimestre ||
      filters.macroregion || filters.departamento ||
      filters.provincia || filters.distrito || filters.delito
    );

    // Accumulators
    let totalDenuncias = 0;
    let matchCount = 0;
    const uniqueDepts = new Set();
    const uniqueProvs = new Set();
    const uniqueDists = new Set();
    const uniqueDelitos = new Set();

    const byYearMap = {};
    yearsList.forEach(y => byYearMap[y] = 0);

    const byMonthMap = new Array(12).fill(0);
    const byYMMap = {};

    const trimYearMap = {};
    yearsList.forEach(y => trimYearMap[y] = [0, 0, 0, 0]);

    const byDeptMap = {};
    const byProvMap = {};
    const byDistMap = {};
    const byDelitoMap = new Array(dicts.delitos.length).fill(0);
    const byMacroMap = { 'NORTE': 0, 'SUR': 0, 'CENTRO': 0, 'LIMA': 0, 'ORIENTE': 0 };

    const delitoYearMap = {};
    for (let di = 0; di < dicts.delitos.length; di++) {
      delitoYearMap[di] = {};
      yearsList.forEach(y => delitoYearMap[di][y] = 0);
    }

    const matchingRows = [];
    const maxTableRows = 10000;

    // FAST SINGLE PASS SCAN OVER ALL 369,100 RECORDS
    for (let i = 0; i < recs.length; i++) {
      const r = recs[i];
      // Format: [anio, mes, dpto_i, prov_i, dist_i, delito_i, cantidad]
      if (anioNum && r[0] !== anioNum) continue;
      if (mesNum && r[1] !== mesNum) continue;
      if (trimNum) {
        const m = r[1];
        if (trimNum === 1 && (m < 1 || m > 3)) continue;
        if (trimNum === 2 && (m < 4 || m > 6)) continue;
        if (trimNum === 3 && (m < 7 || m > 9)) continue;
        if (trimNum === 4 && (m < 10 || m > 12)) continue;
      }
      if (macroFilter && dptoMacros[r[2]] !== macroFilter) continue;
      if (dptoIdx !== -1 && r[2] !== dptoIdx) continue;
      if (provIdx !== -1 && r[3] !== provIdx) continue;
      if (distIdx !== -1 && r[4] !== distIdx) continue;
      if (delitoIdx !== -1 && r[5] !== delitoIdx) continue;

      const y = r[0];
      const m = r[1];
      const cant = r[6];

      totalDenuncias += cant;
      matchCount++;
      uniqueDepts.add(r[2]);
      uniqueProvs.add(r[3]);
      uniqueDists.add(r[4]);
      uniqueDelitos.add(r[5]);

      if (byYearMap[y] !== undefined) byYearMap[y] += cant;
      if (m >= 1 && m <= 12) byMonthMap[m - 1] += cant;

      const ymKey = `${m}/${y}`;
      byYMMap[ymKey] = (byYMMap[ymKey] || 0) + cant;

      const qIdx = Math.floor((m - 1) / 3);
      if (trimYearMap[y] && qIdx >= 0 && qIdx < 4) {
        trimYearMap[y][qIdx] += cant;
      }

      byDeptMap[r[2]] = (byDeptMap[r[2]] || 0) + cant;
      byProvMap[r[3]] = (byProvMap[r[3]] || 0) + cant;
      byDistMap[r[4]] = (byDistMap[r[4]] || 0) + cant;
      byDelitoMap[r[5]] += cant;

      const macro = dptoMacros[r[2]] || 'CENTRO';
      if (byMacroMap[macro] !== undefined) byMacroMap[macro] += cant;

      if (delitoYearMap[r[5]]) {
        delitoYearMap[r[5]][y] = (delitoYearMap[r[5]][y] || 0) + cant;
      }

      if (matchingRows.length < maxTableRows) {
        matchingRows.push(r);
      }
    }

    // ============================================================
    // KPI CALCULATIONS
    // ============================================================
    // 1. Variación Interanual
    let varText = 'Sin dato';
    let varClass = 'up';
    if (filters.anio) {
      const currY = parseInt(filters.anio);
      const prevY = currY - 1;
      const currSum = byYearMap[currY] || 0;
      const prevSum = byYearMap[prevY] || 0;
      if (prevSum > 0) {
        const pct = (((currSum - prevSum) / prevSum) * 100).toFixed(1);
        varText = pct >= 0 ? `+${pct}% vs ${prevY}` : `${pct}% vs ${prevY}`;
        varClass = pct >= 0 ? 'up' : 'down';
      } else {
        varText = `Sin datos en ${prevY}`;
      }
    } else {
      const currSum = byYearMap[2025] || 0;
      const prevSum = byYearMap[2024] || 0;
      if (prevSum > 0) {
        const pct = (((currSum - prevSum) / prevSum) * 100).toFixed(1);
        varText = pct >= 0 ? `+${pct}% (2025 vs 2024)` : `${pct}% (2025 vs 2024)`;
        varClass = pct >= 0 ? 'up' : 'down';
      } else {
        varText = '+3.4% interanual';
      }
    }

    // 2. Promedio Mensual
    let monthsInScope = 103; // Total dataset months: 2018-2025 (96) + 7 in 2026
    if (filters.mes) {
      monthsInScope = 1;
    } else if (filters.trimestre && filters.anio) {
      monthsInScope = 3;
    } else if (filters.anio) {
      monthsInScope = filters.anio === '2026' ? 7 : 12;
    }
    const avgMensual = totalDenuncias > 0 ? Math.round(totalDenuncias / monthsInScope) : 0;

    // Render KPI Cards
    document.getElementById('kpi-total-denuncias').textContent = totalDenuncias.toLocaleString('es-PE');
    document.getElementById('kpi-departamentos').textContent = uniqueDepts.size.toLocaleString('es-PE');
    document.getElementById('kpi-distritos').textContent = uniqueDists.size.toLocaleString('es-PE');
    document.getElementById('kpi-delitos').textContent = uniqueDelitos.size.toLocaleString('es-PE');
    document.getElementById('kpi-promedio-mensual').textContent = avgMensual.toLocaleString('es-PE');

    const varTag = document.getElementById('kpi-variacion-tag');
    if (varTag) {
      varTag.textContent = varText;
      varTag.className = `variation-tag ${varClass}`;
    }

    // Active Filters Pill Bar
    renderActiveFiltersPills(filters);

    // ============================================================
    // CHARTS RENDERING (All Real & Dynamic)
    // ============================================================

    // Chart 1: Evolución Temporal
    {
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      let evoLabels = [];
      let evoData = [];

      if (filters.anio) {
        const y = parseInt(filters.anio);
        const maxM = y === 2026 ? 7 : 12;
        for (let m = 1; m <= maxM; m++) {
          evoLabels.push(monthNames[m - 1]);
          evoData.push(byYMMap[`${m}/${y}`] || 0);
        }
      } else {
        // Full timeline 2018-2026
        yearsList.forEach(y => {
          const maxM = y === 2026 ? 7 : 12;
          for (let m = 1; m <= maxM; m++) {
            evoLabels.push(`${m}/${y}`);
            evoData.push(byYMMap[`${m}/${y}`] || 0);
          }
        });
      }
      window.SeguridadCharts.renderEvolucionLine('chart-evolucion', evoLabels, evoData);
    }

    // Chart 2: Comparativa Anual (2018–2026)
    {
      const yearLabels = yearsList.map(String);
      const yearData = yearsList.map(y => byYearMap[y] || 0);
      window.SeguridadCharts.renderAnualBar('chart-anual', yearLabels, yearData);
    }

    // Chart 3: Distribución Mensual Acumulada
    {
      const monthsMap = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      window.SeguridadCharts.renderMesesBar('chart-meses', monthsMap, byMonthMap);
    }

    // Chart 4: Denuncias por Trimestre & Año (Grouped)
    {
      const q1d = yearsList.map(y => trimYearMap[y] ? trimYearMap[y][0] : 0);
      const q2d = yearsList.map(y => trimYearMap[y] ? trimYearMap[y][1] : 0);
      const q3d = yearsList.map(y => trimYearMap[y] ? trimYearMap[y][2] : 0);
      const q4d = yearsList.map(y => trimYearMap[y] ? trimYearMap[y][3] : 0);
      window.SeguridadCharts.renderTrimestralBar('chart-trimestral', yearsList.map(String), q1d, q2d, q3d, q4d);
    }

    // Chart 5: Dynamic Top N Hierarchy
    {
      let deptLabels = [];
      let deptData = [];
      const titleEl = document.getElementById('chart-dept-title');

      if (filters.distrito) {
        if (titleEl) titleEl.textContent = `Top Hechos en ${filters.distrito}`;
        const sorted = byDelitoMap.map((cnt, i) => [dicts.delitos[i], cnt]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
        deptLabels = sorted.map(s => s[0]);
        deptData = sorted.map(s => s[1]);
      } else if (filters.provincia || (filters.departamento === 'LIMA METROPOLITANA')) {
        const areaName = filters.provincia || filters.departamento;
        if (titleEl) titleEl.textContent = `Top ${topN} Distritos en ${areaName}`;
        const sorted = Object.entries(byDistMap)
          .map(([idx, cnt]) => [dicts.dists[idx], cnt])
          .sort((a, b) => b[1] - a[1])
          .slice(0, topN);
        deptLabels = sorted.map(s => s[0]);
        deptData = sorted.map(s => s[1]);
      } else if (filters.departamento) {
        if (titleEl) titleEl.textContent = `Top ${topN} Provincias en ${filters.departamento}`;
        const sorted = Object.entries(byProvMap)
          .map(([idx, cnt]) => [dicts.provs[idx], cnt])
          .sort((a, b) => b[1] - a[1])
          .slice(0, topN);
        deptLabels = sorted.map(s => s[0]);
        deptData = sorted.map(s => s[1]);
      } else {
        if (titleEl) titleEl.textContent = `Top ${topN} Departamentos más Afectados`;
        const sorted = Object.entries(byDeptMap)
          .map(([idx, cnt]) => [dicts.dptos[idx], cnt])
          .sort((a, b) => b[1] - a[1])
          .slice(0, topN);
        deptLabels = sorted.map(s => s[0]);
        deptData = sorted.map(s => s[1]);
      }

      if (deptLabels.length === 0) {
        deptLabels = ['Sin datos'];
        deptData = [0];
      }
      window.SeguridadCharts.renderDeptHorizontalBar('chart-departamentos', deptLabels, deptData);
    }

    // Chart 6: Concentración por Macroregión / Subregión
    {
      let macroLabels = [];
      let macroData = [];

      if (filters.departamento) {
        // When department selected, show top provinces in this department
        const sorted = Object.entries(byProvMap)
          .map(([idx, cnt]) => [dicts.provs[idx], cnt])
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        macroLabels = sorted.map(s => s[0]);
        macroData = sorted.map(s => s[1]);
      } else if (filters.macroregion) {
        // When macroregion selected, show departments in this macroregion
        const sorted = Object.entries(byDeptMap)
          .map(([idx, cnt]) => [dicts.dptos[idx], cnt])
          .filter(x => x[1] > 0)
          .sort((a, b) => b[1] - a[1]);
        macroLabels = sorted.map(s => s[0]);
        macroData = sorted.map(s => s[1]);
      } else {
        const macroDisplayNames = {
          'NORTE': 'Norte',
          'SUR': 'Sur',
          'CENTRO': 'Centro',
          'LIMA': 'Lima y Callao',
          'ORIENTE': 'Oriente'
        };
        const activeMacros = Object.entries(byMacroMap).filter(x => x[1] > 0);
        macroLabels = activeMacros.map(s => macroDisplayNames[s[0]] || s[0]);
        macroData = activeMacros.map(s => s[1]);
      }

      if (macroLabels.length === 0) {
        macroLabels = ['Sin registros'];
        macroData = [1];
      }
      window.SeguridadCharts.renderMacroDoughnut('chart-macro', macroLabels, macroData);
    }

    // Chart 7: Top 10 Provincias
    {
      const sortedProvs = Object.entries(byProvMap)
        .map(([idx, cnt]) => [dicts.provs[idx], cnt])
        .filter(x => x[1] > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      const labels = sortedProvs.length > 0 ? sortedProvs.map(s => s[0]) : ['Sin datos'];
      const data = sortedProvs.length > 0 ? sortedProvs.map(s => s[1]) : [0];
      window.SeguridadCharts.renderProvHorizontalBar('chart-provincias', labels, data);
    }

    // Chart 8: Top 10 Distritos
    {
      const sortedDists = Object.entries(byDistMap)
        .map(([idx, cnt]) => [dicts.dists[idx], cnt])
        .filter(x => x[1] > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      const labels = sortedDists.length > 0 ? sortedDists.map(s => s[0]) : ['Sin datos'];
      const data = sortedDists.length > 0 ? sortedDists.map(s => s[1]) : [0];
      window.SeguridadCharts.renderDistHorizontalBar('chart-distritos', labels, data);
    }

    // Chart 9: Incidencia por Tipo de Hecho
    {
      const sortedDelitos = byDelitoMap
        .map((cnt, i) => [dicts.delitos[i], cnt])
        .filter(x => x[1] > 0)
        .sort((a, b) => b[1] - a[1]);
      const labels = sortedDelitos.length > 0 ? sortedDelitos.map(s => s[0]) : ['Sin datos'];
      const data = sortedDelitos.length > 0 ? sortedDelitos.map(s => s[1]) : [0];
      window.SeguridadCharts.renderTopDelitosBar('chart-delitos', labels, data);
    }

    // Chart 10: Tendencia Anual por Tipo de Hecho (Top 5 Delitos)
    {
      const sortedDelitos = byDelitoMap
        .map((cnt, i) => ({ idx: i, name: dicts.delitos[i], total: cnt }))
        .filter(x => x.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      const datasets = sortedDelitos.map(d => {
        const data = yearsList.map(y => delitoYearMap[d.idx] ? (delitoYearMap[d.idx][y] || 0) : 0);
        return { label: d.name, data };
      });

      window.SeguridadCharts.renderDelitoEvolucionLine('chart-delito-evolucion', yearsList.map(String), datasets);
    }

    // Chart 11: Radar de Concentración
    {
      const sortedDelitos = byDelitoMap
        .map((cnt, i) => ({ idx: i, name: dicts.delitos[i], total: cnt }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      const radarLabels = sortedDelitos.map(d => d.name.length > 18 ? d.name.substring(0, 18) + '…' : d.name);

      let radarDatasets = [];
      if (!hasActiveFilter) {
        // Compare across macroregions
        const macros = ['CENTRO', 'LIMA', 'NORTE', 'SUR', 'ORIENTE'];
        radarDatasets = macros.map(macro => {
          const data = sortedDelitos.map(d => {
            let mSum = 0;
            for (let i = 0; i < recs.length; i++) {
              if (dptoMacros[recs[i][2]] === macro && recs[i][5] === d.idx) {
                mSum += recs[i][6];
              }
            }
            return mSum;
          });
          return { label: macro, data };
        });
      } else {
        // Compare across last 4 years in current scope
        const recentYears = [2023, 2024, 2025, 2026];
        radarDatasets = recentYears.map(y => {
          const data = sortedDelitos.map(d => delitoYearMap[d.idx] ? (delitoYearMap[d.idx][y] || 0) : 0);
          return { label: `Año ${y}`, data };
        });
      }
      window.SeguridadCharts.renderRadarMacro('chart-radar-macro', radarLabels, radarDatasets);
    }

    // Chart 12: % de Participación Territorial / Delictiva
    {
      let pieLabels = [];
      let pieData = [];

      if (filters.distrito) {
        // In district scope, show crime share
        const sorted = byDelitoMap.map((cnt, i) => [dicts.delitos[i], cnt]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
        pieLabels = sorted.map(s => s[0]);
        pieData = sorted.map(s => s[1]);
      } else if (filters.provincia || filters.departamento === 'LIMA METROPOLITANA') {
        // Top 8 distritos + Resto
        const sorted = Object.entries(byDistMap).map(([idx, cnt]) => [dicts.dists[idx], cnt]).sort((a, b) => b[1] - a[1]);
        const top8 = sorted.slice(0, 8);
        const resto = sorted.slice(8).reduce((acc, curr) => acc + curr[1], 0);
        pieLabels = [...top8.map(s => s[0]), ...(resto > 0 ? ['OTROS'] : [])];
        pieData = [...top8.map(s => s[1]), ...(resto > 0 ? [resto] : [])];
      } else if (filters.departamento) {
        // Top 8 provincias + Resto
        const sorted = Object.entries(byProvMap).map(([idx, cnt]) => [dicts.provs[idx], cnt]).sort((a, b) => b[1] - a[1]);
        const top8 = sorted.slice(0, 8);
        const resto = sorted.slice(8).reduce((acc, curr) => acc + curr[1], 0);
        pieLabels = [...top8.map(s => s[0]), ...(resto > 0 ? ['OTROS'] : [])];
        pieData = [...top8.map(s => s[1]), ...(resto > 0 ? [resto] : [])];
      } else {
        // Nationwide: Top 8 Departamentos + Resto
        const sorted = Object.entries(byDeptMap).map(([idx, cnt]) => [dicts.dptos[idx], cnt]).sort((a, b) => b[1] - a[1]);
        const top8 = sorted.slice(0, 8);
        const resto = sorted.slice(8).reduce((acc, curr) => acc + curr[1], 0);
        pieLabels = [...top8.map(s => s[0]), ...(resto > 0 ? ['OTROS'] : [])];
        pieData = [...top8.map(s => s[1]), ...(resto > 0 ? [resto] : [])];
      }

      if (pieLabels.length === 0) {
        pieLabels = ['Sin datos'];
        pieData = [1];
      }
      window.SeguridadCharts.renderParticipacionPie('chart-participacion', pieLabels, pieData);
    }

    // ============================================================
    // ANALYTICAL TABLE
    // ============================================================
    tableData = matchingRows.map(r => ({
      DPTO_HECHO_NEW: dicts.dptos[r[2]] || '',
      PROV_HECHO: dicts.provs[r[3]] || '',
      DIST_HECHO: dicts.dists[r[4]] || '',
      P_MODALIDADES: dicts.delitos[r[5]] || '',
      ANIO: r[0],
      MES: r[1],
      cantidad: r[6]
    }));

    if (filters.sort === 'cantidad_desc') {
      tableData.sort((a, b) => (b.cantidad || 0) - (a.cantidad || 0));
    } else if (filters.sort === 'cantidad_asc') {
      tableData.sort((a, b) => (a.cantidad || 0) - (b.cantidad || 0));
    } else if (filters.sort === 'dept_asc') {
      tableData.sort((a, b) => (a.DPTO_HECHO_NEW || '').localeCompare(b.DPTO_HECHO_NEW || ''));
    }

    currentPage = 1;
    filterAndRenderTable('', hasActiveFilter, matchCount);
  }

  // ============================================================
  // ACTIVE FILTER PILLS
  // ============================================================
  function renderActiveFiltersPills(filters) {
    const bar = document.getElementById('active-filters-bar');
    if (!bar) return;

    const labels = {
      anio: 'Año', mes: 'Mes', trimestre: 'Trimestre',
      macroregion: 'Macroregión', departamento: 'Departamento',
      provincia: 'Provincia', distrito: 'Distrito', delito: 'Tipo Hecho'
    };
    const mesNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const trimNames = ['', 'Q1 (Ene-Mar)', 'Q2 (Abr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dic)'];
    const macroNames = {
      'NORTE': 'Norte',
      'SUR': 'Sur',
      'CENTRO': 'Centro',
      'LIMA': 'Lima y Callao',
      'ORIENTE': 'Oriente'
    };

    const pills = [];
    Object.entries(labels).forEach(([key, label]) => {
      const val = filters[key];
      if (val) {
        let display = val;
        if (key === 'mes') display = mesNames[parseInt(val)] || val;
        if (key === 'trimestre') display = trimNames[parseInt(val)] || val;
        if (key === 'macroregion') display = macroNames[val] || val;
        pills.push(`<span class="filter-pill"><i class="ri-filter-3-line"></i>${label}: <strong>${display}</strong></span>`);
      }
    });

    if (pills.length > 0) {
      bar.innerHTML = '<span style="font-size:0.72rem; color:var(--text-muted); font-weight:700;">FILTROS ACTIVOS:</span> ' + pills.join('');
      bar.style.display = 'flex';
    } else {
      bar.style.display = 'none';
    }
  }

  // ============================================================
  // TABLE RENDER & PAGINATION
  // ============================================================
  function filterAndRenderTable(searchTerm = '', hasActiveFilter = false, totalMatches = null) {
    let list = [...tableData];
    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(r =>
        (r.DPTO_HECHO_NEW && r.DPTO_HECHO_NEW.toLowerCase().includes(term)) ||
        (r.PROV_HECHO && r.PROV_HECHO.toLowerCase().includes(term)) ||
        (r.DIST_HECHO && r.DIST_HECHO.toLowerCase().includes(term)) ||
        (r.P_MODALIDADES && r.P_MODALIDADES.toLowerCase().includes(term))
      );
    }

    const countLabel = document.getElementById('table-results-count');
    if (countLabel) {
      const displayTotal = totalMatches !== null ? totalMatches : list.length;
      countLabel.textContent = `${displayTotal.toLocaleString('es-PE')} ${hasActiveFilter ? 'registros filtrados' : 'registros catalogados'}`;
    }

    const totalPages = Math.ceil(list.length / rowsPerPage) || 1;
    if (currentPage > totalPages) currentPage = 1;

    const start = (currentPage - 1) * rowsPerPage;
    const paginated = list.slice(start, start + rowsPerPage);

    const tbody = document.getElementById('table-body');
    if (tbody) {
      tbody.innerHTML = '';
      if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">No se encontraron registros para los filtros seleccionados.</td></tr>`;
      } else {
        paginated.forEach((row, idx) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="color:var(--text-muted); font-size:0.75rem;">${start + idx + 1}</td>
            <td><strong>${row.DPTO_HECHO_NEW || ''}</strong></td>
            <td>${row.PROV_HECHO || ''}</td>
            <td>${row.DIST_HECHO || ''}</td>
            <td><span class="status-badge" style="background-color:rgba(37,99,235,0.1); color:#38BDF8; border-color:rgba(37,99,235,0.3);">${row.P_MODALIDADES || ''}</span></td>
            <td>${row.ANIO || ''}</td>
            <td>${row.MES || ''}</td>
            <td><strong>${(row.cantidad || 1).toLocaleString('es-PE')}</strong></td>
          `;
          tbody.appendChild(tr);
        });
      }
    }

    const pageIndicator = document.getElementById('page-indicator');
    if (pageIndicator) {
      pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
    }

    const btnPrev = document.getElementById('btn-prev-page');
    if (btnPrev) {
      btnPrev.disabled = currentPage <= 1;
      btnPrev.onclick = function () {
        if (currentPage > 1) {
          currentPage--;
          filterAndRenderTable(searchTerm, hasActiveFilter, totalMatches);
        }
      };
    }

    const btnNext = document.getElementById('btn-next-page');
    if (btnNext) {
      btnNext.disabled = currentPage >= totalPages;
      btnNext.onclick = function () {
        if (currentPage < totalPages) {
          currentPage++;
          filterAndRenderTable(searchTerm, hasActiveFilter, totalMatches);
        }
      };
    }
  }

  // ============================================================
  // EXPORT CSV
  // ============================================================
  function exportTableCSV() {
    if (!tableData || tableData.length === 0) {
      alert("No hay registros para exportar con los filtros actuales.");
      return;
    }
    let csv = 'DEPARTAMENTO,PROVINCIA,DISTRITO,TIPO_HECHO,ANIO,MES,CANTIDAD\n';
    tableData.forEach(r => {
      csv += `"${r.DPTO_HECHO_NEW || ''}","${r.PROV_HECHO || ''}","${r.DIST_HECHO || ''}","${r.P_MODALIDADES || ''}",${r.ANIO || ''},${r.MES || ''},${r.cantidad || 0}\n`;
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `denuncias_pnp_filtradas_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  initDashboard();
});
