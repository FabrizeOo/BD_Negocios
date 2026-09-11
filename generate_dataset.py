import os
import pandas as pd
import numpy as np
import json
import time

t0 = time.time()
csv_path = 'DATASET_Denuncias_Policiales_Ene 2018 a Julio 2026.csv'
print(f"Loading CSV from {csv_path}...")
df = pd.read_csv(csv_path, encoding='latin1')
print(f"Loaded {len(df)} rows in {time.time()-t0:.2f}s")

# Clean text values
df['DPTO_HECHO_NEW'] = df['DPTO_HECHO_NEW'].str.strip().str.upper()
df['PROV_HECHO'] = df['PROV_HECHO'].str.strip().str.upper()
df['DIST_HECHO'] = df['DIST_HECHO'].str.strip().str.upper()
df['P_MODALIDADES'] = df['P_MODALIDADES'].str.strip()

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
df['P_MODALIDADES'] = df['P_MODALIDADES'].replace(MODALIDAD_CLEAN_MAP)
df.loc[df['P_MODALIDADES'].str.startswith('Extorsi'), 'P_MODALIDADES'] = 'Extorsión'

MACRO_MAP = {
    'TUMBES': 'NORTE', 'PIURA': 'NORTE', 'LAMBAYEQUE': 'NORTE',
    'LA LIBERTAD': 'NORTE', 'CAJAMARCA': 'NORTE', 'ANCASH': 'NORTE',
    'AMAZONAS': 'NORTE', 'SAN MARTIN': 'NORTE',
    'LIMA METROPOLITANA': 'LIMA', 'REGION LIMA': 'LIMA',
    'PROV. CONST. DEL CALLAO': 'LIMA',
    'JUNIN': 'CENTRO', 'PASCO': 'CENTRO', 'HUANUCO': 'CENTRO',
    'HUANCAVELICA': 'CENTRO', 'AYACUCHO': 'CENTRO', 'ICA': 'CENTRO',
    'AREQUIPA': 'SUR', 'MOQUEGUA': 'SUR', 'TACNA': 'SUR',
    'PUNO': 'SUR', 'CUSCO': 'SUR', 'APURIMAC': 'SUR',
    'MADRE DE DIOS': 'SUR', 'LORETO': 'ORIENTE', 'UCAYALI': 'ORIENTE'
}
df['MACROREGION'] = df['DPTO_HECHO_NEW'].map(MACRO_MAP).fillna('CENTRO')

# Dictionaries
dptos = sorted(df['DPTO_HECHO_NEW'].unique().tolist())
provs = sorted(df['PROV_HECHO'].unique().tolist())
dists = sorted(df['DIST_HECHO'].unique().tolist())
delitos = sorted(df['P_MODALIDADES'].unique().tolist())
years = sorted(df['ANIO'].unique().tolist())

dpto_idx = {v: i for i, v in enumerate(dptos)}
prov_idx = {v: i for i, v in enumerate(provs)}
dist_idx = {v: i for i, v in enumerate(dists)}
delito_idx = {v: i for i, v in enumerate(delitos)}

# Macro per department index
dpto_macro_list = [MACRO_MAP.get(d, 'CENTRO') for d in dptos]

# Precompute hierarchy
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

# Precomputed national aggregations
total_complaints = int(df['cantidad'].sum())
total_records = len(df)

by_year_month = df.groupby(['ANIO', 'MES'])['cantidad'].sum().reset_index().to_dict(orient='records')
by_dept = df.groupby('DPTO_HECHO_NEW')['cantidad'].sum().reset_index().sort_values('cantidad', ascending=False).to_dict(orient='records')
by_delito = df.groupby('P_MODALIDADES')['cantidad'].sum().reset_index().sort_values('cantidad', ascending=False).to_dict(orient='records')
by_macro = df.groupby('MACROREGION')['cantidad'].sum().reset_index().sort_values('cantidad', ascending=False).to_dict(orient='records')
by_year = df.groupby('ANIO')['cantidad'].sum().reset_index().sort_values('ANIO').to_dict(orient='records')
by_dist = df.groupby(['DPTO_HECHO_NEW', 'PROV_HECHO', 'DIST_HECHO'])['cantidad'].sum().reset_index().sort_values('cantidad', ascending=False)
top_distritos = by_dist.head(50).to_dict(orient='records')

MONTH_NAMES = {
    1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
    5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
    9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
}
dim_tiempo = []
id_t = 1
for _, row in df[['ANIO', 'MES']].drop_duplicates().sort_values(['ANIO', 'MES']).iterrows():
    y = int(row['ANIO'])
    m = int(row['MES'])
    dim_tiempo.append({
        'id_tiempo': id_t,
        'fecha': f"{y}-{m:02d}-01",
        'anio': y,
        'mes': m,
        'nombre_mes': MONTH_NAMES.get(m, f"Mes {m}"),
        'trimestre': (m - 1) // 3 + 1,
        'semestre': 1 if m <= 6 else 2
    })
    id_t += 1

dim_delito = []
for i, d in enumerate(delitos):
    cat = "Delitos Contra la Mujer y Grupo Familiar" if "mujer" in d.lower() else "Delitos Contra el Patrimonio y Seguridad"
    dim_delito.append({
        'id_delito': i + 1,
        'modalidad': d,
        'categoria': cat,
        'descripcion': f"Modalidad delictiva registrada según la PNP: {d}"
    })

# Compact records: [anio, mes, dpto_i, prov_i, dist_i, delito_i, cant]
print("Building compact records array...")
anios_arr = df['ANIO'].astype(int).tolist()
mes_arr = df['MES'].astype(int).tolist()
dpto_i_arr = df['DPTO_HECHO_NEW'].map(dpto_idx).tolist()
prov_i_arr = df['PROV_HECHO'].map(prov_idx).tolist()
dist_i_arr = df['DIST_HECHO'].map(dist_idx).tolist()
delito_i_arr = df['P_MODALIDADES'].map(delito_idx).tolist()
cant_arr = df['cantidad'].astype(int).tolist()

compact_records = list(zip(anios_arr, mes_arr, dpto_i_arr, prov_i_arr, dist_i_arr, delito_i_arr, cant_arr))
print(f"Generated {len(compact_records)} compact records in {time.time()-t0:.2f}s")

dataset_export = {
    'metadata': {
        'fuente': 'Portal Nacional de Datos Abiertos del Estado Peruano',
        'periodo': 'Enero 2018 - Julio 2026',
        'total_denuncias': total_complaints,
        'total_registros': total_records,
        'total_departamentos': len(dptos),
        'total_provincias': len(provs),
        'total_distritos': len(dists),
        'total_delitos': len(delitos),
        'anios': years
    },
    'dimensions': {
        'tiempo': dim_tiempo,
        'delito': dim_delito
    },
    'hierarchy': hierarchy,
    'macro_map': MACRO_MAP,
    'dpto_macros': dpto_macro_list,
    'aggregations': {
        'by_year_month': by_year_month,
        'by_dept': by_dept,
        'by_delito': by_delito,
        'by_macro': by_macro,
        'by_year': by_year,
        'top_distritos': top_distritos
    },
    'dictionaries': {
        'dptos': dptos,
        'provs': provs,
        'dists': dists,
        'delitos': delitos
    },
    'records': compact_records
}

out_path = r'c:\Users\fabri\Downloads\GestionDeConocimientos\js\dataset-data.js'
print(f"Serializing and writing to {out_path}...")
with open(out_path, 'w', encoding='utf-8') as f:
    f.write("window.SEGURIDAD_DATASET = ")
    json.dump(dataset_export, f, ensure_ascii=False, separators=(',', ':'))
    f.write(";\n")

file_size = os.path.getsize(out_path) / (1024 * 1024)
print(f"SUCCESS! Wrote {out_path} ({file_size:.2f} MB) in {time.time()-t0:.2f}s")
