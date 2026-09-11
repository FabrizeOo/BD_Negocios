window.SeguridadFiltros = (function () {
  let currentFilters = {
    anio: '',
    mes: '',
    trimestre: '',
    macroregion: '',
    departamento: '',
    provincia: '',
    distrito: '',
    delito: '',
    topN: '10',
    sort: 'cantidad_desc'
  };

  let hierarchy = {};
  let onFilterChangeCallback = null;

  function initFilters(changeCallback) {
    onFilterChangeCallback = changeCallback;

    const ds = window.SeguridadSupabase.getLocalDataset();
    if (!ds) return;

    hierarchy = ds.hierarchy || {};

    populateSelect('filter-anio', ds.metadata.anios, 'Todos los Años');
    populateSelect('filter-delito', ds.dimensions?.delito?.map(d => d.modalidad) || [], 'Todos los Tipos de Hecho');
    populateSelect('filter-departamento', Object.keys(hierarchy).sort(), 'Todos los Departamentos');

    // All filter IDs
    const filterIds = [
      'filter-anio', 'filter-mes', 'filter-trimestre',
      'filter-macroregion', 'filter-departamento', 'filter-provincia', 'filter-distrito',
      'filter-delito', 'filter-top-n', 'filter-sort'
    ];

    filterIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      el.addEventListener('change', function () {
        if (id === 'filter-departamento') {
          handleDepartmentChange(this.value);
        } else if (id === 'filter-provincia') {
          handleProvinceChange(this.value);
        } else if (id === 'filter-macroregion') {
          handleMacroChange(this.value);
        }

        if (typeof onFilterChangeCallback === 'function') {
          onFilterChangeCallback();
        }
      });
    });

    // Apply / Clear buttons
    const btnApply = document.getElementById('btn-apply-filters');
    if (btnApply) {
      btnApply.addEventListener('click', function () {
        if (typeof onFilterChangeCallback === 'function') onFilterChangeCallback();
        closeSidebar();
      });
    }
  }

  function handleMacroChange(selectedMacro) {
    // Filter available departments by macroregion mapping
    const macroMap = {
      'NORTE': ['PIURA', 'LAMBAYEQUE', 'LA LIBERTAD', 'CAJAMARCA', 'TUMBES', 'AMAZONAS', 'SAN MARTIN'],
      'SUR': ['AREQUIPA', 'PUNO', 'TACNA', 'MOQUEGUA', 'CUSCO', 'APURIMAC', 'MADRE DE DIOS'],
      'CENTRO': ['JUNIN', 'PASCO', 'HUANUCO', 'HUANCAVELICA', 'AYACUCHO', 'ICA', 'ANCASH'],
      'ORIENTE': ['LORETO', 'UCAYALI'],
      'LIMA': ['LIMA', 'CALLAO']
    };

    const allDepts = Object.keys(hierarchy).sort();
    let filteredDepts = allDepts;

    if (selectedMacro && macroMap[selectedMacro]) {
      filteredDepts = allDepts.filter(d =>
        macroMap[selectedMacro].some(m => d.toUpperCase().includes(m))
      );
    }

    populateSelect('filter-departamento', filteredDepts, 'Todos los Departamentos');
    populateSelect('filter-provincia', [], 'Todas las Provincias');
    populateSelect('filter-distrito', [], 'Todos los Distritos');
  }

  function handleDepartmentChange(selectedDpto) {
    currentFilters.departamento = selectedDpto;
    currentFilters.provincia = '';
    currentFilters.distrito = '';

    if (selectedDpto && hierarchy[selectedDpto]) {
      const provs = Object.keys(hierarchy[selectedDpto]).sort();
      populateSelect('filter-provincia', provs, 'Todas las Provincias');
    } else {
      populateSelect('filter-provincia', [], 'Todas las Provincias');
    }
    populateSelect('filter-distrito', [], 'Todos los Distritos');
  }

  function handleProvinceChange(selectedProv) {
    const selectedDpto = document.getElementById('filter-departamento')?.value || '';
    currentFilters.provincia = selectedProv;
    currentFilters.distrito = '';

    if (selectedDpto && selectedProv && hierarchy[selectedDpto] && hierarchy[selectedDpto][selectedProv]) {
      const dists = hierarchy[selectedDpto][selectedProv].sort();
      populateSelect('filter-distrito', dists, 'Todos los Distritos');
    } else {
      populateSelect('filter-distrito', [], 'Todos los Distritos');
    }
  }

  function populateSelect(elementId, items, defaultText) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = `<option value="">${defaultText}</option>`;
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item;
      option.textContent = item;
      el.appendChild(option);
    });
  }

  function getActiveFilters() {
    return {
      anio: document.getElementById('filter-anio')?.value || '',
      mes: document.getElementById('filter-mes')?.value || '',
      trimestre: document.getElementById('filter-trimestre')?.value || '',
      macroregion: document.getElementById('filter-macroregion')?.value || '',
      departamento: document.getElementById('filter-departamento')?.value || '',
      provincia: document.getElementById('filter-provincia')?.value || '',
      distrito: document.getElementById('filter-distrito')?.value || '',
      delito: document.getElementById('filter-delito')?.value || '',
      topN: parseInt(document.getElementById('filter-top-n')?.value || '10'),
      sort: document.getElementById('filter-sort')?.value || 'cantidad_desc'
    };
  }

  function resetFilters() {
    [
      'filter-anio', 'filter-mes', 'filter-trimestre',
      'filter-macroregion', 'filter-departamento', 'filter-provincia', 'filter-distrito', 'filter-delito'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const topN = document.getElementById('filter-top-n');
    if (topN) topN.value = '10';
    const sort = document.getElementById('filter-sort');
    if (sort) sort.value = 'cantidad_desc';

    // Restore all departments
    const ds = window.SeguridadSupabase.getLocalDataset();
    if (ds && ds.hierarchy) {
      populateSelect('filter-departamento', Object.keys(ds.hierarchy).sort(), 'Todos los Departamentos');
    }
    populateSelect('filter-provincia', [], 'Todas las Provincias');
    populateSelect('filter-distrito', [], 'Todos los Distritos');
  }

  // ---- Mobile sidebar toggle ----
  function openSidebar() {
    const sidebar = document.getElementById('sidebar-filters');
    const overlay = document.getElementById('sidebar-overlay');
    const btn = document.getElementById('btn-hamburger');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('visible');
    if (btn) { btn.classList.add('active'); btn.setAttribute('aria-expanded', 'true'); }
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    const sidebar = document.getElementById('sidebar-filters');
    const overlay = document.getElementById('sidebar-overlay');
    const btn = document.getElementById('btn-hamburger');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
    if (btn) { btn.classList.remove('active'); btn.setAttribute('aria-expanded', 'false'); }
    document.body.style.overflow = '';
  }

  // Wire up mobile controls
  document.addEventListener('DOMContentLoaded', function () {
    const hamburger = document.getElementById('btn-hamburger');
    const closeBtn = document.getElementById('btn-close-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (hamburger) hamburger.addEventListener('click', openSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (overlay) overlay.addEventListener('click', closeSidebar);
  });

  return {
    init: initFilters,
    getActiveFilters: getActiveFilters,
    resetFilters: resetFilters,
    closeSidebar: closeSidebar
  };
})();
