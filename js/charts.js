window.SeguridadCharts = (function () {
  let chartInstances = {};

  const PALETTE = [
    '#2563EB', '#0EA5E9', '#06B6D4', '#10B981', '#84CC16',
    '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#F97316',
    '#14B8A6', '#E11D48', '#6366F1', '#A16207', '#065F46'
  ];

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
        padding: 12,
        displayColors: true,
        callbacks: {
          label: function (ctx) {
            return ' ' + (ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.parsed).toLocaleString('es-PE');
          }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#64748B', font: { size: 10 } },
        grid: { color: '#1E293B' }
      },
      y: {
        ticks: {
          color: '#64748B', font: { size: 10 },
          callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v
        },
        grid: { color: '#1E293B' }
      }
    }
  };

  const noScalesOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: { color: '#94A3B8', font: { family: 'Inter', size: 10 }, padding: 12, boxWidth: 12 }
      },
      tooltip: {
        backgroundColor: '#0F172A',
        borderColor: '#26334D',
        borderWidth: 1,
        titleColor: '#F1F5F9',
        bodyColor: '#38BDF8',
        padding: 12
      }
    }
  };

  function destroyChart(id) {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
      delete chartInstances[id];
    }
  }

  // Chart 1: Evolución Temporal (Line)
  function renderEvolucionLine(canvasId, labels, dataPoints) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.45)');
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)');

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Denuncias',
          data: dataPoints,
          borderColor: '#3B82F6',
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: labels.length > 30 ? 0 : 3,
          pointHoverRadius: 6
        }]
      },
      options: { ...commonOptions }
    });
  }

  // Chart 2: Comparativa Anual (Bar)
  function renderAnualBar(canvasId, labels, dataPoints) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total por Año',
          data: dataPoints,
          backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length] + 'CC'),
          borderColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: { ...commonOptions }
    });
  }

  // Chart 3: Distribución Mensual (Bar 12 meses)
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

  // Chart 4: Trimestral agrupado por año (Grouped Bar)
  function renderTrimestralBar(canvasId, years, q1, q2, q3, q4) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: years,
        datasets: [
          { label: 'Q1', data: q1, backgroundColor: 'rgba(14, 165, 233, 0.8)', borderRadius: 3 },
          { label: 'Q2', data: q2, backgroundColor: 'rgba(16, 185, 129, 0.8)', borderRadius: 3 },
          { label: 'Q3', data: q3, backgroundColor: 'rgba(245, 158, 11, 0.8)', borderRadius: 3 },
          { label: 'Q4', data: q4, backgroundColor: 'rgba(239, 68, 68, 0.8)', borderRadius: 3 }
        ]
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          legend: { labels: { color: '#94A3B8', font: { family: 'Inter', size: 10 } } }
        }
      }
    });
  }

  // Chart 5: Top N Departamentos (Horizontal Bar)
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
          backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length] + 'CC'),
          borderColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
          borderWidth: 1,
          borderRadius: 5
        }]
      },
      options: {
        ...commonOptions,
        indexAxis: 'y',
        scales: {
          x: {
            ticks: {
              color: '#64748B', font: { size: 10 },
              callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v
            },
            grid: { color: '#1E293B' }
          },
          y: { ticks: { color: '#94A3B8', font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
  }

  // Chart 6: Macroregión Doughnut
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
          backgroundColor: ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#EC4899'],
          borderColor: '#0F172A',
          borderWidth: 3,
          hoverOffset: 10
        }]
      },
      options: {
        ...noScalesOptions,
        cutout: '60%'
      }
    });
  }

  // Chart 7: Top 10 Provincias (Horizontal Bar)
  function renderProvHorizontalBar(canvasId, labels, dataPoints) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Denuncias',
          data: dataPoints,
          backgroundColor: 'rgba(249, 115, 22, 0.75)',
          borderColor: '#F97316',
          borderWidth: 1,
          borderRadius: 5
        }]
      },
      options: {
        ...commonOptions,
        indexAxis: 'y',
        scales: {
          x: {
            ticks: {
              color: '#64748B', font: { size: 10 },
              callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v
            },
            grid: { color: '#1E293B' }
          },
          y: { ticks: { color: '#94A3B8', font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
  }

  // Chart 8: Top 10 Distritos (Horizontal Bar)
  function renderDistHorizontalBar(canvasId, labels, dataPoints) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Denuncias',
          data: dataPoints,
          backgroundColor: 'rgba(20, 184, 166, 0.75)',
          borderColor: '#14B8A6',
          borderWidth: 1,
          borderRadius: 5
        }]
      },
      options: {
        ...commonOptions,
        indexAxis: 'y',
        scales: {
          x: {
            ticks: {
              color: '#64748B', font: { size: 10 },
              callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v
            },
            grid: { color: '#1E293B' }
          },
          y: { ticks: { color: '#94A3B8', font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
  }

  // Chart 9: Top Tipos de Hecho (Horizontal Bar con colores)
  function renderTopDelitosBar(canvasId, labels, dataPoints) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Incidencia',
          data: dataPoints,
          backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length] + 'BB'),
          borderColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
          borderRadius: 5,
          borderWidth: 1
        }]
      },
      options: {
        ...commonOptions,
        indexAxis: 'y',
        scales: {
          x: {
            ticks: {
              color: '#64748B', font: { size: 10 },
              callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v
            },
            grid: { color: '#1E293B' }
          },
          y: { ticks: { color: '#94A3B8', font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
  }

  // Chart 10: Evolución Top 5 tipos de delito por año (Multi-line)
  function renderDelitoEvolucionLine(canvasId, years, topDelitos) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const colors = ['#EF4444', '#F59E0B', '#3B82F6', '#10B981', '#EC4899'];

    const datasets = topDelitos.map((item, i) => ({
      label: item.label.length > 22 ? item.label.substring(0, 22) + '…' : item.label,
      data: item.data,
      borderColor: colors[i % colors.length],
      backgroundColor: colors[i % colors.length] + '22',
      borderWidth: 2,
      tension: 0.35,
      fill: false,
      pointRadius: 3,
      pointHoverRadius: 6
    }));

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels: years, datasets },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          legend: { labels: { color: '#94A3B8', font: { family: 'Inter', size: 9 }, boxWidth: 12 } }
        }
      }
    });
  }

  // Chart 11: Radar concentración delictiva por Macroregión
  function renderRadarMacro(canvasId, labels, datasets) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const colors = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: datasets.map((d, i) => ({
          label: d.label,
          data: d.data,
          borderColor: colors[i % colors.length],
          backgroundColor: colors[i % colors.length] + '33',
          borderWidth: 2,
          pointRadius: 3
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: '#1E293B' },
            grid: { color: '#1E293B' },
            pointLabels: { color: '#94A3B8', font: { size: 9 } },
            ticks: {
              color: '#64748B', font: { size: 8 }, backdropColor: 'transparent',
              callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v
            }
          }
        },
        plugins: {
          legend: { labels: { color: '#94A3B8', font: { family: 'Inter', size: 9 }, boxWidth: 10 } }
        }
      }
    });
  }

  // Chart 12: Participación porcentual (Pie)
  function renderParticipacionPie(canvasId, labels, dataPoints) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: dataPoints,
          backgroundColor: PALETTE.slice(0, labels.length).map(c => c + 'CC'),
          borderColor: '#0F172A',
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        ...noScalesOptions,
        plugins: {
          ...noScalesOptions.plugins,
          tooltip: {
            ...noScalesOptions.plugins.tooltip,
            callbacks: {
              label: function (ctx) {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                return ` ${ctx.label}: ${ctx.parsed.toLocaleString('es-PE')} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  return {
    renderEvolucionLine,
    renderAnualBar,
    renderMesesBar,
    renderTrimestralBar,
    renderDeptHorizontalBar,
    renderMacroDoughnut,
    renderProvHorizontalBar,
    renderDistHorizontalBar,
    renderTopDelitosBar,
    renderDelitoEvolucionLine,
    renderRadarMacro,
    renderParticipacionPie
  };
})();
