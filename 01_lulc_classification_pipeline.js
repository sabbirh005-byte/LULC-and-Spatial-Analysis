// =====================================================
// LAND USE LAND COVER CHANGE ANALYSIS
// Study Area: Gabura Union, Satkhira, Bangladesh
// Author: Md. Sabbir Hossain
// Ohio University - MS Geography (GIScience)
//
// SENSORS:
// Landsat 5  -> 1991, 2001, 2008, 2010
// Landsat 8  -> 2014
// Sentinel-2 -> 2018, 2022, 2024, 2026
//
// TWO SEASONS:
// Dry Season     (Dec-Mar) -> Main classification
// Monsoon Season (Aug-Oct) -> Rice identification
//
// SPECIAL CASES:
// 2026 monsoon -> uses 2025 Aug-Oct
//                 (2026 monsoon not yet occurred)
// 1991 monsoon -> extended window Jul-Nov
// 2001 monsoon -> extended window Jul-Nov
// 2008 monsoon -> extended window Jul-Nov
//                 (Landsat 5 has too few usable
//                  Aug-Oct passes over Bangladesh)
//
// AOI:
// aoi  = Gabura (main study area)
// aoi2 = Expanded area (used for 2001 and 2008)
//
// CLASSES (property = 'Landcover'):
// 0 = Rice
// 1 = Vegetation
// 2 = Aquaculture
// 3 = Fallow/Saline
// 4 = Settlement
// River excluded from the AOI; inland waterbodies
// counted as aquaculture.
// =====================================================
// =====================================================
// STEP 1: LOAD IMAGE COLLECTIONS
// =====================================================
// -----------------------------------------------------
// 1. Display AOIs
// -----------------------------------------------------
Map.centerObject(aoi, 12);
Map.addLayer(aoi,  {}, "Gabura AOI");
Map.addLayer(aoi2, {}, "Expanded AOI");
// -----------------------------------------------------
// 2. Dry season date function
// December of previous year to March of target year
// Example: year=2008 -> Dec 2007 to Mar 2008
// Lowest cloud cover, highest salinity, best for
// detecting aquaculture and fallow/saline land
// -----------------------------------------------------
function getDrySeason(year) {
  return {
    start: ee.Date.fromYMD(year - 1, 12, 1),
    end:   ee.Date.fromYMD(year,      3, 31)
  };
}
// -----------------------------------------------------
// 3. Standard monsoon season date function
// August to October of target year
// Aman rice at peak growth, best for rice detection
// Used for Sentinel-2 years and Landsat 2010, 2014
// -----------------------------------------------------
function getMonsoonSeason(year) {
  return {
    start: ee.Date.fromYMD(year, 8,  1),
    end:   ee.Date.fromYMD(year, 10, 31)
  };
}
// -----------------------------------------------------
// 4. Extended monsoon season date function
// July to November, wider window
// Used for 1991, 2001 and 2008 Landsat only
// Landsat 5 has very few passes over Bangladesh in
// Aug-Oct due to orbit and cloud cover, so a wider
// window is needed for a usable median composite
// -----------------------------------------------------
function getMonsoonSeasonExtended(year) {
  return {
    start: ee.Date.fromYMD(year, 7,  1),
    end:   ee.Date.fromYMD(year, 11, 30)
  };
}
// -----------------------------------------------------
// 5. Dry season Landsat collection loader
// No cloud percent filter. QA_PIXEL masking in Step 2
// handles cloud removal more reliably than scene-level
// cloud percentage metadata.
// -----------------------------------------------------
function getLandsatDry(year, region) {
  var dates = getDrySeason(year);
  var collection;
  if (year <= 2011) {
    collection = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2");
  } else if (year <= 2013) {
    collection = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2");
  } else {
    collection = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2");
  }
  return collection
    .filterBounds(region)
    .filterDate(dates.start, dates.end);
}
// -----------------------------------------------------
// 6. Standard monsoon Landsat collection loader
// Used for 2010 and 2014
// -----------------------------------------------------
function getLandsatMonsoon(year, region) {
  var dates = getMonsoonSeason(year);
  var collection;
  if (year <= 2011) {
    collection = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2");
  } else if (year <= 2013) {
    collection = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2");
  } else {
    collection = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2");
  }
  return collection
    .filterBounds(region)
    .filterDate(dates.start, dates.end);
}
// -----------------------------------------------------
// 7. Extended monsoon Landsat collection loader
// Used for 1991, 2001 and 2008 only
// -----------------------------------------------------
function getLandsatMonsoonExtended(year, region) {
  var dates = getMonsoonSeasonExtended(year);
  var collection;
  if (year <= 2011) {
    collection = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2");
  } else if (year <= 2013) {
    collection = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2");
  } else {
    collection = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2");
  }
  return collection
    .filterBounds(region)
    .filterDate(dates.start, dates.end);
}
// -----------------------------------------------------
// 8. Dry season Sentinel-2 collection loader
// 30 percent cloud filter, dry season is relatively clear
// -----------------------------------------------------
function getSentinelDry(year, region) {
  var dates = getDrySeason(year);
  return ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(region)
    .filterDate(dates.start, dates.end)
    .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30));
}
// -----------------------------------------------------
// 9. Standard monsoon Sentinel-2 collection loader
// 20 percent cloud filter, stricter than dry season
// because monsoon cloud cover is much higher
// -----------------------------------------------------
function getSentinelMonsoon(year, region) {
  var dates = getMonsoonSeason(year);
  return ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(region)
    .filterDate(dates.start, dates.end)
    .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20));
}
// -----------------------------------------------------
// 10. Load DRY SEASON collections
// aoi2 for 2001 and 2008, aoi for all other years
// 1991 sits ten years before the current baseline,
// ahead of most of the Satkhira shrimp expansion
// -----------------------------------------------------
var img1991_dry = getLandsatDry(1991, aoi);
var img2001_dry = getLandsatDry(2001, aoi2);
var img2008_dry = getLandsatDry(2008, aoi2);
var img2010_dry = getLandsatDry(2010, aoi);
var img2014_dry = getLandsatDry(2014, aoi);
var img2018_dry = getSentinelDry(2018, aoi);
var img2022_dry = getSentinelDry(2022, aoi);
var img2024_dry = getSentinelDry(2024, aoi);
var img2026_dry = getSentinelDry(2026, aoi);
// -----------------------------------------------------
// 11. Load MONSOON collections
//
// 1991, 2001, 2008 -> extended window Jul-Nov
// 2010, 2014       -> standard window Aug-Oct
// 2018, 2022, 2024 -> standard Sentinel-2 window
// 2026             -> uses 2025 Aug-Oct, since Aug-Oct
//                     2026 has not occurred yet
// -----------------------------------------------------
var img1991_mon = getLandsatMonsoonExtended(1991, aoi);
var img2001_mon = getLandsatMonsoonExtended(2001, aoi2);
var img2008_mon = getLandsatMonsoonExtended(2008, aoi2);
var img2010_mon = getLandsatMonsoon(2010, aoi);
var img2014_mon = getLandsatMonsoon(2014, aoi);
var img2018_mon = getSentinelMonsoon(2018, aoi);
var img2022_mon = getSentinelMonsoon(2022, aoi);
var img2024_mon = getSentinelMonsoon(2024, aoi);
var img2026_mon = getSentinelMonsoon(2025, aoi);
// -----------------------------------------------------
// 12. Print image counts
// Landsat monsoon under 3 images means an unreliable
// composite. Sentinel monsoon under 3 means the cloud
// threshold needs loosening.
// -----------------------------------------------------
print("=== DRY SEASON IMAGE COUNTS ===");
print("1991 Dry Landsat 5:",  img1991_dry.size());
print("2001 Dry Landsat 5:",  img2001_dry.size());
print("2008 Dry Landsat 5:",  img2008_dry.size());
print("2010 Dry Landsat 5:",  img2010_dry.size());
print("2014 Dry Landsat 8:",  img2014_dry.size());
print("2018 Dry Sentinel-2:", img2018_dry.size());
print("2022 Dry Sentinel-2:", img2022_dry.size());
print("2024 Dry Sentinel-2:", img2024_dry.size());
print("2026 Dry Sentinel-2:", img2026_dry.size());
print("=== MONSOON IMAGE COUNTS ===");
print("1991 Mon Landsat 5 (Jul-Nov):",  img1991_mon.size());
print("2001 Mon Landsat 5 (Jul-Nov):",  img2001_mon.size());
print("2008 Mon Landsat 5 (Jul-Nov):",  img2008_mon.size());
print("2010 Mon Landsat 5 (Aug-Oct):",  img2010_mon.size());
print("2014 Mon Landsat 8 (Aug-Oct):",  img2014_mon.size());
print("2018 Mon Sentinel-2 (Aug-Oct):", img2018_mon.size());
print("2022 Mon Sentinel-2 (Aug-Oct):", img2022_mon.size());
print("2024 Mon Sentinel-2 (Aug-Oct):", img2024_mon.size());
print("2026 Mon uses 2025 Sentinel-2:", img2026_mon.size());
// -----------------------------------------------------
// 13. Acquisition dates for 1991
// Early Landsat 5 coverage over Bangladesh is thinner
// than the 2000s, so check what actually went in
// -----------------------------------------------------
function printDates(collection, label) {
  print(label, collection.aggregate_array('system:time_start')
    .map(function(t) { return ee.Date(t).format('YYYY-MM-dd'); }));
}
print("=== 1991 ACQUISITION DATES ===");
printDates(img1991_dry, "1991 dry dates:");
printDates(img1991_mon, "1991 monsoon dates:");
// =====================================================
// STEP 2: CLOUD MASKING + SCALING + MEDIAN COMPOSITES
// =====================================================
// -----------------------------------------------------
// 1. Cloud mask and scale Landsat Collection 2 Level 2
// QA_PIXEL bit 3 = cloud, bit 4 = cloud shadow
// Scale: multiply by 0.0000275, add -0.2
// -----------------------------------------------------
function maskScaleLandsat(image) {
  var qa     = image.select('QA_PIXEL');
  var cloud  = qa.bitwiseAnd(1 << 3).eq(0);
  var shadow = qa.bitwiseAnd(1 << 4).eq(0);
  var mask   = cloud.and(shadow);
  var optical = image.select('SR_B.*')
    .multiply(0.0000275)
    .add(-0.2);
  return image.addBands(optical, null, true)
    .updateMask(mask);
}
// -----------------------------------------------------
// 2. Cloud mask and scale Sentinel-2
// SCL is the Scene Classification Layer
// -----------------------------------------------------
function maskScaleSentinel(image) {
  var scl = image.select('SCL');
  var mask = scl.neq(3)    // cloud shadow
    .and(scl.neq(8))       // medium cloud
    .and(scl.neq(9))       // high cloud
    .and(scl.neq(10))      // cirrus
    .and(scl.neq(11));     // snow or ice
  var optical = image.select(['B2','B3','B4','B8','B11','B12'])
    .divide(10000);
  return image.addBands(optical, null, true)
    .updateMask(mask);
}
// -----------------------------------------------------
// 3. Composite maker functions
// Median reducer minimises cloud contamination and
// normalises variation within the window
// -----------------------------------------------------
function makeLandsatComposite(collection, region) {
  return collection
    .map(maskScaleLandsat)
    .median()
    .clip(region);
}
function makeSentinelComposite(collection, region) {
  return collection
    .map(maskScaleSentinel)
    .median()
    .clip(region);
}
// -----------------------------------------------------
// 4. DRY SEASON composites
// Primary classification inputs for Random Forest
// -----------------------------------------------------
var comp1991_dry = makeLandsatComposite(img1991_dry, aoi);
var comp2001_dry = makeLandsatComposite(img2001_dry, aoi2);
var comp2008_dry = makeLandsatComposite(img2008_dry, aoi2);
var comp2010_dry = makeLandsatComposite(img2010_dry, aoi);
var comp2014_dry = makeLandsatComposite(img2014_dry, aoi);
var comp2018_dry = makeSentinelComposite(img2018_dry, aoi);
var comp2022_dry = makeSentinelComposite(img2022_dry, aoi);
var comp2024_dry = makeSentinelComposite(img2024_dry, aoi);
var comp2026_dry = makeSentinelComposite(img2026_dry, aoi);
// -----------------------------------------------------
// 5. MONSOON composites
// Used for rice identification and training support
// -----------------------------------------------------
var comp1991_mon = makeLandsatComposite(img1991_mon, aoi);
var comp2001_mon = makeLandsatComposite(img2001_mon, aoi2);
var comp2008_mon = makeLandsatComposite(img2008_mon, aoi2);
var comp2010_mon = makeLandsatComposite(img2010_mon, aoi);
var comp2014_mon = makeLandsatComposite(img2014_mon, aoi);
var comp2018_mon = makeSentinelComposite(img2018_mon, aoi);
var comp2022_mon = makeSentinelComposite(img2022_mon, aoi);
var comp2024_mon = makeSentinelComposite(img2024_mon, aoi);
var comp2026_mon = makeSentinelComposite(img2026_mon, aoi);
// -----------------------------------------------------
// 6. Visualisation parameters
// -----------------------------------------------------
var visLandsat57 = {
  bands: ['SR_B3','SR_B2','SR_B1'],
  min: 0, max: 0.3
};
var visLandsat8 = {
  bands: ['SR_B4','SR_B3','SR_B2'],
  min: 0, max: 0.3
};
var visSentinel = {
  bands: ['B4','B3','B2'],
  min: 0, max: 0.3
};
// Landsat 5 false colour: NIR, Red, Green.
// Vegetation reads bright red, water near black, bare
// soil pale cyan. Holds up better than true colour on
// older Landsat 5 scenes, which look washed out.
var visFalseL57 = {
  bands: ['SR_B4','SR_B3','SR_B2'],
  min: 0, max: 0.4
};
// -----------------------------------------------------
// 7. DRY SEASON composites on the map
// Loaded ON as primary reference layers
// -----------------------------------------------------
Map.addLayer(comp1991_dry, visLandsat57,
  "DRY Composite 1991 Landsat5 Gabura");
Map.addLayer(comp1991_dry, visFalseL57,
  "DRY FalseColour 1991 Landsat5 Gabura", false);
Map.addLayer(comp2001_dry, visLandsat57,
  "DRY Composite 2001 Landsat5 AOI2");
Map.addLayer(comp2008_dry, visLandsat57,
  "DRY Composite 2008 Landsat5 AOI2");
Map.addLayer(comp2010_dry, visLandsat57,
  "DRY Composite 2010 Landsat5 Gabura");
Map.addLayer(comp2014_dry, visLandsat8,
  "DRY Composite 2014 Landsat8 Gabura");
Map.addLayer(comp2018_dry, visSentinel,
  "DRY Composite 2018 Sentinel2 Gabura");
Map.addLayer(comp2022_dry, visSentinel,
  "DRY Composite 2022 Sentinel2 Gabura");
Map.addLayer(comp2024_dry, visSentinel,
  "DRY Composite 2024 Sentinel2 Gabura");
Map.addLayer(comp2026_dry, visSentinel,
  "DRY Composite 2026 Sentinel2 Gabura");
// -----------------------------------------------------
// 8. MONSOON composites on the map
// Loaded OFF. Toggle on to find rice fields.
// Green in monsoon and bare in dry means Aman rice.
// Green in both seasons means permanent vegetation.
// -----------------------------------------------------
Map.addLayer(comp1991_mon, visLandsat57,
  "MON Composite 1991 Landsat5 Gabura (Jul-Nov)", false);
Map.addLayer(comp1991_mon, visFalseL57,
  "MON FalseColour 1991 Landsat5 Gabura (Jul-Nov)", false);
Map.addLayer(comp2001_mon, visLandsat57,
  "MON Composite 2001 Landsat5 AOI2 (Jul-Nov)", false);
Map.addLayer(comp2008_mon, visLandsat57,
  "MON Composite 2008 Landsat5 AOI2 (Jul-Nov)", false);
Map.addLayer(comp2010_mon, visLandsat57,
  "MON Composite 2010 Landsat5 Gabura", false);
Map.addLayer(comp2014_mon, visLandsat8,
  "MON Composite 2014 Landsat8 Gabura", false);
Map.addLayer(comp2018_mon, visSentinel,
  "MON Composite 2018 Sentinel2 Gabura", false);
Map.addLayer(comp2022_mon, visSentinel,
  "MON Composite 2022 Sentinel2 Gabura", false);
Map.addLayer(comp2024_mon, visSentinel,
  "MON Composite 2024 Sentinel2 Gabura", false);
Map.addLayer(comp2026_mon, visSentinel,
  "MON Composite 2026 uses 2025 Sentinel2 Gabura", false);
// -----------------------------------------------------
// 9. Print composites
// -----------------------------------------------------
print("=== DRY SEASON COMPOSITES ===");
print("Comp 1991 Dry Gabura:", comp1991_dry);
print("Comp 2001 Dry AOI2:",   comp2001_dry);
print("Comp 2008 Dry AOI2:",   comp2008_dry);
print("Comp 2010 Dry Gabura:", comp2010_dry);
print("Comp 2014 Dry Gabura:", comp2014_dry);
print("Comp 2018 Dry Gabura:", comp2018_dry);
print("Comp 2022 Dry Gabura:", comp2022_dry);
print("Comp 2024 Dry Gabura:", comp2024_dry);
print("Comp 2026 Dry Gabura:", comp2026_dry);
print("=== MONSOON COMPOSITES ===");
print("Comp 1991 Mon Gabura:", comp1991_mon);
// =====================================================
// STEP 3: SPECTRAL INDICES + VISUALISATION
// NDVI, NDWI, MNDWI, NDBI
// All index layers toggled OFF by default
// =====================================================
// -----------------------------------------------------
// 1. Index functions, one per sensor type
// Same functions serve both dry and monsoon
// -----------------------------------------------------
function addIndicesLandsat57(image) {
  var ndvi  = image.normalizedDifference(['SR_B4','SR_B3']).rename('NDVI');
  var ndwi  = image.normalizedDifference(['SR_B2','SR_B4']).rename('NDWI');
  var mndwi = image.normalizedDifference(['SR_B2','SR_B5']).rename('MNDWI');
  var ndbi  = image.normalizedDifference(['SR_B5','SR_B4']).rename('NDBI');
  return image.addBands([ndvi, ndwi, mndwi, ndbi]);
}
function addIndicesLandsat8(image) {
  var ndvi  = image.normalizedDifference(['SR_B5','SR_B4']).rename('NDVI');
  var ndwi  = image.normalizedDifference(['SR_B3','SR_B5']).rename('NDWI');
  var mndwi = image.normalizedDifference(['SR_B3','SR_B6']).rename('MNDWI');
  var ndbi  = image.normalizedDifference(['SR_B6','SR_B5']).rename('NDBI');
  return image.addBands([ndvi, ndwi, mndwi, ndbi]);
}
function addIndicesSentinel(image) {
  var ndvi  = image.normalizedDifference(['B8','B4']).rename('NDVI');
  var ndwi  = image.normalizedDifference(['B3','B8']).rename('NDWI');
  var mndwi = image.normalizedDifference(['B3','B11']).rename('MNDWI');
  var ndbi  = image.normalizedDifference(['B11','B8']).rename('NDBI');
  return image.addBands([ndvi, ndwi, mndwi, ndbi]);
}
// -----------------------------------------------------
// 2. Indices on DRY SEASON composites
// Primary inputs for Random Forest
// -----------------------------------------------------
var stack1991_dry = addIndicesLandsat57(comp1991_dry);
var stack2001_dry = addIndicesLandsat57(comp2001_dry);
var stack2008_dry = addIndicesLandsat57(comp2008_dry);
var stack2010_dry = addIndicesLandsat57(comp2010_dry);
var stack2014_dry = addIndicesLandsat8(comp2014_dry);
var stack2018_dry = addIndicesSentinel(comp2018_dry);
var stack2022_dry = addIndicesSentinel(comp2022_dry);
var stack2024_dry = addIndicesSentinel(comp2024_dry);
var stack2026_dry = addIndicesSentinel(comp2026_dry);
// -----------------------------------------------------
// 3. Indices on MONSOON composites
// -----------------------------------------------------
var stack1991_mon = addIndicesLandsat57(comp1991_mon);
var stack2001_mon = addIndicesLandsat57(comp2001_mon);
var stack2008_mon = addIndicesLandsat57(comp2008_mon);
var stack2010_mon = addIndicesLandsat57(comp2010_mon);
var stack2014_mon = addIndicesLandsat8(comp2014_mon);
var stack2018_mon = addIndicesSentinel(comp2018_mon);
var stack2022_mon = addIndicesSentinel(comp2022_mon);
var stack2024_mon = addIndicesSentinel(comp2024_mon);
var stack2026_mon = addIndicesSentinel(comp2026_mon);
// -----------------------------------------------------
// 4. Index visualisation parameters
// -----------------------------------------------------
var visNDVI = {
  min: -1, max: 1,
  palette: ['blue', 'white', 'green']
  // blue  = water or bare, NDVI low
  // white = sparse or transitional
  // green = rice or vegetation, NDVI high
};
var visMNDWI = {
  min: -1, max: 1,
  palette: ['red', 'white', 'blue']
  // red   = dry land or vegetation
  // white = moist or transitional
  // blue  = water or aquaculture, MNDWI high
};
var visNDWI = {
  min: -1, max: 1,
  palette: ['brown', 'white', 'blue']
  // brown = dry bare soil or settlement
  // white = moist or fallow
  // blue  = waterlogged or open water
};
var visNDBI = {
  min: -1, max: 1,
  palette: ['green', 'white', 'red']
  // green = vegetation or water
  // white = bare or transitional
  // red   = settlement or built-up, NDBI high
};
var visFalseColor = {
  min: -0.3, max: 0.5
  // R = NDBI,  settlement and bare read red or pink
  // G = NDVI,  rice and vegetation read green
  // B = MNDWI, water and aquaculture read blue
  // Dark areas are fallow or saline, all indices low
};
// -----------------------------------------------------
// 5. Helper that adds all five index layers at once
// All start toggled OFF
// -----------------------------------------------------
function addIndexLayers(stack, label) {
  Map.addLayer(stack.select('NDVI'),
    visNDVI, "NDVI " + label, false);
  Map.addLayer(stack.select('MNDWI'),
    visMNDWI, "MNDWI " + label, false);
  Map.addLayer(stack.select('NDWI'),
    visNDWI, "NDWI " + label, false);
  Map.addLayer(stack.select('NDBI'),
    visNDBI, "NDBI " + label, false);
  Map.addLayer(stack.select(['NDBI','NDVI','MNDWI']),
    visFalseColor, "IndexFalseColour " + label, false);
}
// -----------------------------------------------------
// 6. DRY SEASON index layers
// -----------------------------------------------------
addIndexLayers(stack1991_dry, "DRY 1991 Gabura");
addIndexLayers(stack2001_dry, "DRY 2001 AOI2");
addIndexLayers(stack2008_dry, "DRY 2008 AOI2");
addIndexLayers(stack2010_dry, "DRY 2010 Gabura");
addIndexLayers(stack2014_dry, "DRY 2014 Gabura");
addIndexLayers(stack2018_dry, "DRY 2018 Gabura");
addIndexLayers(stack2022_dry, "DRY 2022 Gabura");
addIndexLayers(stack2024_dry, "DRY 2024 Gabura");
addIndexLayers(stack2026_dry, "DRY 2026 Gabura");
// -----------------------------------------------------
// 7. MONSOON index layers
//
// Workflow for spotting rice:
//   1. Toggle IndexFalseColour MON for a year.
//      Bright green means active Aman rice.
//   2. Toggle IndexFalseColour DRY for the same year.
//      The same field reads dark, meaning harvested.
//   3. That field is rice, not fallow.
// -----------------------------------------------------
addIndexLayers(stack1991_mon, "MON 1991 Gabura (Jul-Nov)");
addIndexLayers(stack2001_mon, "MON 2001 AOI2 (Jul-Nov)");
addIndexLayers(stack2008_mon, "MON 2008 AOI2 (Jul-Nov)");
addIndexLayers(stack2010_mon, "MON 2010 Gabura");
addIndexLayers(stack2014_mon, "MON 2014 Gabura");
addIndexLayers(stack2018_mon, "MON 2018 Gabura");
addIndexLayers(stack2022_mon, "MON 2022 Gabura");
addIndexLayers(stack2024_mon, "MON 2024 Gabura");
addIndexLayers(stack2026_mon, "MON 2026 uses 2025 Gabura");
// -----------------------------------------------------
// 8. Print stacks
// Each should list optical bands plus NDVI, NDWI,
// MNDWI and NDBI
// -----------------------------------------------------
print("=== DRY SEASON STACKS ===");
print("Stack 1991 Dry Gabura:", stack1991_dry);
print("Stack 2001 Dry AOI2:",   stack2001_dry);
print("Stack 2008 Dry AOI2:",   stack2008_dry);
print("Stack 2010 Dry Gabura:", stack2010_dry);
print("Stack 2014 Dry Gabura:", stack2014_dry);
print("Stack 2018 Dry Gabura:", stack2018_dry);
print("Stack 2022 Dry Gabura:", stack2022_dry);
print("Stack 2024 Dry Gabura:", stack2024_dry);
print("Stack 2026 Dry Gabura:", stack2026_dry);
print("=== MONSOON STACKS ===");
print("Stack 1991 Mon Gabura:", stack1991_mon);
// =====================================================
// STEP 3b: 1991 INDEX AND BAND REPORTING
//
// Value ranges tell you whether the composite is usable.
// NDVI should span roughly -0.3 to +0.8 and MNDWI about
// -0.5 to +0.7. Any index crushed toward zero means the
// composite is thin after cloud masking.
// =====================================================
function printIndexStats(stack, label) {
  print(label, stack.select(['NDVI','MNDWI','NDWI','NDBI'])
    .reduceRegion({
      reducer: ee.Reducer.minMax()
        .combine(ee.Reducer.mean(), null, true),
      geometry: aoi,
      scale: 30,
      maxPixels: 1e10,
      tileScale: 4
    }));
}
function printBandStats(image, bands, label) {
  print(label, image.select(bands).reduceRegion({
    reducer: ee.Reducer.minMax()
      .combine(ee.Reducer.mean(), null, true),
    geometry: aoi,
    scale: 30,
    maxPixels: 1e10,
    tileScale: 4
  }));
}
print("=== 1991 INDEX STATS ===");
printIndexStats(stack1991_dry, "DRY 1991 indices:");
printIndexStats(stack1991_mon, "MON 1991 indices:");
print("=== 1991 TRUE COLOUR BANDS (SR_B3, SR_B2, SR_B1) ===");
printBandStats(comp1991_dry, ['SR_B3','SR_B2','SR_B1'],
  "DRY 1991 true colour:");
printBandStats(comp1991_mon, ['SR_B3','SR_B2','SR_B1'],
  "MON 1991 true colour:");
print("=== 1991 FALSE COLOUR BANDS (SR_B4, SR_B3, SR_B2) ===");
printBandStats(comp1991_dry, ['SR_B4','SR_B3','SR_B2'],
  "DRY 1991 false colour:");
printBandStats(comp1991_mon, ['SR_B4','SR_B3','SR_B2'],
  "MON 1991 false colour:");
// -----------------------------------------------------
// Valid pixel counts after cloud masking
//
// Watch the monsoon figure against the dry one. A large
// gap means that composite has holes and must not be
// added as an extra band, because addBands intersects
// masks. That is what emptied the 2018 and 2026 training
// samples earlier.
// -----------------------------------------------------
function countValid(stack, label) {
  print(label, stack.select('NDVI').reduceRegion({
    reducer: ee.Reducer.count(),
    geometry: aoi,
    scale: 30,
    maxPixels: 1e10,
    tileScale: 4
  }));
}
print("=== 1991 VALID PIXEL COUNTS ===");
countValid(stack1991_dry, "1991 dry:");
countValid(stack1991_mon, "1991 monsoon:");
// -----------------------------------------------------
// NDVI histograms
//
// Shape matters more than the numbers. Two clear peaks
// means vegetated and bare ground separate, so training
// points can be placed with some confidence. One broad
// hump means the median has smeared everything together.
// -----------------------------------------------------
print(ui.Chart.image.histogram({
  image: stack1991_dry.select('NDVI'),
  region: aoi, scale: 30, maxBuckets: 50, maxPixels: 1e10
}).setOptions({title: 'DRY 1991 NDVI distribution'}));
print(ui.Chart.image.histogram({
  image: stack1991_mon.select('NDVI'),
  region: aoi, scale: 30, maxBuckets: 50, maxPixels: 1e10
}).setOptions({title: 'MON 1991 NDVI distribution'}));
print(ui.Chart.image.histogram({
  image: stack1991_dry.select('MNDWI'),
  region: aoi, scale: 30, maxBuckets: 50, maxPixels: 1e10
}).setOptions({title: 'DRY 1991 MNDWI distribution'}));
print(ui.Chart.image.histogram({
  image: stack1991_dry.select('NDBI'),
  region: aoi, scale: 30, maxBuckets: 50, maxPixels: 1e10
}).setOptions({title: 'DRY 1991 NDBI distribution'}));
// -----------------------------------------------------
// Seasonal NDVI difference for 1991
//
// Monsoon NDVI minus dry NDVI. High values mean green in
// monsoon and bare in dry, which is harvested rice rather
// than land permanently out of production. Low values
// mean bare in both, which is genuine fallow or saline
// ground. Only meaningful if the monsoon pixel count
// above is healthy.
// -----------------------------------------------------
var diff1991 = stack1991_mon.select('NDVI')
  .subtract(stack1991_dry.select('NDVI'))
  .rename('NDVI_diff');
Map.addLayer(diff1991,
  {min: -0.2, max: 0.6,
   palette: ['white','yellow','orange','purple']},
  "DIFF 1991 NDVI monsoon minus dry", false);
// =====================================================
// STEP 4: RANDOM FOREST CLASSIFICATION
// Years trained: 1991, 2001, 2010, 2018, 2026
//
// CLASS CODES (property = 'Landcover'):
// 0 = Rice
// 1 = Vegetation
// 2 = Aquaculture
// 3 = Fallow/Saline
// 4 = Settlement
//
// WHY BANDS ARE SELECTED EXPLICITLY:
// sampleRegions drops a pixel if ANY band is masked there.
// The raw stacks carry QA, thermal and mask layers
// (QA60, MSK_CLDPRB, SCL, ST_*, QA_PIXEL). QA60 comes
// through empty in recent Sentinel-2 imagery, which masked
// every pixel and made 2018 and 2026 sample zero. Selecting
// the optical bands plus indices fixes that, and stops
// Random Forest training on QA layers.
//
// Monsoon NDVI stays disabled: addBands intersects masks,
// and the Aug-Oct composites are too heavily cloud-masked.
// =====================================================
// -----------------------------------------------------
// 0. Shared constants
// -----------------------------------------------------
var CRS = 'EPSG:32645';          // UTM 45N, SW Bangladesh
// -----------------------------------------------------
// 1. Merge each year's classes
// 'Landcover' is already set on every import
// -----------------------------------------------------
var train1991 = ee.FeatureCollection(y91_Rice)
  .merge(y91_Vegetation)
  .merge(y91_Acquaculture)
  .merge(y91_Fallow)
  .merge(y91_Settlement);
var train2001 = ee.FeatureCollection(y01_Rice)
  .merge(y01_Vegetation)
  .merge(y01_Acquaculture)
  .merge(y01_Fallow)
  .merge(y01_Settlement);
var train2010 = ee.FeatureCollection(y10_Rice)      // currently empty
  .merge(y10_Vegetation)
  .merge(y10_Acquaculture)
  .merge(y10_Fallow)
  .merge(y10_Settlement);
var train2018 = ee.FeatureCollection(y18_Rice)
  .merge(y18_Vegetation)
  .merge(y18_Acquaculture)
  .merge(y18_Fallow)
  .merge(y18_Settlement);
var train2026 = ee.FeatureCollection(y26_Rice)
  .merge(y26_Vegetation)
  .merge(y26_Acquaculture)
  .merge(y26_Fallow)
  .merge(y26_Settlement);
print('=== POINTS PER CLASS ===');
print('1991:', train1991.aggregate_histogram('Landcover'));
print('2001:', train2001.aggregate_histogram('Landcover'));
print('2010:', train2010.aggregate_histogram('Landcover'));
print('2018:', train2018.aggregate_histogram('Landcover'));
print('2026:', train2026.aggregate_histogram('Landcover'));
// -----------------------------------------------------
// 2. Predictor band lists
// Optical reflectance plus the four indices only.
// No QA, thermal, mask or TCI layers.
// -----------------------------------------------------
var INDICES = ['NDVI', 'NDWI', 'MNDWI', 'NDBI'];
var BANDS_L57 = ['SR_B1','SR_B2','SR_B3','SR_B4','SR_B5','SR_B7']
  .concat(INDICES);
var BANDS_L8 = ['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7']
  .concat(INDICES);
var BANDS_S2 = ['B2','B3','B4','B8','B11','B12']
  .concat(INDICES);
// -----------------------------------------------------
// 3. Build clean classification stacks
// 1991, 2001, 2010 are Landsat 5
// 2018, 2026 are Sentinel-2
// -----------------------------------------------------
var rf1991 = stack1991_dry.select(BANDS_L57);
var rf2001 = stack2001_dry.select(BANDS_L57);
var rf2010 = stack2010_dry.select(BANDS_L57);
var rf2018 = stack2018_dry.select(BANDS_S2);
var rf2026 = stack2026_dry.select(BANDS_S2);
print('=== PREDICTOR BANDS ===');
print('1991:', rf1991.bandNames());
print('2001:', rf2001.bandNames());
print('2010:', rf2010.bandNames());
print('2018:', rf2018.bandNames());
print('2026:', rf2026.bandNames());
// -----------------------------------------------------
// 4. Classification and accuracy
// scale: 30 for Landsat years, 10 for Sentinel years
// Output always clipped to aoi (Gabura), including 2001
// whose composite was built on aoi2
// -----------------------------------------------------
function classifyYear(stack, points, scale, label) {
  var samples = stack.sampleRegions({
    collection: points,
    properties: ['Landcover'],
    scale: scale,
    tileScale: 4,
    geometries: false
  });
  var withRandom = samples.randomColumn('rnd', 42);
  var training   = withRandom.filter(ee.Filter.lt('rnd', 0.7));
  var validation = withRandom.filter(ee.Filter.gte('rnd', 0.7));
  var classifier = ee.Classifier.smileRandomForest({
    numberOfTrees: 150,
    seed: 42
  }).train({
    features: training,
    classProperty: 'Landcover',
    inputProperties: stack.bandNames()
  });
  var classified = stack.classify(classifier).clip(aoi);
  var confusion = validation.classify(classifier)
    .errorMatrix('Landcover', 'classification');
  print('=========== ' + label + ' ===========');
  print('Points drawn:',      points.size());
  print('Pixels sampled:',    samples.size());
  print('Sampled per class:', samples.aggregate_histogram('Landcover'));
  print('Training pixels:',   training.size());
  print('Validation pixels:', validation.size());
  print('Confusion matrix (rows=truth, cols=predicted):', confusion);
  print('Overall accuracy:',  confusion.accuracy());
  print('Kappa:',             confusion.kappa());
  print("Producer's accuracy:", confusion.producersAccuracy());
  print("User's accuracy:",     confusion.consumersAccuracy());
  print('Variable importance:',
    ee.Dictionary(classifier.explain().get('importance')));
  return classified;
}
var lulc1991 = classifyYear(rf1991, train1991, 30, '1991');
var lulc2001 = classifyYear(rf2001, train2001, 30, '2001');
var lulc2010 = classifyYear(rf2010, train2010, 30, '2010');
var lulc2018 = classifyYear(rf2018, train2018, 10, '2018');
var lulc2026 = classifyYear(rf2026, train2026, 10, '2026');
// -----------------------------------------------------
// 5. Majority filter
// Removes isolated single pixels without distorting real
// patch boundaries.
//
// setDefaultProjection is required: the classified image
// inherits no projection from median(), so a 1-pixel
// radius would otherwise mean different ground distances
// at different zoom levels and in export.
// -----------------------------------------------------
function majorityFilter(classified, scale) {
  return classified
    .setDefaultProjection({crs: CRS, scale: scale})
    .focalMode({radius: 1, kernelType: 'square', units: 'pixels'})
    .clip(aoi);
}
var lulc1991_s = majorityFilter(lulc1991, 30);
var lulc2001_s = majorityFilter(lulc2001, 30);
var lulc2010_s = majorityFilter(lulc2010, 30);
var lulc2018_s = majorityFilter(lulc2018, 10);
var lulc2026_s = majorityFilter(lulc2026, 10);
// -----------------------------------------------------
// 6. Display
// -----------------------------------------------------
var visClass = {
  min: 0, max: 4,
  palette: [
    'ffd92f',  // 0 Rice        yellow
    '2e7d32',  // 1 Vegetation  green
    '00b8d4',  // 2 Aquaculture cyan
    'd9a066',  // 3 Fallow      tan
    'e31a1c'   // 4 Settlement  red
  ]
};
Map.addLayer(lulc1991_s, visClass, 'LULC 1991', false);
Map.addLayer(lulc2001_s, visClass, 'LULC 2001', false);
Map.addLayer(lulc2010_s, visClass, 'LULC 2010', false);
Map.addLayer(lulc2018_s, visClass, 'LULC 2018', false);
Map.addLayer(lulc2026_s, visClass, 'LULC 2026', true);
// -----------------------------------------------------
// 7. Legend
// -----------------------------------------------------
var legend = ui.Panel({
  style: {position: 'bottom-left', padding: '8px 12px'}
});
legend.add(ui.Label('Land Cover', {
  fontWeight: 'bold', fontSize: '14px', margin: '0 0 6px 0'
}));
['Rice','Vegetation','Aquaculture','Fallow/Saline','Settlement']
  .forEach(function(name, i) {
    legend.add(ui.Panel({
      widgets: [
        ui.Label('', {
          backgroundColor: visClass.palette[i],
          padding: '9px', margin: '0 6px 3px 0'
        }),
        ui.Label(name, {margin: '0 0 4px 0', fontSize: '12px'})
      ],
      layout: ui.Panel.Layout.Flow('horizontal')
    }));
  });
Map.add(legend);
// =====================================================
// STEP 5: AREA PER CLASS PER YEAR
// Hectares over the Gabura AOI
// =====================================================
// -----------------------------------------------------
// 1. Grouped area reducer
// ee.Image.pixelArea() gives each pixel its true ground
// area in m2, so hectares are correct at this latitude.
// A naive pixel count would misstate them.
// -----------------------------------------------------
function areaByClass(classified, scale, label) {
  var areaImage = ee.Image.pixelArea().divide(10000)   // m2 to ha
    .addBands(classified.rename('class'));
  var stats = areaImage.reduceRegion({
    reducer: ee.Reducer.sum().group({
      groupField: 1,
      groupName: 'class'
    }),
    geometry: aoi,
    scale: scale,
    maxPixels: 1e10,
    tileScale: 4
  });
  print('Area (ha) ' + label + ':', stats);
  return stats;
}
print('=== AREA BY CLASS ===');
areaByClass(lulc1991_s, 30, '1991');
areaByClass(lulc2001_s, 30, '2001');
areaByClass(lulc2010_s, 30, '2010');
areaByClass(lulc2018_s, 10, '2018');
areaByClass(lulc2026_s, 10, '2026');
// -----------------------------------------------------
// 2. Same figures as a chart
// Quick visual check that the trend matches the story
// before any numbers go into the thesis
// -----------------------------------------------------
var CLASS_NAMES = ['Rice','Vegetation','Aquaculture',
                   'Fallow/Saline','Settlement'];
function areaDict(classified, scale, year) {
  var areaImage = ee.Image.pixelArea().divide(10000)
    .addBands(classified.rename('class'));
  var grouped = ee.List(areaImage.reduceRegion({
    reducer: ee.Reducer.sum().group({
      groupField: 1, groupName: 'class'}),
    geometry: aoi,
    scale: scale,
    maxPixels: 1e10,
    tileScale: 4
  }).get('groups'));
  // One feature per year with a property per class,
  // so it charts cleanly
  var props = ee.Dictionary(
    grouped.iterate(function(item, acc) {
      item = ee.Dictionary(item);
      var name = ee.List(CLASS_NAMES).get(item.getNumber('class'));
      return ee.Dictionary(acc).set(name, item.getNumber('sum'));
    }, ee.Dictionary({}))
  );
  return ee.Feature(null, props.set('year', year));
}
var areaSeries = ee.FeatureCollection([
  areaDict(lulc1991_s, 30, 1991),
  areaDict(lulc2001_s, 30, 2001),
  areaDict(lulc2010_s, 30, 2010),
  areaDict(lulc2018_s, 10, 2018),
  areaDict(lulc2026_s, 10, 2026)
]);
print(ui.Chart.feature.byFeature(areaSeries, 'year', CLASS_NAMES)
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Land cover area by year, Gabura Union',
    hAxis: {title: 'Year'},
    vAxis: {title: 'Area (hectares)'},
    colors: ['ffd92f','2e7d32','00b8d4','d9a066','e31a1c']
  }));
// =====================================================
// STEP 6: CHANGE DETECTION
// Post-classification comparison
//
// PROJECTION NOTE:
// Classified images inherit no projection, since median()
// drops it and leaves the 1-degree WGS84 default, which
// reduceResolution rejects. Each map is given an explicit
// projection at its native scale before being aggregated
// to a shared 30 m grid.
//
// SCALE NOTE:
// Landsat years are 30 m, Sentinel years 10 m. Comparing
// them pixel by pixel without a common grid produces
// false transitions along every boundary.
// =====================================================
// -----------------------------------------------------
// 1. Common 30 m grid
// -----------------------------------------------------
var COMMON_SCALE = 30;
var PROJ30 = ee.Projection(CRS).atScale(COMMON_SCALE);
// Landsat years, already 30 m, just pin the grid
function toCommonGrid30(classified) {
  return classified
    .setDefaultProjection({crs: CRS, scale: 30})
    .reproject(PROJ30)
    .clip(aoi);
}
// Sentinel years, 10 m aggregated to 30 m.
// mode() preserves class integers; mean would invent
// values that are not classes at all.
// maxPixels 16 is ample: nine 10 m cells per 30 m cell.
function toCommonGrid10(classified) {
  return classified
    .setDefaultProjection({crs: CRS, scale: 10})
    .reduceResolution({reducer: ee.Reducer.mode(), maxPixels: 16})
    .reproject(PROJ30)
    .clip(aoi);
}
var c1991 = toCommonGrid30(lulc1991_s);
var c2001 = toCommonGrid30(lulc2001_s);
var c2010 = toCommonGrid30(lulc2010_s);
var c2018 = toCommonGrid10(lulc2018_s);
var c2026 = toCommonGrid10(lulc2026_s);
// Confirm the projection took. crs should read EPSG:32645,
// not EPSG:4326. If it still says 4326, nothing below works.
print('=== PROJECTION CHECK ===');
print('c1991 projection:', c1991.projection());
print('c2018 projection:', c2018.projection());
print('c2026 projection:', c2026.projection());
// -----------------------------------------------------
// 2. Transition coding
// code = (from * 10) + to
//
// Pathways this study cares about:
//   02  Rice        to Aquaculture
//   03  Rice        to Fallow
//   32  Fallow      to Aquaculture
//   20  Aquaculture to Rice    (the return farmers describe)
//   30  Fallow      to Rice    (recovery of abandoned land)
//   00  Rice        to Rice    (no change)
// -----------------------------------------------------
function transition(fromImg, toImg) {
  return fromImg.multiply(10).add(toImg).rename('transition');
}
var t1991_2001 = transition(c1991, c2001);
var t2001_2010 = transition(c2001, c2010);
var t2010_2018 = transition(c2010, c2018);
var t2018_2026 = transition(c2018, c2026);
var t1991_2026 = transition(c1991, c2026);   // full period
// -----------------------------------------------------
// 3. Transition matrices, the thesis tables
// Output reads: from-class, to-class, hectares
// -----------------------------------------------------
function transitionMatrix(fromImg, toImg, label) {
  var areaImage = ee.Image.pixelArea().divide(10000)
    .addBands(fromImg.rename('from'))
    .addBands(toImg.rename('to'));
  var stats = areaImage.reduceRegion({
    reducer: ee.Reducer.sum()
      .group({groupField: 1, groupName: 'from'})
      .group({groupField: 2, groupName: 'to'}),
    geometry: aoi,
    scale: COMMON_SCALE,
    crs: CRS,
    maxPixels: 1e10,
    tileScale: 4
  });
  print('Transition matrix (ha) ' + label + ':', stats);
  return stats;
}
print('=== TRANSITION MATRICES ===');
transitionMatrix(c1991, c2001, '1991 to 2001');
transitionMatrix(c2001, c2010, '2001 to 2010');
transitionMatrix(c2010, c2018, '2010 to 2018');
transitionMatrix(c2018, c2026, '2018 to 2026');
transitionMatrix(c1991, c2026, '1991 to 2026 full period');
// -----------------------------------------------------
// 4. Key transitions isolated and mapped
// selfMask() drops the zeros so only the transition
// itself draws over whatever sits beneath
// -----------------------------------------------------
var riceToAqua   = t1991_2026.eq(2).selfMask();
var riceToFallow = t1991_2026.eq(3).selfMask();
var fallowToAqua = t1991_2026.eq(32).selfMask();
var aquaToRice   = t1991_2026.eq(20).selfMask();
var fallowToRice = t1991_2026.eq(30).selfMask();
Map.addLayer(riceToAqua,   {palette: 'ff0000'},
  'Rice to Aquaculture 1991-2026', false);
Map.addLayer(riceToFallow, {palette: 'ff8800'},
  'Rice to Fallow 1991-2026', false);
Map.addLayer(fallowToAqua, {palette: 'aa00ff'},
  'Fallow to Aquaculture 1991-2026', false);
Map.addLayer(aquaToRice,   {palette: '00ff00'},
  'Aquaculture to Rice 1991-2026', false);
Map.addLayer(fallowToRice, {palette: '88ff00'},
  'Fallow to Rice 1991-2026', false);
// -----------------------------------------------------
// 5. Area of each key transition
// -----------------------------------------------------
function transitionArea(mask, label) {
  print(label + ' (ha):',
    ee.Image.pixelArea().divide(10000)
      .updateMask(mask)
      .reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: COMMON_SCALE,
        crs: CRS,
        maxPixels: 1e10,
        tileScale: 4
      }));
}
print('=== KEY TRANSITION AREAS 1991-2026 ===');
transitionArea(riceToAqua,   'Rice to Aquaculture');
transitionArea(riceToFallow, 'Rice to Fallow');
transitionArea(fallowToAqua, 'Fallow to Aquaculture');
transitionArea(aquaToRice,   'Aquaculture to Rice');
transitionArea(fallowToRice, 'Fallow to Rice');
// -----------------------------------------------------
// 6. Annual rate of change
// FAO formula: r = ((A2/A1)^(1/t) - 1) * 100
// Fill A1 and A2 from the Step 5 printed areas
// -----------------------------------------------------
function annualRate(areaStart, areaEnd, years, label) {
  var r = (Math.pow(areaEnd / areaStart, 1 / years) - 1) * 100;
  print(label + ' annual rate (%/yr): ' + r.toFixed(2));
}
// Example, replace with your actual values:
// annualRate(1400, 640, 35, 'Rice 1991-2026');
// annualRate(300, 1340, 35, 'Aquaculture 1991-2026');
// =====================================================
// STEP 7: EXPORT TO DRIVE
//
// EPSG:32645 (UTM 45N) throughout, so areas measured in
// GIS afterwards match the hectare figures from Step 5.
//
// These calls only QUEUE the jobs. Open the Tasks tab
// and click Run on each one to start it.
// =====================================================
// -----------------------------------------------------
// 1. Classified maps at native resolution
// toByte() keeps files small, since class values 0 to 4
// fit comfortably in 8 bits
// -----------------------------------------------------
function exportLULC(image, year, scale) {
  Export.image.toDrive({
    image: image.toByte(),
    description: 'LULC_Gabura_' + year,
    folder: 'Gabura_LULC',
    fileNamePrefix: 'LULC_Gabura_' + year,
    region: aoi,
    scale: scale,
    crs: CRS,
    maxPixels: 1e10
  });
}
exportLULC(lulc1991_s, 1991, 30);
exportLULC(lulc2001_s, 2001, 30);
exportLULC(lulc2010_s, 2010, 30);
exportLULC(lulc2018_s, 2018, 10);
exportLULC(lulc2026_s, 2026, 10);
// -----------------------------------------------------
// 2. Classified maps on the common 30 m grid
// These are what the transition rasters were built from,
// so exporting them lets anyone checking the work
// reproduce the matrices exactly
// -----------------------------------------------------
function exportCommon(image, year) {
  Export.image.toDrive({
    image: image.toByte(),
    description: 'LULC_Gabura_' + year + '_30m',
    folder: 'Gabura_LULC',
    fileNamePrefix: 'LULC_Gabura_' + year + '_common30m',
    region: aoi,
    scale: COMMON_SCALE,
    crs: CRS,
    maxPixels: 1e10
  });
}
exportCommon(c1991, 1991);
exportCommon(c2001, 2001);
exportCommon(c2010, 2010);
exportCommon(c2018, 2018);
exportCommon(c2026, 2026);
// -----------------------------------------------------
// 3. Transition rasters
// Values are two-digit codes: (from * 10) + to
// -----------------------------------------------------
function exportTransition(image, label) {
  Export.image.toDrive({
    image: image.toByte(),
    description: 'Transition_' + label,
    folder: 'Gabura_LULC',
    fileNamePrefix: 'Transition_Gabura_' + label,
    region: aoi,
    scale: COMMON_SCALE,
    crs: CRS,
    maxPixels: 1e10
  });
}
exportTransition(t1991_2001, '1991_2001');
exportTransition(t2001_2010, '2001_2010');
exportTransition(t2010_2018, '2010_2018');
exportTransition(t2018_2026, '2018_2026');
exportTransition(t1991_2026, '1991_2026');
// -----------------------------------------------------
// 4. Training points
// Part of the methods record, worth keeping alongside
// the maps in case anything needs rerunning
// -----------------------------------------------------
function exportTraining(fc, year) {
  Export.table.toDrive({
    collection: fc,
    description: 'Training_' + year,
    folder: 'Gabura_LULC',
    fileNamePrefix: 'Training_Gabura_' + year,
    fileFormat: 'SHP'
  });
}
exportTraining(train1991, 1991);
exportTraining(train2001, 2001);
exportTraining(train2010, 2010);
exportTraining(train2018, 2018);
exportTraining(train2026, 2026);
