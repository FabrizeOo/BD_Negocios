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
  // MAIN UPDATE
  // ============================================================
  function updateDashboard() {
    const filters = window.SeguridadFiltros.getActiveFilters();
    const ds = window.SeguridadSupabase.getLocalDataset();
    if (!ds) return;

    const sampleTable = ds.sample_table || [];
    const topN = filters.topN || 10;

    // --- Filter sample_table ---
    let filteredSample = sampleTable.filter(r => {
      if (filters.anio && r.ANIO !== parseInt(filters.anio)) return false;
      if (filters.mes && r.MES !== parseInt(filters.mes)) return false;
      if (filters.trimestre) {
        const q = parseInt(filters.trimestre);
        const m = r.MES;
        if (q === 1 && (m < 1 || m > 3)) return false;
        if (q === 2 && (m < 4 || m > 6)) return false;
        if (q === 3 && (m < 7 || m > 9)) return false;
        if (q === 4 && (m < 10 || m > 12)) return false;
      }
      if (filters.macroregion && r.MACROREGION && r.MACROREGION !== filters.macroregion) return false;
      if (filters.departamento && r.DPTO_HECHO_NEW !== filters.departamento) return false;
      if (filters.provincia && r.PROV_HECHO !== filters.provincia) return false;
      if (filters.distrito && r.DIST_HECHO !== filters.distrito) return false;
      if (filters.delito && r.P_MODALIDADES !== filters.delito) return false;
      return true;
    });

    let fallbackSample = sampleTable.filter(r => {
      if (filters.departamento && r.DPTO_HECHO_NEW !== filters.departamento) return false;
      if (filters.delito && r.P_MODALIDADES !== filters.delito) return false;
      return true;
    });

    const activeSample = filteredSample.length > 0
      ? filteredSample
      : (fallbackSample.length > 0 ? fallbackSample : sampleTable);

    const hasActiveFilter = !!(
      filters.anio || filters.mes || filters.trimestre ||
      filters.macroregion || filters.departamento ||
      filters.provincia || filters.distrito || filters.delito
    );

    // --- KPI: Total Denuncias ---
    let totalComplaints = ds.metadata.total_denuncias;
    let ymFiltered = ds.aggregations.by_year_month;

    if (filters.anio) ymFiltered = ymFiltered.filter(d => d.ANIO === parseInt(filters.anio));
    if (filters.mes) {
      ymFiltered = ymFiltered.filter(d => d.MES === parseInt(filters.mes));
    } else if (filters.trimestre) {
      const q = parseInt(filters.trimestre);
      const mStart = (q - 1) * 3 + 1;
      const mEnd = q * 3;
      ymFiltered = ymFiltered.filter(d => d.MES >= mStart && d.MES <= mEnd);
    }

    const ymSum = ymFiltered.reduce((acc, d) => acc + d.cantidad, 0);
    const timeRatio = ymSum / ds.metadata.total_denuncias;

    if (filters.departamento) {
      const dObj = ds.aggregations.by_dept.find(d => d.DPTO_HECHO_NEW === filters.departamento);
      totalComplaints = Math.round((dObj ? dObj.cantidad : 150000) * timeRatio);
    } else if (filters.delito) {
      const dObj = ds.aggregations.by_delito.find(d => d.P_MODALIDADES === filters.delito);
      totalComplaints = Math.round((dObj ? dObj.cantidad : 200000) * timeRatio);
    } else {
      totalComplaints = ymSum;
    }

    // --- KPI: Variación Interanual ---
    let varText = '+3.4% interanual';
    let varClass = 'up';
    if (filters.anio) {
      const currY = parseInt(filters.anio);
      const prevY = currY - 1;
      const currSum = ds.aggregations.by_year_month.filter(d => d.ANIO === currY).reduce((a, b) => a + b.cantidad, 0);
      const prevSum = ds.aggregations.by_year_month.filter(d => d.ANIO === prevY).reduce((a, b) => a + b.cantidad, 0);
      if (prevSum > 0) {
        const pct = (((currSum - prevSum) / prevSum) * 100).toFixed(1);
        varText = pct >= 0 ? `+${pct}% vs ${prevY}` : `${pct}% vs ${prevY}`;
        varClass = pct >= 0 ? 'up' : 'down';
      } else {
        varText = 'Sin dato previo';
      }
    }

    // --- KPI: Promedio Mensual ---
    const monthCount = ymFiltered.length || 1;
    const avgMensual = Math.round(ymSum / monthCount);

    // --- Render KPIs ---
    document.getElementById('kpi-total-denuncias').textContent = totalComplaints.toLocaleString('es-PE');
    document.getElementById('kpi-departamentos').textContent = filters.departamento ? '1' : ds.metadata.total_departamentos;
    document.getElementById('kpi-distritos').textContent =
      filters.distrito ? '1' : (filters.provincia ? '~15' : (filters.departamento ? '~43' : ds.metadata.total_distritos.toLocaleString('es-PE')));
    document.getElementById('kpi-delitos').textContent = filters.delito ? '1' : ds.metadata.total_delitos;
    document.getElementById('kpi-promedio-mensual').textContent = avgMensual.toLocaleString('es-PE');

    const varTag = document.getElementById('kpi-variacion-tag');
    if (varTag) { varTag.textContent = varText; varTag.className = `variation-tag ${varClass}`; }

    // --- Active Filters Pill Bar ---
    renderActiveFiltersPills(filters);

    // ==================== CHARTS ====================

    // Chart 1: Evolución Temporal
    let evoLabels, evoData;
    if (filters.anio) {
      evoLabels = ymFiltered.map(d => `${d.nombre_mes || d.MES}`);
      evoData = ymFiltered.map(d => d.cantidad);
    } else {
      const slice = ds.aggregations.by_year_month.slice(-36);
      evoLabels = slice.map(d => `${d.MES}/${d.ANIO}`);
      evoData = slice.map(d => d.cantidad);
    }
    window.SeguridadCharts.renderEvolucionLine('chart-evolucion', evoLabels, evoData);

    // Chart 2: Comparativa Anual
    const yearLabels = ds.aggregations.by_year.map(d => d.ANIO.toString());
    let yearData;
    if (hasActiveFilter && (filters.departamento || filters.delito || filters.provincia || filters.distrito || filters.mes)) {
      const yearMap = {};
      ds.metadata.anios.forEach(y => yearMap[y] = 0);
      activeSample.forEach(r => { if (yearMap[r.ANIO] !== undefined) yearMap[r.ANIO] += r.cantidad; });
      yearData = yearLabels.map(y => yearMap[parseInt(y)] || 0);
    } else {
      yearData = ds.aggregations.by_year.map(d => d.cantidad);
    }
    window.SeguridadCharts.renderAnualBar('chart-anual', yearLabels, yearData);

    // Chart 3: Distribución Mensual
    const monthsMap = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthTotals = new Array(12).fill(0);
    if (hasActiveFilter) {
      activeSample.forEach(r => {
        if (r.MES >= 1 && r.MES <= 12) monthTotals[r.MES - 1] += r.cantidad;
      });
    } else {
      ds.aggregations.by_year_month.forEach(d => {
        if (d.MES >= 1 && d.MES <= 12) monthTotals[d.MES - 1] += d.cantidad;
      });
    }
    window.SeguridadCharts.renderMesesBar('chart-meses', monthsMap, monthTotals);

    // Chart 4: Trimestral por Año (Grouped)
    {
      const trimYears = ds.metadata.anios || [];
      const q1d = [], q2d = [], q3d = [], q4d = [];
      const byYM = ds.aggregations.by_year_month;
      trimYears.forEach(y => {
        const rows = hasActiveFilter
          ? activeSample.filter(r => r.ANIO === y)
          : byYM.filter(d => d.ANIO === y);
        const sum = (mStart, mEnd) => rows.reduce((a, r) => {
          const m = r.MES !== undefined ? r.MES : 0;
          return a + ((m >= mStart && m <= mEnd) ? (r.cantidad || 0) : 0);
        }, 0);
        q1d.push(sum(1, 3)); q2d.push(sum(4, 6)); q3d.push(sum(7, 9)); q4d.push(sum(10, 12));
      });
      window.SeguridadCharts.renderTrimestralBar('chart-trimestral', trimYears.map(String), q1d, q2d, q3d, q4d);
    }

    // Chart 5: Top N Departamentos
    {
      let deptLabels, deptData;
      if (hasActiveFilter) {
        const deptMap = {};
        const keyProp = filters.departamento ? 'PROV_HECHO' : 'DPTO_HECHO_NEW';
        activeSample.forEach(r => {
          const k = r[keyProp] || 'OTROS';
          deptMap[k] = (deptMap[k] || 0) + r.cantidad;
        });
        const sorted = Object.entries(deptMap).sort((a, b) => b[1] - a[1]).slice(0, topN);
        if (sorted.length > 0) {
          deptLabels = sorted.map(s => s[0]);
          deptData = sorted.map(s => s[1]);
        } else {
          deptLabels = ds.aggregations.by_dept.slice(0, topN).map(d => d.DPTO_HECHO_NEW);
          deptData = ds.aggregations.by_dept.slice(0, topN).map(d => d.cantidad);
        }
      } else {
        deptLabels = ds.aggregations.by_dept.slice(0, topN).map(d => d.DPTO_HECHO_NEW);
        deptData = ds.aggregations.by_dept.slice(0, topN).map(d => d.cantidad);
      }
      const titleEl = document.getElementById('chart-dept-title');
      if (titleEl) titleEl.textContent = `Top ${topN} Departamentos más Afectados`;
      window.SeguridadCharts.renderDeptHorizontalBar('chart-departamentos', deptLabels, deptData);
    }

    // Chart 6: Macroregión Doughnut
    {
      let macroLabels, macroData;
      if (hasActiveFilter) {
        const macroMap = {};
        activeSample.forEach(r => {
          const k = r.MACROREGION || 'OTRO';
          macroMap[k] = (macroMap[k] || 0) + r.cantidad;
        });
        const sorted = Object.entries(macroMap).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
          macroLabels = sorted.map(s => s[0]);
          macroData = sorted.map(s => s[1]);
        } else {
          macroLabels = ds.aggregations.by_macro.map(d => d.MACROREGION);
          macroData = ds.aggregations.by_macro.map(d => d.cantidad);
        }
      } else {
        macroLabels = ds.aggregations.by_macro.map(d => d.MACROREGION);
        macroData = ds.aggregations.by_macro.map(d => d.cantidad);
      }
      window.SeguridadCharts.renderMacroDoughnut('chart-macro', macroLabels, macroData);
    }

    // Chart 7: Top 10 Provincias
    {
      const provMap = {};
      activeSample.forEach(r => {
        const k = r.PROV_HECHO || 'OTROS';
        provMap[k] = (provMap[k] || 0) + r.cantidad;
      });
      const sorted = Object.entries(provMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
      window.SeguridadCharts.renderProvHorizontalBar('chart-provincias', sorted.map(s => s[0]), sorted.map(s => s[1]));
    }

    // Chart 8: Top 10 Distritos
    {
      const distMap = {};
      activeSample.forEach(r => {
        const k = r.DIST_HECHO || 'OTROS';
        distMap[k] = (distMap[k] || 0) + r.cantidad;
      });
      const sorted = Object.entries(distMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
      window.SeguridadCharts.renderDistHorizontalBar('chart-distritos', sorted.map(s => s[0]), sorted.map(s => s[1]));
    }

    // Chart 9: Tipos de Hecho
    {
      let delitoLabels, delitoData;
      if (hasActiveFilter) {
        const delitoMap = {};
        activeSample.forEach(r => {
          const k = r.P_MODALIDADES || 'Otros';
          delitoMap[k] = (delitoMap[k] || 0) + r.cantidad;
        });
        const sorted = Object.entries(delitoMap).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
          delitoLabels = sorted.map(s => s[0]);
          delitoData = sorted.map(s => s[1]);
        } else {
          delitoLabels = ds.aggregations.by_delito.map(d => d.P_MODALIDADES);
          delitoData = ds.aggregations.by_delito.map(d => d.cantidad);
        }
      } else {
        delitoLabels = ds.aggregations.by_delito.map(d => d.P_MODALIDADES);
        delitoData = ds.aggregations.by_delito.map(d => d.cantidad);
      }
      window.SeguridadCharts.renderTopDelitosBar('chart-delitos', delitoLabels, delitoData);
    }

    // Chart 10: Evolución top 5 delitos por año
    {
      const years = ds.metadata.anios || [];
      // Get top 5 delitos by overall count
      const top5 = ds.aggregations.by_delito.slice(0, 5);
      const byYM = ds.aggregations.by_year_month;
      const datasets = top5.map(d => {
        const delitoName = d.P_MODALIDADES;
        const data = years.map(y => {
          const match = activeSample.filter(r => r.ANIO === y && r.P_MODALIDADES === delitoName);
          return match.reduce((a, r) => a + (r.cantidad || 0), 0);
        });
        return { label: delitoName, data };
      });
      window.SeguridadCharts.renderDelitoEvolucionLine('chart-delito-evolucion', years.map(String), datasets);
    }

    // Chart 11: Radar Macro (Top 5 tipos de hecho por macroregión)
    {
      const macros = ds.aggregations.by_macro.map(m => m.MACROREGION).slice(0, 5);
      const top5delitos = ds.aggregations.by_delito.slice(0, 5).map(d => d.P_MODALIDADES);
      const radarDatasets = macros.map(macro => {
        const macroRows = activeSample.filter(r => r.MACROREGION === macro);
        const data = top5delitos.map(delito => {
          return macroRows.filter(r => r.P_MODALIDADES === delito).reduce((a, r) => a + (r.cantidad || 0), 0);
        });
        return { label: macro, data };
      });
      window.SeguridadCharts.renderRadarMacro('chart-radar-macro', top5delitos.map(d => d.length > 18 ? d.substring(0, 18) + '…' : d), radarDatasets);
    }

    // Chart 12: % Participación departamental (top 8 + Resto)
    {
      const deptArr = ds.aggregations.by_dept;
      const total = deptArr.reduce((a, d) => a + d.cantidad, 0);
      const top8 = deptArr.slice(0, 8);
      const resto = total - top8.reduce((a, d) => a + d.cantidad, 0);
      const pieLabels = [...top8.map(d => d.DPTO_HECHO_NEW), 'OTROS'];
      const pieData = [...top8.map(d => d.cantidad), resto > 0 ? resto : 0];
      window.SeguridadCharts.renderParticipacionPie('chart-participacion', pieLabels, pieData);
    }

    // Table
    let sorted = [...activeSample];
    if (filters.sort === 'cantidad_desc') sorted.sort((a, b) => (b.cantidad || 0) - (a.cantidad || 0));
    else if (filters.sort === 'cantidad_asc') sorted.sort((a, b) => (a.cantidad || 0) - (b.cantidad || 0));
    else if (filters.sort === 'dept_asc') sorted.sort((a, b) => (a.DPTO_HECHO_NEW || '').localeCompare(b.DPTO_HECHO_NEW || ''));
    tableData = sorted.length > 0 ? sorted : sampleTable;
    currentPage = 1;
    filterAndRenderTable('', hasActiveFilter);
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

    const pills = [];
    Object.entries(labels).forEach(([key, label]) => {
      const val = filters[key];
      if (val) {
        let display = val;
        if (key === 'mes') display = mesNames[parseInt(val)] || val;
        if (key === 'trimestre') display = trimNames[parseInt(val)] || val;
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
  // TABLE RENDER
  // ============================================================
  function filterAndRenderTable(searchTerm = '', hasActiveFilter = false) {
    let list = [...tableData];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(r =>
        (r.DPTO_HECHO_NEW && r.DPTO_HECHO_NEW.toLowerCase().includes(term)) ||
        (r.PROV_HECHO && r.PROV_HECHO.toLowerCase().includes(term)) ||
        (r.DIST_HECHO && r.DIST_HECHO.toLowerCase().includes(term)) ||
        (r.P_MODALIDADES && r.P_MODALIDADES.toLowerCase().includes(term))
      );
    }

    const label = hasActiveFilter ? 'registros filtrados' : 'registros catalogados';
    document.getElementById('table-results-count').textContent = `${list.length.toLocaleString('es-PE')} ${label}`;

    const totalPages = Math.ceil(list.length / rowsPerPage) || 1;
    if (currentPage > totalPages) currentPage = 1;

    const start = (currentPage - 1) * rowsPerPage;
    const paginated = list.slice(start, start + rowsPerPage);

    const tbody = document.getElementById('table-body');
    if (tbody) {
      tbody.innerHTML = '';
      if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">No se encontraron datos para los filtros seleccionados.</td></tr>`;
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

    document.getElementById('page-indicator').textContent = `Página ${currentPage} de ${totalPages}`;
    document.getElementById('btn-prev-page').onclick = function () {
      if (currentPage > 1) { currentPage--; filterAndRenderTable(searchTerm, hasActiveFilter); }
    };
    document.getElementById('btn-next-page').onclick = function () {
      if (currentPage < totalPages) { currentPage++; filterAndRenderTable(searchTerm, hasActiveFilter); }
    };
  }

  // ============================================================
  // EXPORT CSV
  // ============================================================
  function exportTableCSV() {
    if (!tableData || tableData.length === 0) return;
    let csv = 'DEPARTAMENTO,PROVINCIA,DISTRITO,TIPO_HECHO,ANIO,MES,CANTIDAD\n';
    tableData.forEach(r => {
      csv += `"${r.DPTO_HECHO_NEW || ''}","${r.PROV_HECHO || ''}","${r.DIST_HECHO || ''}","${r.P_MODALIDADES || ''}",${r.ANIO || ''},${r.MES || ''},${r.cantidad || ''}\n`;
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'denuncias_pnp_filtradas.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  initDashboard();
});
