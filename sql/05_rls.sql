-- ============================================================================
-- PASO 5: 05_rls.sql
-- Row Level Security (RLS) y Políticas de Acceso Público en Supabase
-- ============================================================================

BEGIN;

-- 1. Habilitar RLS en todas las nuevas subdimensiones del Copo de Nieve
ALTER TABLE dim_categoria_delito ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_tipo_institucion ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_anio ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_semestre ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_trimestre ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_macroregion ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_departamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_provincia ENABLE ROW LEVEL SECURITY;

-- 2. Crear políticas de lectura pública (SELECT USING true)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura publica en dim_categoria_delito') THEN
        CREATE POLICY "Permitir lectura publica en dim_categoria_delito" ON dim_categoria_delito FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura publica en dim_tipo_institucion') THEN
        CREATE POLICY "Permitir lectura publica en dim_tipo_institucion" ON dim_tipo_institucion FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura publica en dim_anio') THEN
        CREATE POLICY "Permitir lectura publica en dim_anio" ON dim_anio FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura publica en dim_semestre') THEN
        CREATE POLICY "Permitir lectura publica en dim_semestre" ON dim_semestre FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura publica en dim_trimestre') THEN
        CREATE POLICY "Permitir lectura publica en dim_trimestre" ON dim_trimestre FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura publica en dim_macroregion') THEN
        CREATE POLICY "Permitir lectura publica en dim_macroregion" ON dim_macroregion FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura publica en dim_departamento') THEN
        CREATE POLICY "Permitir lectura publica en dim_departamento" ON dim_departamento FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura publica en dim_provincia') THEN
        CREATE POLICY "Permitir lectura publica en dim_provincia" ON dim_provincia FOR SELECT USING (true);
    END IF;
END $$;

-- 3. Conceder privilegios de acceso (GRANT) a los roles anon y authenticated de Supabase
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;

COMMIT;
