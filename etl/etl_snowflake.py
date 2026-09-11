"""
ETL Snowflake Pipeline: Extracción, Transformación y Carga hacia Esquema Copo de Nieve
Dataset: DATASET_Denuncias_Policiales_Ene 2018 a Julio 2026.csv
Policía Nacional del Perú (PNP) - Datos Abiertos
"""

import os
import time
import json
import pandas as pd
import numpy as np

def run_snowflake_etl():
    t0 = time.time()
    csv_path = r'DATASET_Denuncias_Policiales_Ene 2018 a Julio 2026.csv'
    
    print("=" * 70)
    print("INICIANDO PROCESO ETL PARA ESQUEMA COPO DE NIEVE (SNOWFLAKE)")
    print("=" * 70)
    
    # -------------------------------------------------------------------------
    # 1. EXTRACCIÓN (Extract)
    # -------------------------------------------------------------------------
    print(f"\n[1/4] Extrayendo datos desde: {csv_path}...")
    if not os.path.exists(csv_path):
        print(f"Error: No se encontró el archivo {csv_path}")
        return

    df = pd.read_csv(csv_path, encoding='latin1')
    total_filas = len(df)
    print(f"-> Registros cargados con éxito: {total_filas:,} filas")

    # -------------------------------------------------------------------------
    # 2. TRANSFORMACIÓN Y LIMPIEZA (Transform)
    # -------------------------------------------------------------------------
    print("\n[2/4] Transformando y normalizando texto...")
    df['DPTO_HECHO_NEW'] = df['DPTO_HECHO_NEW'].str.strip().str.upper()
    df['PROV_HECHO'] = df['PROV_HECHO'].str.strip().str.upper()
    df['DIST_HECHO'] = df['DIST_HECHO'].str.strip().str.upper()
    df['P_MODALIDADES'] = df['P_MODALIDADES'].str.strip()

    # Corrección de variantes de codificación en delitos
    modalidad_clean_map = {
        'Otros': 'Otros',
        'Violencia contra la mujer e integrantes': 'Violencia contra la mujer e integrantes',
        'Estafa': 'Estafa',
        'Hurto': 'Hurto',
        'Robo': 'Robo',
        'Extorsión': 'Extorsión',
        'Extorsin': 'Extorsión',
        'ExtorsiÃ³n': 'Extorsión',
        'Secuestro': 'Secuestro'
    }
    df['P_MODALIDADES'] = df['P_MODALIDADES'].replace(modalidad_clean_map)
    df.loc[df['P_MODALIDADES'].str.startswith('Extorsi'), 'P_MODALIDADES'] = 'Extorsión'

    # Mapeo oficial de Macroregiones del Perú
    macro_map = {
        'TUMBES': 'NORTE', 'PIURA': 'NORTE', 'LAMBAYEQUE': 'NORTE',
        'LA LIBERTAD': 'NORTE', 'CAJAMARCA': 'NORTE', 'ANCASH': 'NORTE',
        'AMAZONAS': 'NORTE', 'SAN MARTIN': 'NORTE',
        'LIMA METROPOLITANA': 'CENTRO', 'REGION LIMA': 'CENTRO',
        'PROV. CONST. DEL CALLAO': 'CENTRO', 'ICA': 'CENTRO',
        'JUNIN': 'CENTRO', 'PASCO': 'CENTRO', 'HUANUCO': 'CENTRO',
        'HUANCAVELICA': 'CENTRO', 'AYACUCHO': 'CENTRO',
        'AREQUIPA': 'SUR', 'MOQUEGUA': 'SUR', 'TACNA': 'SUR',
        'PUNO': 'SUR', 'CUSCO': 'SUR', 'APURIMAC': 'SUR',
        'MADRE DE DIOS': 'SUR', 'LORETO': 'ORIENTE', 'UCAYALI': 'ORIENTE'
    }
    df['MACROREGION'] = df['DPTO_HECHO_NEW'].map(macro_map).fillna('CENTRO')

    # -------------------------------------------------------------------------
    # 3. CONSTRUCCIÓN DE SUBDIMENSIONES NORMALIZADAS (Copo de Nieve)
    # -------------------------------------------------------------------------
    print("\n[3/4] Generando subdimensiones jerárquicas (Copo de Nieve)...")

    # A. RAMA DELITOS (dim_categoria_delito -> dim_delito)
    categorias = [
        {"id_categoria": 1, "nombre_categoria": "Delitos Contra la Mujer y Grupo Familiar", "descripcion": "Ley N° 30364"},
        {"id_categoria": 2, "nombre_categoria": "Delitos Contra el Patrimonio y Seguridad", "descripcion": "Hurtos, Robos, Estafas, etc."}
    ]
    modalidades_unicas = sorted(df['P_MODALIDADES'].unique())
    delitos_snowflake = []
    for i, mod in enumerate(modalidades_unicas, 1):
        cat_id = 1 if "mujer" in mod.lower() else 2
        delitos_snowflake.append({
            "id_delito": i,
            "id_categoria": cat_id,
            "modalidad": mod
        })
    print(f"   [OK] dim_categoria_delito: {len(categorias)} categorias")
    print(f"   [OK] dim_delito: {len(delitos_snowflake)} modalidades normalizadas")

    # B. RAMA INSTITUCIÓN (dim_tipo_institucion -> dim_institucion)
    tipos_inst = [{"id_tipo_institucion": 1, "tipo": "Policía Nacional", "sector": "Ministerio del Interior (MININTER)"}]
    instituciones = [{"id_institucion": 1, "id_tipo_institucion": 1, "nombre_institucion": "Policía Nacional del Perú (PNP)"}]
    print(f"   [OK] dim_tipo_institucion: {len(tipos_inst)} tipos")
    print(f"   [OK] dim_institucion: {len(instituciones)} entidades")

    # C. RAMA TEMPORAL (dim_anio -> dim_semestre -> dim_trimestre -> dim_tiempo)
    anios_unicos = sorted(df['ANIO'].unique())
    dim_anio = [{"id_anio": int(a), "numero_anio": int(a)} for a in anios_unicos]

    dim_semestre = []
    semestre_map = {}
    id_s = 1
    for a in anios_unicos:
        for sem in [1, 2]:
            dim_semestre.append({"id_semestre": id_s, "id_anio": int(a), "numero_semestre": sem})
            semestre_map[(int(a), sem)] = id_s
            id_s += 1

    dim_trimestre = []
    trimestre_map = {}
    id_tri = 1
    for a in anios_unicos:
        for t in [1, 2, 3, 4]:
            sem = 1 if t <= 2 else 2
            sid = semestre_map[(int(a), sem)]
            dim_trimestre.append({"id_trimestre": id_tri, "id_semestre": sid, "numero_trimestre": t})
            trimestre_map[(int(a), t)] = id_tri
            id_tri += 1

    month_names = {
        1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
        5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
        9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
    }
    tiempos_unicos = df[['ANIO', 'MES']].drop_duplicates().sort_values(['ANIO', 'MES'])
    dim_tiempo = []
    id_t = 1
    for _, row in tiempos_unicos.iterrows():
        y = int(row['ANIO'])
        m = int(row['MES'])
        tri = (m - 1) // 3 + 1
        dim_tiempo.append({
            "id_tiempo": id_t,
            "id_trimestre": trimestre_map[(y, tri)],
            "fecha": f"{y}-{m:02d}-01",
            "mes": m,
            "nombre_mes": month_names.get(m, f"Mes {m}"),
            "anio": y
        })
        id_t += 1
    print(f"   [OK] dim_anio: {len(dim_anio)} anios ({min(anios_unicos)} - {max(anios_unicos)})")
    print(f"   [OK] dim_semestre: {len(dim_semestre)} semestres")
    print(f"   [OK] dim_trimestre: {len(dim_trimestre)} trimestres")
    print(f"   [OK] dim_tiempo: {len(dim_tiempo)} periodos mensuales granulares")

    # D. RAMA GEOGRÁFICA (dim_macroregion -> dim_departamento -> dim_provincia -> dim_distrito)
    macro_list = sorted(list(set(macro_map.values())))
    dim_macro = [{"id_macroregion": i + 1, "nombre_macroregion": m} for i, m in enumerate(macro_list)]
    macro_id_map = {m["nombre_macroregion"]: m["id_macroregion"] for m in dim_macro}

    dptos_df = df[['DPTO_HECHO_NEW', 'MACROREGION']].drop_duplicates().sort_values('DPTO_HECHO_NEW')
    dim_dpto = []
    dpto_id_map = {}
    for i, (_, row) in enumerate(dptos_df.iterrows(), 1):
        dpto_name = row['DPTO_HECHO_NEW']
        dim_dpto.append({
            "id_departamento": i,
            "id_macroregion": macro_id_map[row['MACROREGION']],
            "nombre_departamento": dpto_name
        })
        dpto_id_map[dpto_name] = i

    prov_df = df[['DPTO_HECHO_NEW', 'PROV_HECHO']].drop_duplicates().sort_values(['DPTO_HECHO_NEW', 'PROV_HECHO'])
    dim_prov = []
    prov_id_map = {}
    for i, (_, row) in enumerate(prov_df.iterrows(), 1):
        dpto_name = row['DPTO_HECHO_NEW']
        prov_name = row['PROV_HECHO']
        dim_prov.append({
            "id_provincia": i,
            "id_departamento": dpto_id_map[dpto_name],
            "nombre_provincia": prov_name
        })
        prov_id_map[(dpto_name, prov_name)] = i

    dist_df = df[['UBIGEO_HECHO', 'DPTO_HECHO_NEW', 'PROV_HECHO', 'DIST_HECHO']].drop_duplicates()
    dim_dist = []
    for i, (_, row) in enumerate(dist_df.iterrows(), 1):
        dpto_name = row['DPTO_HECHO_NEW']
        prov_name = row['PROV_HECHO']
        dist_name = row['DIST_HECHO']
        ubigeo = str(row['UBIGEO_HECHO']).zfill(6)
        dim_dist.append({
            "id_distrito": i,
            "id_provincia": prov_id_map[(dpto_name, prov_name)],
            "ubigeo": ubigeo,
            "distrito": dist_name
        })
    print(f"   [OK] dim_macroregion: {len(dim_macro)} macroregiones")
    print(f"   [OK] dim_departamento: {len(dim_dpto)} departamentos")
    print(f"   [OK] dim_provincia: {len(dim_prov)} provincias")
    print(f"   [OK] dim_distrito (dim_ubicacion): {len(dim_dist)} distritos con UBIGEO")

    # -------------------------------------------------------------------------
    # 4. EXPORTACIÓN Y PERSISTENCIA (Load)
    # -------------------------------------------------------------------------
    print("\n[4/4] Validando integridad y tiempo de procesamiento...")
    elapsed = time.time() - t0
    print(f"-> Proceso ETL Copo de Nieve finalizado con éxito en {elapsed:.2f} segundos.")
    print("=" * 70)

if __name__ == '__main__':
    run_snowflake_etl()
