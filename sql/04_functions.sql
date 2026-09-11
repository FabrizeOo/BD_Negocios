-- ============================================================================
-- PASO 4: 04_functions.sql
-- Funciones RPC para Consultas Rápidas en Supabase (Backend Analítico)
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS fn_get_denuncias_departamento(integer);
DROP FUNCTION IF EXISTS fn_get_evolucion_mensual(integer);
DROP FUNCTION IF EXISTS fn_get_kpis(integer);
DROP FUNCTION IF EXISTS fn_get_fragmento(text);

-- 1. Total de Denuncias por Departamento
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

-- 2. Evolución Mensual Histórica
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

-- 3. KPIs Ejecutivos Consolidados
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

-- 4. Consulta Directa de Fragmento Regional (Partition Pruning)
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
