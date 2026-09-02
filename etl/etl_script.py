import os
import pandas as pd
import numpy as np
import json

# Define Macroregions based on Official Peruvian Geographical Regions
MACRO_MAP = {
    # NORTE
    'TUMBES': 'NORTE',
    'PIURA': 'NORTE',
    'LAMBAYEQUE': 'NORTE',
    'LA LIBERTAD': 'NORTE',
    'CAJAMARCA': 'NORTE',
    'ANCASH': 'NORTE',
    
    # CENTRO
    'LIMA METROPOLITANA': 'CENTRO',
    'REGION LIMA': 'CENTRO',
    'PROV. CONST. DEL CALLAO': 'CENTRO',
    'ICA': 'CENTRO',
    'JUNIN': 'CENTRO',
    'PASCO': 'CENTRO',
    'HUANUCO': 'CENTRO',
    'HUANCAVELICA': 'CENTRO',
    'AYACUCHO': 'CENTRO',
    
    # SUR
    'AREQUIPA': 'SUR',
    'MOQUEGUA': 'SUR',
    'TACNA': 'SUR',
    'PUNO': 'SUR',
    'CUSCO': 'SUR',
    'APURIMAC': 'SUR',
    
    # ORIENTE
    'LORETO': 'ORIENTE',
    'SAN MARTIN': 'ORIENTE',
    'AMAZONAS': 'ORIENTE',
    'UCAYALI': 'ORIENTE',
    'MADRE DE DIOS': 'ORIENTE'
}

MONTH_NAMES = {
    1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
    5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
    9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
}

MODALIDAD_CLEAN_MAP = {
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

def escape_sql(val):
    if val is None:
        return 'NULL'
    val_str = str(val).replace("'", "''")
    return f"'{val_str}'"

def run_etl():
    csv_path = r'c:\Users\fabri\Downloads\GestionDeConocimientos\DATASET_Denuncias_Policiales_Ene 2018 a Julio 2026.csv'
    print(f"Loading dataset from {csv_path}...")
    
    df = pd.read_csv(csv_path, encoding='latin1')
    print(f"Total rows loaded: {len(df)}")
    
    # Clean text values
    df['DPTO_HECHO_NEW'] = df['DPTO_HECHO_NEW'].str.strip().str.upper()
    df['PROV_HECHO'] = df['PROV_HECHO'].str.strip().str.upper()
    df['DIST_HECHO'] = df['DIST_HECHO'].str.strip().str.upper()
    df['P_MODALIDADES'] = df['P_MODALIDADES'].str.strip()
    
    # Replace any corrupt Extorsión variant
    df['P_MODALIDADES'] = df['P_MODALIDADES'].replace(MODALIDAD_CLEAN_MAP)
    df.loc[df['P_MODALIDADES'].str.startswith('Extorsi'), 'P_MODALIDADES'] = 'Extorsión'
    
    # Map Macroregion
    df['MACROREGION'] = df['DPTO_HECHO_NEW'].map(MACRO_MAP).fillna('CENTRO')
    
    print("Extracting dimensions...")
    
    # 1. Dim Tiempo
    time_tuples = df[['ANIO', 'MES']].drop_duplicates().sort_values(['ANIO', 'MES'])
    dim_tiempo_list = []
    time_map = {}
    
    id_t = 1
    for _, row in time_tuples.iterrows():
        anio = int(row['ANIO'])
        mes = int(row['MES'])
        nombre_mes = MONTH_NAMES.get(mes, f"Mes {mes}")
        trimestre = (mes - 1) // 3 + 1
        semestre = 1 if mes <= 6 else 2
        fecha_str = f"{anio}-{mes:02d}-01"
        
        dim_tiempo_list.append({
            'id_tiempo': id_t,
            'fecha': fecha_str,
            'anio': anio,
            'mes': mes,
            'nombre_mes': nombre_mes,
            'trimestre': trimestre,
            'semestre': semestre
        })
        time_map[(anio, mes)] = id_t
        id_t += 1
        
    print(f"dim_tiempo count: {len(dim_tiempo_list)}")
    
    # 2. Dim Ubicacion
    ubic_tuples = df[['UBIGEO_HECHO', 'DPTO_HECHO_NEW', 'PROV_HECHO', 'DIST_HECHO', 'MACROREGION']].drop_duplicates()
    dim_ubic_list = []
    ubic_map = {}
    
    id_u = 1
    for _, row in ubic_tuples.iterrows():
        ubigeo = str(row['UBIGEO_HECHO']).zfill(6)
        dpto = str(row['DPTO_HECHO_NEW'])
        prov = str(row['PROV_HECHO'])
        dist = str(row['DIST_HECHO'])
        macro = str(row['MACROREGION'])
        
        dim_ubic_list.append({
            'id_ubicacion': id_u,
            'ubigeo': ubigeo,
            'departamento': dpto,
            'provincia': prov,
            'distrito': dist,
            'macroregion': macro
        })
        ubic_map[(row['UBIGEO_HECHO'], dpto, prov, dist)] = id_u
        id_u += 1
        
    print(f"dim_ubicacion count: {len(dim_ubic_list)}")
    
    # 3. Dim Delito
    delito_unique = sorted(df['P_MODALIDADES'].unique())
    dim_delito_list = []
    delito_map = {}
    
    id_d = 1
    for mod in delito_unique:
        cat = "Delitos Contra la Mujer y Grupo Familiar" if "mujer" in mod.lower() else "Delitos Contra el Patrimonio y Seguridad"
        dim_delito_list.append({
            'id_delito': id_d,
            'modalidad': mod,
            'categoria': cat,
            'descripcion': f"Modalidad delictiva registrada según la PNP: {mod}"
        })
        delito_map[mod] = id_d
        id_d += 1
        
    print(f"dim_delito count: {len(dim_delito_list)}")
    
    # 4. Dim Institucion
    dim_inst_list = [{
        'id_institucion': 1,
        'nombre_institucion': 'Policía Nacional del Perú (PNP)',
        'tipo': 'Policía Nacional',
        'descripcion': 'Entidad pública responsable del registro nacional de denuncias policiales en el Perú.'
    }]
    
    # Generate SQL Seed File
    sql_seed_path = r'c:\Users\fabri\Downloads\GestionDeConocimientos\sql\09_seed_dimensions.sql'
    with open(sql_seed_path, 'w', encoding='utf-8') as f:
        f.write("-- Seed Data for Dimensions\n")
        f.write("BEGIN;\n\n")
        
        f.write("-- Insert Dim Tiempo\n")
        for t in dim_tiempo_list:
            f.write(f"INSERT INTO dim_tiempo (id_tiempo, fecha, anio, mes, nombre_mes, trimestre, semestre) VALUES ({t['id_tiempo']}, '{t['fecha']}', {t['anio']}, {t['mes']}, '{t['nombre_mes']}', {t['trimestre']}, {t['semestre']}) ON CONFLICT DO NOTHING;\n")
            
        f.write("\n-- Insert Dim Ubicacion\n")
        for u in dim_ubic_list:
            f.write(f"INSERT INTO dim_ubicacion (id_ubicacion, ubigeo, departamento, provincia, distrito, macroregion) VALUES ({u['id_ubicacion']}, '{u['ubigeo']}', {escape_sql(u['departamento'])}, {escape_sql(u['provincia'])}, {escape_sql(u['distrito'])}, '{u['macroregion']}') ON CONFLICT DO NOTHING;\n")
            
        f.write("\nCOMMIT;\n")
    print(f"Saved dimension seed SQL to {sql_seed_path}")

    # Generate aggregated structures for Frontend fast caching & analysis
    print("Generating pre-calculated aggregates for client dashboard...")
    
    total_complaints = int(df['cantidad'].sum())
    total_records = len(df)
    unique_depts = sorted(df['DPTO_HECHO_NEW'].unique().tolist())
    unique_provs = sorted(df['PROV_HECHO'].unique().tolist())
    unique_dists = sorted(df['DIST_HECHO'].unique().tolist())
    unique_delitos = sorted(df['P_MODALIDADES'].unique().tolist())
    years = sorted(df['ANIO'].unique().tolist())
    
    hierarchy = {}
    for _, row in df[['DPTO_HECHO_NEW', 'PROV_HECHO', 'DIST_HECHO']].drop_duplicates().iterrows():
        dpto = row['DPTO_HECHO_NEW']
        prov = row['PROV_HECHO']
        dist = row['DIST_HECHO']
        
        if dpto not in hierarchy:
            hierarchy[dpto] = {}
        if prov not in hierarchy[dpto]:
            hierarchy[dpto][prov] = []
        if dist not in hierarchy[dpto][prov]:
            hierarchy[dpto][prov].append(dist)
            
    for dpto in hierarchy:
        for prov in hierarchy[dpto]:
            hierarchy[dpto][prov].sort()
            
    by_year_month = df.groupby(['ANIO', 'MES'])['cantidad'].sum().reset_index()
    by_year_month_list = by_year_month.to_dict(orient='records')
    
    by_dept = df.groupby('DPTO_HECHO_NEW')['cantidad'].sum().reset_index().sort_values('cantidad', ascending=False)
    by_dept_list = by_dept.to_dict(orient='records')
    
    by_delito = df.groupby('P_MODALIDADES')['cantidad'].sum().reset_index().sort_values('cantidad', ascending=False)
    by_delito_list = by_delito.to_dict(orient='records')
    
    by_macro = df.groupby('MACROREGION')['cantidad'].sum().reset_index().sort_values('cantidad', ascending=False)
    by_macro_list = by_macro.to_dict(orient='records')
    
    by_year = df.groupby('ANIO')['cantidad'].sum().reset_index().sort_values('ANIO')
    by_year_list = by_year.to_dict(orient='records')
    
    by_dist = df.groupby(['DPTO_HECHO_NEW', 'PROV_HECHO', 'DIST_HECHO'])['cantidad'].sum().reset_index().sort_values('cantidad', ascending=False)
    top_dists_list = by_dist.head(50).to_dict(orient='records')
    
    sample_table = df.sample(min(200, len(df)), random_state=42).to_dict(orient='records')
    
    fragments_summary = {}
    for macro in ['NORTE', 'CENTRO', 'SUR', 'ORIENTE']:
        sub = df[df['MACROREGION'] == macro]
        depts = sorted(sub['DPTO_HECHO_NEW'].unique().tolist())
        cnt = int(sub['cantidad'].sum())
        rec = len(sub)
        sample_frag = sub.sample(min(15, len(sub)), random_state=42).to_dict(orient='records')
        fragments_summary[macro] = {
            'criterio': f'Departamentos correspondientes a la Macroregión {macro}',
            'departamentos': depts,
            'total_denuncias': cnt,
            'total_registros': rec,
            'sample_data': sample_frag
        }
        
    dataset_export = {
        'metadata': {
            'fuente': 'Portal Nacional de Datos Abiertos del Estado Peruano',
            'periodo': 'Enero 2018 - Julio 2026',
            'total_denuncias': total_complaints,
            'total_registros': total_records,
            'total_departamentos': len(unique_depts),
            'total_provincias': len(unique_provs),
            'total_distritos': len(unique_dists),
            'total_delitos': len(unique_delitos),
            'anios': years
        },
        'dimensions': {
            'tiempo': dim_tiempo_list,
            'ubicacion': dim_ubic_list,
            'delito': dim_delito_list,
            'institucion': dim_inst_list
        },
        'hierarchy': hierarchy,
        'aggregations': {
            'by_year_month': by_year_month_list,
            'by_dept': by_dept_list,
            'by_delito': by_delito_list,
            'by_macro': by_macro_list,
            'by_year': by_year_list,
            'top_distritos': top_dists_list
        },
        'fragments_summary': fragments_summary,
        'sample_table': sample_table
    }
    
    output_js_path = r'c:\Users\fabri\Downloads\GestionDeConocimientos\js\dataset-data.js'
    os.makedirs(os.path.dirname(output_js_path), exist_ok=True)
    with open(output_js_path, 'w', encoding='utf-8') as f:
        f.write(f"window.SEGURIDAD_DATASET = {json.dumps(dataset_export, ensure_ascii=False, indent=2)};\n")
    print(f"Saved dataset cache to {output_js_path}")

if __name__ == '__main__':
    run_etl()
