# Gabura LULC Change (Google Earth Engine)

Google Earth Engine workflow for mapping land use and land cover (LULC) change in Gabura Union, Satkhira, in coastal southwest Bangladesh, from 1991 to 2026. It builds dry and monsoon season composites from Landsat and Sentinel-2, adds spectral indices, classifies five land cover classes with Random Forest, assesses accuracy, and runs post-classification change detection to track rice-shrimp-rice transitions.

## Repository contents

| File | What it does |
|---|---|
| `scripts/01_lulc_classification_pipeline.js` | Full workflow, Steps 1 to 7: image collections, cloud masking, composites, spectral indices, Random Forest classification, area per class, change detection and exports. |
| `scripts/02_results_tables_figures.js` | Extended version of Steps 4 to 7 that builds the results tables and figures (accuracy, area, transition matrices, change map, index trends) and exports them as CSV and GeoTIFF. Run it after Steps 1 to 3 of script 01, in place of that script's Steps 4 to 7. |

## Data

| Year | Sensor | Dry season composite | Monsoon composite | Classified |
|---|---|---|---|---|
| 1991 | Landsat 5 | Dec 1990 to Mar 1991 | Jul to Nov 1991 | Yes |
| 2001 | Landsat 5 | Dec 2000 to Mar 2001 | Jul to Nov 2001 | Yes |
| 2008 | Landsat 5 | Dec 2007 to Mar 2008 | Jul to Nov 2008 | Indices only |
| 2010 | Landsat 5 | Dec 2009 to Mar 2010 | Aug to Oct 2010 | Yes |
| 2014 | Landsat 8 | Dec 2013 to Mar 2014 | Aug to Oct 2014 | Indices only |
| 2018 | Sentinel-2 | Dec 2017 to Mar 2018 | Aug to Oct 2018 | Yes |
| 2022 | Sentinel-2 | Dec 2021 to Mar 2022 | Aug to Oct 2022 | Indices only |
| 2024 | Sentinel-2 | Dec 2023 to Mar 2024 | Aug to Oct 2024 | Indices only |
| 2026 | Sentinel-2 | Dec 2025 to Mar 2026 | Aug to Oct 2025 | Yes |

- Landsat: Collection 2 Level 2 surface reflectance (`LANDSAT/LT05/C02/T1_L2`, `LANDSAT/LC08/C02/T1_L2`)
- Sentinel-2: Level 2A surface reflectance, harmonized (`COPERNICUS/S2_SR_HARMONIZED`)
- The dry season is the main classification input. The monsoon season, when Aman rice is at peak growth, supports rice identification.
- 1991, 2001 and 2008 use a wider Jul to Nov monsoon window because Landsat 5 has few usable Aug to Oct scenes over Bangladesh. The 2026 monsoon composite uses 2025 imagery.

## Land cover classes

| Code | Class | Map colour |
|---|---|---|
| 0 | Rice | `#ffd92f` |
| 1 | Vegetation | `#2e7d32` |
| 2 | Aquaculture | `#00b8d4` |
| 3 | Fallow/Saline | `#d9a066` |
| 4 | Settlement | `#e31a1c` |

The river is excluded from the study area, and inland waterbodies (ponds, canals, shrimp farms) are counted as aquaculture.

## Workflow

1. **Image collections.** Seasonal date windows and sensor selection by year.
2. **Cloud masking and composites.** Landsat `QA_PIXEL` cloud and shadow bits and Sentinel-2 `SCL` classes are masked, reflectance is scaled, and a median composite is built for each year and season.
3. **Spectral indices.** NDVI, NDWI, MNDWI and NDBI for every composite, plus an index false colour (NDBI, NDVI, MNDWI) used while digitizing training data. Step 3b checks 1991 composite quality (value ranges, valid pixel counts, histograms, seasonal NDVI difference).
4. **Random Forest classification.** 150 trees, six optical bands plus the four indices from the dry season composite, 70/30 split of sampled pixels into training and validation. Reports overall accuracy, kappa, producer's and user's accuracy and variable importance, then applies a 3 x 3 majority filter.
5. **Area per class.** Hectares from `ee.Image.pixelArea()`.
6. **Change detection.** All maps are placed on a common 30 m grid in UTM 45N (EPSG:32645), with Sentinel-2 maps aggregated by mode. Each pixel gets a transition code (from x 10 + to), and transition matrices are built for 1991 to 2001, 2001 to 2010, 2010 to 2018, 2018 to 2026 and 1991 to 2026. Key pathways (rice to aquaculture, rice to fallow, fallow to aquaculture, aquaculture to rice, fallow to rice) are mapped and measured.
7. **Exports.** Classified maps, common grid maps, transition rasters and training data (SHP) go to a Google Drive folder named `Gabura_LULC`. Script 02 also exports the change maps and all results tables as CSV.

## How to run

1. Open the [Earth Engine Code Editor](https://code.earthengine.google.com/) and paste in `scripts/01_lulc_classification_pipeline.js`.
2. Add these imports, which the scripts expect:
   - `aoi`: Gabura Union boundary (main study area)
   - `aoi2`: expanded area used to build the 2001 and 2008 composites
   - Training data for each classified year, as FeatureCollections with an integer `Landcover` property (codes above), named `y91_`, `y01_`, `y10_`, `y18_` and `y26_` followed by `Rice`, `Vegetation`, `Acquaculture`, `Fallow` and `Settlement` (for example `y91_Rice`)
3. Click **Run**. Export jobs appear in the **Tasks** tab, and each one needs to be started by clicking **Run**.
4. For the full results tables and figures, keep Steps 1 to 3 of script 01, replace its Steps 4 to 7 with `scripts/02_results_tables_figures.js`, and run again.

## About

Part of my MS thesis research, *From Pattern to Processes of Adaptation to Climate-Induced Hazards: Livelihood Transitions under Saltwater Intrusion in the Rice Zone of Coastal Bangladesh*, Department of Geography, Ohio University.

**Md. Sabbir Hossain**\
MS Candidate, Department of Geography, Ohio University\
sabbirh005@gmail.com | [LinkedIn](https://www.linkedin.com/in/md-sabbir-hossain-b087b7134/)
