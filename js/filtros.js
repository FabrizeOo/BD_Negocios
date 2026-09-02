/* ============================================================================
   PROYECTO: SEGURIDAD PERÚ (Dashboard PNP)
   Filtros Dinámicos e Interactivos - filtros.js
   Manejo de jerarquías de ubicación (Dpto -> Prov -> Dist) y actualización automática
   ============================================================================ */

window.SeguridadFiltros = (function () {
  let currentFilters = {
    anio: '',
    mes: '',
    trimestre: '',
    departamento: '',
    provincia: '',
    distrito: '',
    delito: '',
    institucion: ''
  };

  let hierarchy = {};
  let onFilterChangeCallback = null;

  function initFilters(changeCallback) {
    onFilterChangeCallback = changeCallback;

    const ds = window.SeguridadSupabase.getLocalDataset();
    if (!ds) return;

    hierarchy = ds.hierarchy || {};

    populateSelect('filter-anio', ds.metadata.anios, 'Todos los Años');
    populateSelect('filter-delito', ds.metadata.total_delitos ? ds.dimensions.delito.map(d => d.modalidad) : [], 'Todos los Tipos de Hecho');
    populateSelect('filter-departamento', Object.keys(hierarchy).sort(), 'Todos los Departamentos');

    // Attach automatic change listener to ALL filter selects
    const filterIds = ['filter-anio', 'filter-mes', 'filter-trimestre', 'filter-departamento', 'filter-provincia', 'filter-distrito', 'filter-delito', 'filter-institucion'];

    filterIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      el.addEventListener('change', function () {
        if (id === 'filter-departamento') {
          handleDepartmentChange(this.value);
        } else if (id === 'filter-provincia') {
          handleProvinceChange(this.value);
        }

        if (typeof onFilterChangeCallback === 'function') {
          onFilterChangeCallback();
        }
      });
    });
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
      departamento: document.getElementById('filter-departamento')?.value || '',
      provincia: document.getElementById('filter-provincia')?.value || '',
      distrito: document.getElementById('filter-distrito')?.value || '',
      delito: document.getElementById('filter-delito')?.value || '',
      institucion: document.getElementById('filter-institucion')?.value || ''
    };
  }

  function resetFilters() {
    ['filter-anio', 'filter-mes', 'filter-trimestre', 'filter-departamento', 'filter-provincia', 'filter-distrito', 'filter-delito', 'filter-institucion'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    populateSelect('filter-provincia', [], 'Todas las Provincias');
    populateSelect('filter-distrito', [], 'Todos los Distritos');
  }

  return {
    init: initFilters,
    getActiveFilters: getActiveFilters,
    resetFilters: resetFilters
  };
})();
