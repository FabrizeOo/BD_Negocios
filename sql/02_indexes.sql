-- ============================================================================
-- PASO 2: 02_indexes.sql
-- Índices B-Tree para Acelerar la Navegación y JOINs en el Esquema Copo de Nieve
-- ============================================================================

BEGIN;

-- Índices en ramas de Delito e Institución
CREATE INDEX IF NOT EXISTS idx_delito_categoria ON dim_delito(id_categoria);
CREATE INDEX IF NOT EXISTS idx_institucion_tipo ON dim_institucion(id_tipo_institucion);

-- Índices en jerarquía Temporal (Snowflake Branch)
CREATE INDEX IF NOT EXISTS idx_tiempo_trimestre ON dim_tiempo(id_trimestre);
CREATE INDEX IF NOT EXISTS idx_trimestre_semestre ON dim_trimestre(id_semestre);
CREATE INDEX IF NOT EXISTS idx_semestre_anio ON dim_semestre(id_anio);

-- Índices en jerarquía Geográfica (Snowflake Branch)
CREATE INDEX IF NOT EXISTS idx_ubicacion_provincia ON dim_ubicacion(id_provincia);
CREATE INDEX IF NOT EXISTS idx_provincia_dpto ON dim_provincia(id_departamento);
CREATE INDEX IF NOT EXISTS idx_dpto_macroregion ON dim_departamento(id_macroregion);

COMMIT;
