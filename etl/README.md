# Proceso ETL - SEGURIDAD PERÚ

## Descripción General
Este módulo contiene las herramientas y documentación para la extracción, transformación y carga (ETL) del dataset oficial de **Denuncias Policiales del Perú (Enero 2018 – Julio 2026)**.

## Fuente de Datos
* **Origen:** Portal Nacional de Datos Abiertos del Estado Peruano (PCM / MININTER).
* **Formato original:** CSV (`DATASET_Denuncias_Policiales_Ene 2018 a Julio 2026.csv`).
* **Registros totales:** 369,100 registros agrupados.
* **Denuncias totales:** 7,359,931 denuncias policiales registradas.
* **Codificación:** `latin1` / `ISO-8859-1` (para la correcta lectura de caracteres en español como "Extorsión").

## Pasos del ETL

1. **Extracción:**
   - Lectura optimizada del archivo CSV respetando la codificación original.
   
2. **Transformación:**
   - **Limpieza:** Normalización de cadenas de texto (mayúsculas, eliminación de espacios en blanco).
   - **Mapeo Geográfico de Macroregiones:**
     * **NORTE:** Tumbes, Piura, Lambayeque, La Libertad, Cajamarca, Ancash.
     * **CENTRO:** Lima Metropolitana, Región Lima, Prov. Const. del Callao, Ica, Junín, Pasco, Huánuco, Huancavelica, Ayacucho.
     * **SUR:** Arequipa, Moquegua, Tacna, Puno, Cusco, Apurímac.
     * **ORIENTE:** Loreto, San Martín, Amazonas, Ucayali, Madre de Dios.
   - **Construcción de Dimensiones (Modelo Estrella):**
     * `dim_tiempo`: Generación jerárquica (Año, Mes, Nombre Mes, Trimestre, Semestre).
     * `dim_ubicacion`: Jerarquía Departamental -> Provincial -> Distrital con código UBIGEO de 6 dígitos.
     * `dim_delito`: Categorización de modalidades delictivas.
     * `dim_institucion`: Normalización de la entidad emisora (Policía Nacional del Perú).

3. **Carga:**
   - Generación de scripts SQL divididos para Supabase.
   - Generación de caché optimizado `js/dataset-data.js` para visualización inmediata en cliente.

## Ejecución
```bash
python etl/etl_script.py
```
