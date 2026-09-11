-- ============================================================================
-- PASO 3: 03_views.sql
-- Recreación de Vistas Analíticas con Navegación por el Esquema Copo de Nieve
-- ============================================================================

BEGIN;

-- 1. Vista Global Consolidada de Hechos (Unión de Fragmentos Regionales)
CREATE OR REPLACE VIEW vw_denuncias_global AS
SELECT * FROM fact_denuncias_norte
UNION ALL
SELECT * FROM fact_denuncias_centro
UNION ALL
SELECT * FROM fact_denuncias_sur
UNION ALL
SELECT * FROM fact_denuncias_oriente;

-- 2. Vista Analítica Detallada (Reorganización limpia mediante DROP previo)
DROP VIEW IF EXISTS vw_denuncias_analitica CASCADE;

CREATE VIEW vw_denuncias_analitica AS
SELECT 
    f.id_denuncia,
    f.cantidad_denuncias,
    -- Jerarquía Temporal (Copo de Nieve)
    t.fecha,
    a.numero_anio AS anio,
    t.mes,
    t.nombre_mes,
    tri.numero_trimestre AS trimestre,
    sem.numero_semestre AS semestre,
    -- Jerarquía Geográfica (Copo de Nieve)
    u.ubigeo,
    u.distrito,
    p.nombre_provincia AS provincia,
    d.nombre_departamento AS departamento,
    m.nombre_macroregion AS macroregion,
    -- Jerarquía Delitos (Copo de Nieve)
    del.modalidad,
    cat.nombre_categoria AS categoria,
    -- Jerarquía Institucional (Copo de Nieve)
    inst.nombre_institucion,
    tipo.tipo AS tipo_institucion
FROM vw_denuncias_global f
JOIN dim_tiempo t ON f.id_tiempo = t.id_tiempo
JOIN dim_trimestre tri ON t.id_trimestre = tri.id_trimestre
JOIN dim_semestre sem ON tri.id_semestre = sem.id_semestre
JOIN dim_anio a ON sem.id_anio = a.id_anio
JOIN dim_ubicacion u ON f.id_ubicacion = u.id_ubicacion
JOIN dim_provincia p ON u.id_provincia = p.id_provincia
JOIN dim_departamento d ON p.id_departamento = d.id_departamento
JOIN dim_macroregion m ON d.id_macroregion = m.id_macroregion
JOIN dim_delito del ON f.id_delito = del.id_delito
JOIN dim_categoria_delito cat ON del.id_categoria = cat.id_categoria
JOIN dim_institucion inst ON f.id_institucion = inst.id_institucion
JOIN dim_tipo_institucion tipo ON inst.id_tipo_institucion = tipo.id_tipo_institucion;

COMMIT;
