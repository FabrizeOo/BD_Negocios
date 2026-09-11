-- ============================================================================
-- SCRIPT COMPLETO DE MIGRACIÓN: DE ESQUEMA ESTRELLA A ESQUEMA COPO DE NIEVE
-- Base de Datos: Supabase / PostgreSQL
-- Proyecto: Análisis de Denuncias Policiales PNP Perú
-- Autor: Equipo de Arquitectura de Datos
-- ============================================================================
-- Este script realiza la transición en caliente sin perder los datos existentes:
-- 1. Crea las 8 subdimensiones normalizadas (Copo de Nieve).
-- 2. Migra y puebla automáticamente desde las dimensiones actuales.
-- 3. Vincula las llaves foráneas (FK) jerárquicas.
-- 4. Crea los índices B-Tree de navegación para optimizar los JOINs.
-- 5. Aplica Row Level Security (RLS) y políticas de lectura pública.
-- 6. Actualiza las Vistas y Funciones RPC existentes para compatibilidad total.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PASO 1: CREAR LAS SUBDIMENSIONES DE LA RAMA DELITO
-- ============================================================================
CREATE TABLE IF NOT EXISTS dim_categoria_delito (
    id_categoria SERIAL PRIMARY KEY,
    nombre_categoria VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT
);

-- Agregar FK en dim_delito hacia dim_categoria_delito
ALTER TABLE dim_delito 
ADD COLUMN IF NOT EXISTS id_categoria INT;

-- Migrar y poblar categorías únicas existentes
INSERT INTO dim_categoria_delito (nombre_categoria, descripcion)
SELECT DISTINCT 
    categoria, 
    'Categorización oficial del Código Penal para modalidades delictivas registradas'
FROM dim_delito
ON CONFLICT (nombre_categoria) DO NOTHING;

-- Enlazar dim_delito con su categoría padre
UPDATE dim_delito d
SET id_categoria = c.id_categoria
FROM dim_categoria_delito c
WHERE d.categoria = c.nombre_categoria;

-- Asignar restricción NOT NULL y FK
ALTER TABLE dim_delito 
ALTER COLUMN id_categoria SET NOT NULL;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_delito_categoria'
    ) THEN
        ALTER TABLE dim_delito 
        ADD CONSTRAINT fk_delito_categoria 
        FOREIGN KEY (id_categoria) REFERENCES dim_categoria_delito(id_categoria) ON DELETE RESTRICT;
    END IF;
END $$;


-- ============================================================================
-- PASO 2: CREAR LAS SUBDIMENSIONES DE LA RAMA INSTITUCIÓN
-- ============================================================================
CREATE TABLE IF NOT EXISTS dim_tipo_institucion (
    id_tipo_institucion SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL UNIQUE,
    sector VARCHAR(100) NOT NULL DEFAULT 'Ministerio del Interior (MININTER)'
);

-- Agregar FK en dim_institucion
ALTER TABLE dim_institucion 
ADD COLUMN IF NOT EXISTS id_tipo_institucion INT;

-- Poblar tipos institucionales únicos
INSERT INTO dim_tipo_institucion (tipo, sector)
SELECT DISTINCT tipo, 'Ministerio del Interior (MININTER)'
FROM dim_institucion
ON CONFLICT (tipo) DO NOTHING;

-- Enlazar dim_institucion con su tipo
UPDATE dim_institucion i
SET id_tipo_institucion = t.id_tipo_institucion
FROM dim_tipo_institucion t
WHERE i.tipo = t.tipo;

ALTER TABLE dim_institucion 
ALTER COLUMN id_tipo_institucion SET NOT NULL;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_institucion_tipo'
    ) THEN
        ALTER TABLE dim_institucion 
        ADD CONSTRAINT fk_institucion_tipo 
        FOREIGN KEY (id_tipo_institucion) REFERENCES dim_tipo_institucion(id_tipo_institucion) ON DELETE RESTRICT;
    END IF;
END $$;


-- ============================================================================
-- PASO 3: CREAR LAS SUBDIMENSIONES DE LA RAMA TEMPORAL (AÑO -> SEMESTRE -> TRIMESTRE)
-- ============================================================================
CREATE TABLE IF NOT EXISTS dim_anio (
    id_anio INT PRIMARY KEY,
    numero_anio INT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS dim_semestre (
    id_semestre SERIAL PRIMARY KEY,
    id_anio INT NOT NULL REFERENCES dim_anio(id_anio) ON DELETE RESTRICT,
    numero_semestre INT NOT NULL CHECK (numero_semestre IN (1, 2)),
    CONSTRAINT uq_anio_semestre UNIQUE (id_anio, numero_semestre)
);

CREATE TABLE IF NOT EXISTS dim_trimestre (
    id_trimestre SERIAL PRIMARY KEY,
    id_semestre INT NOT NULL REFERENCES dim_semestre(id_semestre) ON DELETE RESTRICT,
    numero_trimestre INT NOT NULL CHECK (numero_trimestre BETWEEN 1 AND 4),
    CONSTRAINT uq_semestre_trimestre UNIQUE (id_semestre, numero_trimestre)
);

-- Agregar FK en dim_tiempo hacia dim_trimestre
ALTER TABLE dim_tiempo 
ADD COLUMN IF NOT EXISTS id_trimestre INT;

-- Poblar años
INSERT INTO dim_anio (id_anio, numero_anio)
SELECT DISTINCT anio, anio FROM dim_tiempo
ON CONFLICT (id_anio) DO NOTHING;

-- Poblar semestres
INSERT INTO dim_semestre (id_anio, numero_semestre)
SELECT DISTINCT anio, semestre FROM dim_tiempo
ON CONFLICT (id_anio, numero_semestre) DO NOTHING;

-- Poblar trimestres
INSERT INTO dim_trimestre (id_semestre, numero_trimestre)
SELECT DISTINCT s.id_semestre, t.trimestre
FROM dim_tiempo t
JOIN dim_semestre s ON t.anio = s.id_anio AND t.semestre = s.numero_semestre
ON CONFLICT (id_semestre, numero_trimestre) DO NOTHING;

-- Enlazar dim_tiempo con dim_trimestre
UPDATE dim_tiempo t
SET id_trimestre = tri.id_trimestre
FROM dim_trimestre tri
JOIN dim_semestre s ON tri.id_semestre = s.id_semestre
WHERE t.anio = s.id_anio AND t.trimestre = tri.numero_trimestre;

ALTER TABLE dim_tiempo 
ALTER COLUMN id_trimestre SET NOT NULL;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_tiempo_trimestre'
    ) THEN
        ALTER TABLE dim_tiempo 
        ADD CONSTRAINT fk_tiempo_trimestre 
        FOREIGN KEY (id_trimestre) REFERENCES dim_trimestre(id_trimestre) ON DELETE RESTRICT;
    END IF;
END $$;


-- ============================================================================
-- PASO 4: CREAR LAS SUBDIMENSIONES DE LA RAMA GEOGRÁFICA (MACROREGION -> DEPARTAMENTO -> PROVINCIA)
-- ============================================================================
CREATE TABLE IF NOT EXISTS dim_macroregion (
    id_macroregion SERIAL PRIMARY KEY,
    nombre_macroregion VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS dim_departamento (
    id_departamento SERIAL PRIMARY KEY,
    id_macroregion INT NOT NULL REFERENCES dim_macroregion(id_macroregion) ON DELETE RESTRICT,
    nombre_departamento VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS dim_provincia (
    id_provincia SERIAL PRIMARY KEY,
    id_departamento INT NOT NULL REFERENCES dim_departamento(id_departamento) ON DELETE RESTRICT,
    nombre_provincia VARCHAR(100) NOT NULL,
    CONSTRAINT uq_dpto_provincia UNIQUE (id_departamento, nombre_provincia)
);

-- Agregar FK en dim_ubicacion hacia dim_provincia (dim_ubicacion actúa como nivel distrito)
ALTER TABLE dim_ubicacion 
ADD COLUMN IF NOT EXISTS id_provincia INT;

-- Poblar macroregiones
INSERT INTO dim_macroregion (nombre_macroregion)
SELECT DISTINCT macroregion FROM dim_ubicacion
ON CONFLICT (nombre_macroregion) DO NOTHING;

-- Poblar departamentos vinculados a su macroregión
INSERT INTO dim_departamento (nombre_departamento, id_macroregion)
SELECT DISTINCT u.departamento, m.id_macroregion
FROM dim_ubicacion u
JOIN dim_macroregion m ON u.macroregion = m.nombre_macroregion
ON CONFLICT (nombre_departamento) DO NOTHING;

-- Poblar provincias vinculadas a su departamento
INSERT INTO dim_provincia (nombre_provincia, id_departamento)
SELECT DISTINCT u.provincia, d.id_departamento
FROM dim_ubicacion u
JOIN dim_departamento d ON u.departamento = d.nombre_departamento
ON CONFLICT (id_departamento, nombre_provincia) DO NOTHING;

-- Enlazar dim_ubicacion (distrito) con su provincia
UPDATE dim_ubicacion u
SET id_provincia = p.id_provincia
FROM dim_provincia p
JOIN dim_departamento d ON p.id_departamento = d.id_departamento
WHERE u.departamento = d.nombre_departamento 
  AND u.provincia = p.nombre_provincia;

ALTER TABLE dim_ubicacion 
ALTER COLUMN id_provincia SET NOT NULL;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_ubicacion_provincia'
    ) THEN
        ALTER TABLE dim_ubicacion 
        ADD CONSTRAINT fk_ubicacion_provincia 
        FOREIGN KEY (id_provincia) REFERENCES dim_provincia(id_provincia) ON DELETE RESTRICT;
    END IF;
END $$;


-- ============================================================================
-- PASO 5: ÍNDICES B-TREE PARA OPTIMIZAR NAVEGACIÓN JERÁRQUICA (SNOWFLAKE JOINS)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_delito_categoria ON dim_delito(id_categoria);
CREATE INDEX IF NOT EXISTS idx_institucion_tipo ON dim_institucion(id_tipo_institucion);

CREATE INDEX IF NOT EXISTS idx_tiempo_trimestre ON dim_tiempo(id_trimestre);
CREATE INDEX IF NOT EXISTS idx_trimestre_semestre ON dim_trimestre(id_semestre);
CREATE INDEX IF NOT EXISTS idx_semestre_anio ON dim_semestre(id_anio);

CREATE INDEX IF NOT EXISTS idx_ubicacion_provincia ON dim_ubicacion(id_provincia);
CREATE INDEX IF NOT EXISTS idx_provincia_dpto ON dim_provincia(id_departamento);
CREATE INDEX IF NOT EXISTS idx_dpto_macroregion ON dim_departamento(id_macroregion);


-- ============================================================================
-- PASO 6: ROW LEVEL SECURITY (RLS) Y POLÍTICAS DE LECTURA PÚBLICA (SUPABASE)
-- ============================================================================
-- Habilitar RLS en las nuevas tablas
ALTER TABLE dim_categoria_delito ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_tipo_institucion ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_anio ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_semestre ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_trimestre ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_macroregion ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_departamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_provincia ENABLE ROW LEVEL SECURITY;

-- Crear políticas de lectura pública para que Supabase cliente las pueda consultar
DO $$
BEGIN
    -- Politica categoria delito
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura publica en dim_categoria_delito') THEN
        CREATE POLICY "Permitir lectura publica en dim_categoria_delito" ON dim_categoria_delito FOR SELECT USING (true);
    END IF;

    -- Politica tipo institucion
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura publica en dim_tipo_institucion') THEN
        CREATE POLICY "Permitir lectura publica en dim_tipo_institucion" ON dim_tipo_institucion FOR SELECT USING (true);
    END IF;

    -- Politica anio
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura publica en dim_anio') THEN
        CREATE POLICY "Permitir lectura publica en dim_anio" ON dim_anio FOR SELECT USING (true);
    END IF;

    -- Politica semestre
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura publica en dim_semestre') THEN
        CREATE POLICY "Permitir lectura publica en dim_semestre" ON dim_semestre FOR SELECT USING (true);
    END IF;

    -- Politica trimestre
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura publica en dim_trimestre') THEN
        CREATE POLICY "Permitir lectura publica en dim_trimestre" ON dim_trimestre FOR SELECT USING (true);
    END IF;

    -- Politica macroregion
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura publica en dim_macroregion') THEN
        CREATE POLICY "Permitir lectura publica en dim_macroregion" ON dim_macroregion FOR SELECT USING (true);
    END IF;

    -- Politica departamento
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura publica en dim_departamento') THEN
        CREATE POLICY "Permitir lectura publica en dim_departamento" ON dim_departamento FOR SELECT USING (true);
    END IF;

    -- Politica provincia
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura publica en dim_provincia') THEN
        CREATE POLICY "Permitir lectura publica en dim_provincia" ON dim_provincia FOR SELECT USING (true);
    END IF;
END $$;

-- Conceder privilegios de acceso (GRANT) a los roles anon y authenticated de Supabase
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;


-- ============================================================================
-- PASO 7: ACTUALIZACIÓN DE VISTA ANALÍTICA GLOBAL (vw_denuncias_analitica)
-- Garantiza que el frontend siga funcionando exactamente igual sin cambios en el cliente
-- ============================================================================
-- Se hace DROP previo para permitir la reorganización limpia de columnas normalizadas
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


-- ============================================================================
-- PASO 8: ACTUALIZACIÓN DE FUNCIONES RPC PARA SUPABASE
-- Las funciones de backend se adaptan a las ramas jerárquicas del Copo de Nieve
-- ============================================================================
DROP FUNCTION IF EXISTS fn_get_denuncias_departamento(integer);
DROP FUNCTION IF EXISTS fn_get_evolucion_mensual(integer);
DROP FUNCTION IF EXISTS fn_get_kpis(integer);
DROP FUNCTION IF EXISTS fn_get_fragmento(text);

-- 1. fn_get_denuncias_departamento
CREATE OR REPLACE FUNCTION fn_get_denuncias_departamento(p_anio integer DEFAULT NULL)
RETURNS TABLE(departamento text, macroregion text, total_denuncias bigint) 
LANGUAGE sql STABLE AS $$
    SELECT 
        d.nombre_departamento::text AS departamento,
        m.nombre_macroregion::text AS macroregion,
        SUM(f.cantidad_denuncias)::bigint AS total_denuncias
    FROM vw_denuncias_global f
    JOIN dim_tiempo t ON f.id_tiempo = t.id_tiempo
    JOIN dim_trimestre tri ON t.id_trimestre = tri.id_trimestre
    JOIN dim_semestre sem ON tri.id_semestre = sem.id_semestre
    JOIN dim_anio a ON sem.id_anio = a.id_anio
    JOIN dim_ubicacion u ON f.id_ubicacion = u.id_ubicacion
    JOIN dim_provincia p ON u.id_provincia = p.id_provincia
    JOIN dim_departamento d ON p.id_departamento = d.id_departamento
    JOIN dim_macroregion m ON d.id_macroregion = m.id_macroregion
    WHERE (p_anio IS NULL OR a.numero_anio = p_anio)
    GROUP BY d.nombre_departamento, m.nombre_macroregion
    ORDER BY total_denuncias DESC;
$$;

-- 2. fn_get_evolucion_mensual
CREATE OR REPLACE FUNCTION fn_get_evolucion_mensual(p_anio integer DEFAULT NULL)
RETURNS TABLE(anio integer, mes integer, nombre_mes text, total_denuncias bigint)
LANGUAGE sql STABLE AS $$
    SELECT 
        a.numero_anio AS anio,
        t.mes,
        t.nombre_mes::text,
        SUM(f.cantidad_denuncias)::bigint AS total_denuncias
    FROM vw_denuncias_global f
    JOIN dim_tiempo t ON f.id_tiempo = t.id_tiempo
    JOIN dim_trimestre tri ON t.id_trimestre = tri.id_trimestre
    JOIN dim_semestre sem ON tri.id_semestre = sem.id_semestre
    JOIN dim_anio a ON sem.id_anio = a.id_anio
    WHERE (p_anio IS NULL OR a.numero_anio = p_anio)
    GROUP BY a.numero_anio, t.mes, t.nombre_mes
    ORDER BY a.numero_anio ASC, t.mes ASC;
$$;

-- 3. fn_get_kpis
CREATE OR REPLACE FUNCTION fn_get_kpis(p_anio integer DEFAULT NULL)
RETURNS json
LANGUAGE sql STABLE AS $$
    SELECT json_build_object(
        'total_denuncias', COALESCE(SUM(f.cantidad_denuncias), 0),
        'total_registros', COUNT(*),
        'total_distritos_activos', COUNT(DISTINCT f.id_ubicacion),
        'delito_frecuente', (
            SELECT del.modalidad 
            FROM vw_denuncias_global f2 
            JOIN dim_delito del ON f2.id_delito = del.id_delito
            JOIN dim_tiempo t2 ON f2.id_tiempo = t2.id_tiempo
            JOIN dim_trimestre tri2 ON t2.id_trimestre = tri2.id_trimestre
            JOIN dim_semestre sem2 ON tri2.id_semestre = sem2.id_semestre
            JOIN dim_anio a2 ON sem2.id_anio = a2.id_anio
            WHERE (p_anio IS NULL OR a2.numero_anio = p_anio)
            GROUP BY del.modalidad 
            ORDER BY SUM(f2.cantidad_denuncias) DESC 
            LIMIT 1
        )
    )
    FROM vw_denuncias_global f
    JOIN dim_tiempo t ON f.id_tiempo = t.id_tiempo
    JOIN dim_trimestre tri ON t.id_trimestre = tri.id_trimestre
    JOIN dim_semestre sem ON tri.id_semestre = sem.id_semestre
    JOIN dim_anio a ON sem.id_anio = a.id_anio
    WHERE (p_anio IS NULL OR a.numero_anio = p_anio);
$$;

-- 4. fn_get_fragmento
CREATE OR REPLACE FUNCTION fn_get_fragmento(p_macroregion text)
RETURNS TABLE(id_denuncia bigint, macroregion text, anio integer, nombre_mes text, departamento text, distrito text, modalidad text, cantidad_denuncias integer)
LANGUAGE plpgsql STABLE AS $$
BEGIN
    IF UPPER(p_macroregion) = 'NORTE' THEN
        RETURN QUERY 
        SELECT f.id_denuncia, 'NORTE'::text, a.numero_anio, t.nombre_mes::text, d.nombre_departamento::text, u.distrito::text, del.modalidad::text, f.cantidad_denuncias
        FROM fact_denuncias_norte f
        JOIN dim_tiempo t ON f.id_tiempo = t.id_tiempo
        JOIN dim_trimestre tri ON t.id_trimestre = tri.id_trimestre
        JOIN dim_semestre sem ON tri.id_semestre = sem.id_semestre
        JOIN dim_anio a ON sem.id_anio = a.id_anio
        JOIN dim_ubicacion u ON f.id_ubicacion = u.id_ubicacion
        JOIN dim_provincia p ON u.id_provincia = p.id_provincia
        JOIN dim_departamento d ON p.id_departamento = d.id_departamento
        JOIN dim_delito del ON f.id_delito = del.id_delito;
    ELSIF UPPER(p_macroregion) = 'CENTRO' THEN
        RETURN QUERY 
        SELECT f.id_denuncia, 'CENTRO'::text, a.numero_anio, t.nombre_mes::text, d.nombre_departamento::text, u.distrito::text, del.modalidad::text, f.cantidad_denuncias
        FROM fact_denuncias_centro f
        JOIN dim_tiempo t ON f.id_tiempo = t.id_tiempo
        JOIN dim_trimestre tri ON t.id_trimestre = tri.id_trimestre
        JOIN dim_semestre sem ON tri.id_semestre = sem.id_semestre
        JOIN dim_anio a ON sem.id_anio = a.id_anio
        JOIN dim_ubicacion u ON f.id_ubicacion = u.id_ubicacion
        JOIN dim_provincia p ON u.id_provincia = p.id_provincia
        JOIN dim_departamento d ON p.id_departamento = d.id_departamento
        JOIN dim_delito del ON f.id_delito = del.id_delito;
    ELSIF UPPER(p_macroregion) = 'SUR' THEN
        RETURN QUERY 
        SELECT f.id_denuncia, 'SUR'::text, a.numero_anio, t.nombre_mes::text, d.nombre_departamento::text, u.distrito::text, del.modalidad::text, f.cantidad_denuncias
        FROM fact_denuncias_sur f
        JOIN dim_tiempo t ON f.id_tiempo = t.id_tiempo
        JOIN dim_trimestre tri ON t.id_trimestre = tri.id_trimestre
        JOIN dim_semestre sem ON tri.id_semestre = sem.id_semestre
        JOIN dim_anio a ON sem.id_anio = a.id_anio
        JOIN dim_ubicacion u ON f.id_ubicacion = u.id_ubicacion
        JOIN dim_provincia p ON u.id_provincia = p.id_provincia
        JOIN dim_departamento d ON p.id_departamento = d.id_departamento
        JOIN dim_delito del ON f.id_delito = del.id_delito;
    ELSE
        RETURN QUERY 
        SELECT f.id_denuncia, 'ORIENTE'::text, a.numero_anio, t.nombre_mes::text, d.nombre_departamento::text, u.distrito::text, del.modalidad::text, f.cantidad_denuncias
        FROM fact_denuncias_oriente f
        JOIN dim_tiempo t ON f.id_tiempo = t.id_tiempo
        JOIN dim_trimestre tri ON t.id_trimestre = tri.id_trimestre
        JOIN dim_semestre sem ON tri.id_semestre = sem.id_semestre
        JOIN dim_anio a ON sem.id_anio = a.id_anio
        JOIN dim_ubicacion u ON f.id_ubicacion = u.id_ubicacion
        JOIN dim_provincia p ON u.id_provincia = p.id_provincia
        JOIN dim_departamento d ON p.id_departamento = d.id_departamento
        JOIN dim_delito del ON f.id_delito = del.id_delito;
    END IF;
END;
$$;

COMMIT;
