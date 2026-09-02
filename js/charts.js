/* ============================================================================
   PROYECTO: SEGURIDAD PERÚ
   Módulo de Gráficos Estadísticos (Chart.js) - charts.js
   Visualizaciones interactivas de alto nivel para el Dashboard
   ============================================================================ */

window.SeguridadCharts = (function () {
  let chartInstances = {};

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#94A3B8', font: { family: 'Inter', size: 11 } }
      },
      tooltip: {
        backgroundColor: '#0F172A',
        borderColor: '#26334D',
        borderWidth: 1,
        titleColor: '#F1F5F9',
        bodyColor: '#38BDF8',
        padding: 10,
        displayColors: false
      }
    },
    scales: {
      x: {
        ticks: { color: '#64748B', font: { size: 10 } },
        grid: { color: '#1E293B' }
      },
      y: {
        ticks: { color: '#64748B', font: { size: 10 } },
        grid: { color: '#1E293B' }
      }
    }
  };

  function destroyChart(id) {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
      delete chartInstances[id];
    }
  }

  // Gráfico 1: Evolución Temporada de Denuncias (Line Chart)
  function renderEvolucionLine(canvasId, labels, dataPoints) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.4)');
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)');

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Cantidad de Denuncias',
          data: dataPoints,
          borderColor: '#2563EB',
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 6
        }]
      },
      options: { ...commonOptions }
    });
  }

  // Gráfico 2: Denuncias por Departamento (Horizontal Bar Chart)
  function renderDeptHorizontalBar(canvasId, labels, dataPoints) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Denuncias',
          data: dataPoints,
          backgroundColor: 'rgba(6, 182, 212, 0.75)',
          borderColor: '#06B6D4',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        ...commonOptions,
        indexAxis: 'y'
      }
    });
  }

  // Gráfico 3: Principales Tipos de Hecho / Delito (Bar Chart Top 10)
  function renderTopDelitosBar(canvasId, labels, dataPoints) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Incidencia Delictiva',
          data: dataPoints,
          backgroundColor: [
            '#EF4444', '#F59E0B', '#10B981', '#06B6D4',
            '#2563EB', '#8B5CF6', '#EC4899'
          ],
          borderRadius: 6
        }]
      },
      options: { ...commonOptions }
    });
  }

  // Gráfico 4: Distribución Mensual (Bar Chart 12 Meses)
  function renderMesesBar(canvasId, labels, dataPoints) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Denuncias por Mes',
          data: dataPoints,
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: '#10B981',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: { ...commonOptions }
    });
  }

  // Gráfico 5: Distribución Geográfica por Macroregión (Doughnut / Polar)
  function renderMacroDoughnut(canvasId, labels, dataPoints) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataPoints,
          backgroundColor: ['#2563EB', '#10B981', '#F59E0B', '#EF4444'],
          borderColor: '#0F172A',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#94A3B8', font: { family: 'Inter', size: 11 } } }
        }
      }
    });
  }

  // Gráfico 6: Comparativa Anual (Grouped Bar Chart por Año)
  function renderAnualBar(canvasId, labels, dataPoints) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total por Año (2018 - 2026)',
          data: dataPoints,
          backgroundColor: 'rgba(139, 92, 246, 0.75)',
          borderColor: '#8B5CF6',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: { ...commonOptions }
    });
  }

  return {
    renderEvolucionLine: renderEvolucionLine,
    renderDeptHorizontalBar: renderDeptHorizontalBar,
    renderTopDelitosBar: renderTopDelitosBar,
    renderMesesBar: renderMesesBar,
    renderMacroDoughnut: renderMacroDoughnut,
    renderAnualBar: renderAnualBar
  };
})();
