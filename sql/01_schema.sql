-- ============================================================================
-- PASO 1: 01_schema.sql
-- Creación de Subdimensiones Normalizadas (Copo de Nieve) y Población Inicial
-- ============================================================================

BEGIN;

-- 1. RAMA DELITOS (dim_categoria_delito)
CREATE TABLE IF NOT EXISTS dim_categoria_delito (
    id_categoria SERIAL PRIMARY KEY,
    nombre_categoria VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT
);

ALTER TABLE dim_delito ADD COLUMN IF NOT EXISTS id_categoria INT;

INSERT INTO dim_categoria_delito (nombre_categoria, descripcion)
SELECT DISTINCT categoria, 'Categoría delictiva oficial según Código Penal Peruano'
FROM dim_delito
ON CONFLICT (nombre_categoria) DO NOTHING;

UPDATE dim_delito d
SET id_categoria = c.id_categoria
FROM dim_categoria_delito c
WHERE d.categoria = c.nombre_categoria;

ALTER TABLE dim_delito ALTER COLUMN id_categoria SET NOT NULL;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_delito_categoria') THEN
        ALTER TABLE dim_delito ADD CONSTRAINT fk_delito_categoria 
        FOREIGN KEY (id_categoria) REFERENCES dim_categoria_delito(id_categoria) ON DELETE RESTRICT;
    END IF;
END $$;


-- 2. RAMA INSTITUCIÓN (dim_tipo_institucion)
CREATE TABLE IF NOT EXISTS dim_tipo_institucion (
    id_tipo_institucion SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL UNIQUE,
    sector VARCHAR(100) NOT NULL DEFAULT 'Ministerio del Interior (MININTER)'
);

ALTER TABLE dim_institucion ADD COLUMN IF NOT EXISTS id_tipo_institucion INT;

INSERT INTO dim_tipo_institucion (tipo, sector)
SELECT DISTINCT tipo, 'Ministerio del Interior (MININTER)'
FROM dim_institucion
ON CONFLICT (tipo) DO NOTHING;

UPDATE dim_institucion i
SET id_tipo_institucion = t.id_tipo_institucion
FROM dim_tipo_institucion t
WHERE i.tipo = t.tipo;

ALTER TABLE dim_institucion ALTER COLUMN id_tipo_institucion SET NOT NULL;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_institucion_tipo') THEN
        ALTER TABLE dim_institucion ADD CONSTRAINT fk_institucion_tipo 
        FOREIGN KEY (id_tipo_institucion) REFERENCES dim_tipo_institucion(id_tipo_institucion) ON DELETE RESTRICT;
    END IF;
END $$;


-- 3. RAMA TEMPORAL (dim_anio -> dim_semestre -> dim_trimestre)
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

ALTER TABLE dim_tiempo ADD COLUMN IF NOT EXISTS id_trimestre INT;

INSERT INTO dim_anio (id_anio, numero_anio)
SELECT DISTINCT anio, anio FROM dim_tiempo
ON CONFLICT (id_anio) DO NOTHING;

INSERT INTO dim_semestre (id_anio, numero_semestre)
SELECT DISTINCT anio, semestre FROM dim_tiempo
ON CONFLICT (id_anio, numero_semestre) DO NOTHING;

INSERT INTO dim_trimestre (id_semestre, numero_trimestre)
SELECT DISTINCT s.id_semestre, t.trimestre
FROM dim_tiempo t
JOIN dim_semestre s ON t.anio = s.id_anio AND t.semestre = s.numero_semestre
ON CONFLICT (id_semestre, numero_trimestre) DO NOTHING;

UPDATE dim_tiempo t
SET id_trimestre = tri.id_trimestre
FROM dim_trimestre tri
JOIN dim_semestre s ON tri.id_semestre = s.id_semestre
WHERE t.anio = s.id_anio AND t.trimestre = tri.numero_trimestre;

ALTER TABLE dim_tiempo ALTER COLUMN id_trimestre SET NOT NULL;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tiempo_trimestre') THEN
        ALTER TABLE dim_tiempo ADD CONSTRAINT fk_tiempo_trimestre 
        FOREIGN KEY (id_trimestre) REFERENCES dim_trimestre(id_trimestre) ON DELETE RESTRICT;
    END IF;
END $$;


-- 4. RAMA GEOGRÁFICA (dim_macroregion -> dim_departamento -> dim_provincia)
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

ALTER TABLE dim_ubicacion ADD COLUMN IF NOT EXISTS id_provincia INT;

INSERT INTO dim_macroregion (nombre_macroregion)
SELECT DISTINCT macroregion FROM dim_ubicacion
ON CONFLICT (nombre_macroregion) DO NOTHING;

INSERT INTO dim_departamento (nombre_departamento, id_macroregion)
SELECT DISTINCT u.departamento, m.id_macroregion
FROM dim_ubicacion u
JOIN dim_macroregion m ON u.macroregion = m.nombre_macroregion
ON CONFLICT (nombre_departamento) DO NOTHING;

INSERT INTO dim_provincia (nombre_provincia, id_departamento)
SELECT DISTINCT u.provincia, d.id_departamento
FROM dim_ubicacion u
JOIN dim_departamento d ON u.departamento = d.nombre_departamento
ON CONFLICT (id_departamento, nombre_provincia) DO NOTHING;

UPDATE dim_ubicacion u
SET id_provincia = p.id_provincia
FROM dim_provincia p
JOIN dim_departamento d ON p.id_departamento = d.id_departamento
WHERE u.departamento = d.nombre_departamento 
  AND u.provincia = p.nombre_provincia;

ALTER TABLE dim_ubicacion ALTER COLUMN id_provincia SET NOT NULL;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ubicacion_provincia') THEN
        ALTER TABLE dim_ubicacion ADD CONSTRAINT fk_ubicacion_provincia 
        FOREIGN KEY (id_provincia) REFERENCES dim_provincia(id_provincia) ON DELETE RESTRICT;
    END IF;
END $$;

COMMIT;
