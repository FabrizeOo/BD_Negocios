# SEGURIDAD PERÚ — Sistema de Análisis de Denuncias Policiales

**Sistema de Análisis y Visualización de Denuncias Policiales del Perú (Enero 2018 – Julio 2026)**

---

## 1. Descripción del Proyecto
**SEGURIDAD PERÚ** es una plataforma web profesional desarrollada para el análisis, distribución y visualización de grandes volúmenes de datos correspondientes a las denuncias policiales registradas a nivel nacional por la Policía Nacional del Perú (PNP) entre **Enero de 2018 y Julio de 2026**.

El sistema integra un backend en **PostgreSQL / Supabase** estructurado mediante un **Modelo Dimensional (Esquema Estrella)** y **Fragmentación Horizontal por Macroregiones**, junto con un frontend moderno e interactivo tipo **Power BI** en HTML5, CSS3, JavaScript (Chart.js y Leaflet.js).

---

## 2. Problemática
El Estado peruano genera continuamente grandes volúmenes de información referente a denuncias policiales a nivel nacional. Estos registros contienen atributos temporales y geográficos de alta densidad.

A medida que el volumen histórico aumenta (más de 7.3 millones de denuncias consolidadas en 369,100 filas agrupadas), las consultas analíticas que combinan múltiples dimensiones (Departamento, Provincia, Distrito, Año, Mes y Modalidad delictiva) sufren degradaciones de rendimiento si no se cuenta con una arquitectura adecuada de almacenamiento, indexación y particionamiento.

**Pregunta central del proyecto:**
> *"¿Cómo diseñar una arquitectura de base de datos que permita almacenar, distribuir y consultar eficientemente grandes volúmenes de información de denuncias policiales del Perú, facilitando su análisis mediante un dashboard interactivo?"*

---

## 3. Arquitectura del Sistema
```text
DATASET OFICIAL (CSV - Datos Abiertos PNP)
                   │
                   ▼
        PROCESO ETL (Python)
                   │
                   ▼
      POSTGRESQL / SUPABASE (PostgreSQL 15+)
   ┌───────────────┼───────────────┐
   ▼               ▼               ▼
MODELO ESTRELLA  FRAGMENTACIÓN   VISTAS Y RPC
(fact_denuncias) HORIZONTAL      (vw_denuncias_global)
                   │
                   ▼
        DASHBOARD & FRONTEND WEB
   ┌───────────────┼───────────────┬───────────────┐
   ▼               ▼               ▼               ▼
DASHBOARD BI   CONSULTAS SQL    ARQUITECTURA DB    MAPA GEOGRÁFICO
(Power BI Style) (Center 10 Queries) (Visual Star) (Leaflet Heatmap)
```

---

## 4. Modelo de Datos (Esquema Estrella)

El modelo dimensional se compone de una tabla central de hechos y 4 dimensiones:

### Tabla de Hechos: `fact_denuncias`
* `id_denuncia` (BIGINT PK)
* `id_tiempo` (INT FK -> `dim_tiempo`)
* `id_ubicacion` (INT FK -> `dim_ubicacion`)
* `id_delito` (INT FK -> `dim_delito`)
* `id_institucion` (INT FK -> `dim_institucion`)
* `cantidad_denuncias` (INT Métrica principal)
* `macroregion` (VARCHAR)

### Dimensiones:
1. **`dim_tiempo`**: Contiene `id_tiempo`, `fecha`, `anio`, `mes`, `nombre_mes`, `trimestre`, `semestre`.
2. **`dim_ubicacion`**: Contiene `id_ubicacion`, `ubigeo`, `departamento`, `provincia`, `distrito`, `macroregion`.
3. **`dim_delito`**: Contiene `id_delito`, `modalidad` (*Otros*, *Violencia contra la mujer*, *Estafa*, *Hurto*, *Robo*, *Extorsión*, *Secuestro*), `categoria`, `descripcion`.
4. **`dim_institucion`**: Contiene `id_institucion`, `nombre_institucion` (*Policía Nacional del Perú - PNP*), `tipo`, `descripcion`.

---

## 5. Topología y Fragmentación Horizontal

Para optimizar el rendimiento y aislar cargas de trabajo regionales, la tabla de hechos se dividió conceptual y físicamente en **4 Fragmentos Horizontales**:

```text
                     FACT_DENUNCIAS
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
FACT_DENUNCIAS_NORTE FACT_DENUNCIAS_CENTRO FACT_DENUNCIAS_SUR
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                 FACT_DENUNCIAS_ORIENTE
```

* **`fact_denuncias_norte`**: Tumbes, Piura, Lambayeque, La Libertad, Cajamarca, Ancash.
* **`fact_denuncias_centro`**: Lima Metropolitana, Región Lima, Callao, Ica, Junín, Pasco, Huánuco, Huancavelica, Ayacucho.
* **`fact_denuncias_sur`**: Arequipa, Moquegua, Tacna, Puno, Cusco, Apurímac.
* **`fact_denuncias_oriente`**: Loreto, San Martín, Amazonas, Ucayali, Madre de Dios.

**Vista Global Consolidada:**
```sql
CREATE VIEW vw_denuncias_global AS
SELECT * FROM fact_denuncias_norte
UNION ALL
SELECT * FROM fact_denuncias_centro
UNION ALL
SELECT * FROM fact_denuncias_sur
UNION ALL
SELECT * FROM fact_denuncias_oriente;
```

---

## 6. Justificación Técnica
1. **Esquema Estrella:** Reduce la complejidad de los JOINs y optimiza consultas de agregación (SUM, COUNT, GROUP BY).
2. **Fragmentación Horizontal:** Permite realizar *Partition Pruning*, acelerando consultas regionales sin necesidad de escanear el dataset completo.
3. **Índices B-Tree Estratégicos:** Creados sobre `anio`, `mes`, `departamento`, `provincia`, `distrito` y FKs para reducir el costo de lectura en disco.

---

## 7. Instalación y Requisitos
* Python 3.8+ (con `pandas` y `numpy`)
* Servidor HTTP local (e.g. VS Code Live Server, `python -m http.server`, o Apache/Nginx)
* Cuenta en Supabase o PostgreSQL 15+

---

## 8. Configuración de Supabase
1. Inicie sesión en [Supabase Console](https://supabase.com/).
2. Cree un proyecto llamado `seguridad-peru`.
3. Vaya al **SQL Editor** de Supabase y ejecute secuencialmente los scripts ubicados en la carpeta `/sql`.

---

## 9. Importación del CSV y Ejecución del ETL
El dataset original se ubica en la raíz del proyecto:
`DATASET_Denuncias_Policiales_Ene 2018 a Julio 2026.csv`

Para procesar y extraer las dimensiones:
```bash
python etl/etl_script.py
```
Este comando generará:
* `sql/09_seed_dimensions.sql`: Script de inserción masiva para las dimensiones.
* `js/dataset-data.js`: Caché del dataset en cliente para fallback offline de alto rendimiento.

---

## 10. Ejecución del SQL en Supabase
Ejecute los scripts en el siguiente orden estricto desde el SQL Editor:
1. `sql/01_schema.sql`
2. `sql/02_dimensions.sql`
3. `sql/03_fact.sql`
4. `sql/04_fragmentacion.sql`
5. `sql/05_views.sql`
6. `sql/06_indexes.sql`
7. `sql/07_functions.sql`
8. `sql/08_rls.sql`
9. `sql/09_seed_dimensions.sql`

---

## 11. Configuración de Variables de Entorno
Copie `.env.example` a `.env`:
```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key_aqui
GEMINI_API_KEY=tu_gemini_api_key
GOOGLE_MAPS_API_KEY=tu_google_maps_key
```

---

## 12. Ejecución del Frontend
Inicie un servidor web estático local:
```bash
python -m http.server 8000
```
O abra directamente `index.html` en cualquier navegador web moderno.

---

## 13. Explicación de las Consultas SQL (`consultas.html`)
El **Centro de Consultas** incluye 10 consultas preparadas:
1. **Denuncias por departamento:** Agregación general por regiones.
2. **Top 10 departamentos:** Identificación de focos regionales de incidencia.
3. **Top 10 distritos:** Ranking de distritos más críticos a nivel nacional.
4. **Tipos de hecho más frecuentes:** Clasificación por modalidad delictiva.
5. **Evolución anual:** Tendencia interanual 2018-2026.
6. **Evolución mensual:** Comportamiento mensual serie histórica.
7. **Comparación regional:** Comparativa directa (e.g. Lima vs Arequipa vs La Libertad).
8. **Consulta por rango de fechas:** Filtrado temporal específico.
9. **Consulta distrital específica:** Análisis detallado de San Juan de Lurigancho.
10. **Consulta de fragmento específico:** Consulta a `fact_denuncias_norte` demostrando la fragmentación horizontal.

---

## 14. Explicación de la Fragmentación
Cada fragmento cuenta con restricciones `CHECK (macroregion = 'NORTE')`, permitiendo que el optimizador de consultas de PostgreSQL descarte fragmentos irrelevantes durante la ejecución (*Partition Pruning*).

---

## 15. Limitaciones del Dataset
* Los datos corresponden a registros históricos consolidados acumulados por la PNP y no a un feed en tiempo real.
* El dataset no cuenta con coordenadas de latitud/longitud exactas por evento, por lo que la visualización geográfica se realiza mediante códigos **UBIGEO** y centroides departamentales/provinciales oficiales.

---

## 16. Funcionalidades Futuras
* **Gemini AI Service (`js/gemini-service.js`):** Arquitectura preparada para convertir preguntas en lenguaje natural a consultas SQL filtradas en Supabase (NL2SQL).
* **Google Maps API (`js/google-maps-service.js`):** Módulo listo para geolocalización de alta precisión y cálculo de rutas hacia comisarías.
