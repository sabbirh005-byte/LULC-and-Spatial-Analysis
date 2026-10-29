// =====================================================
// STEP 4 ONWARD: CLASSIFICATION AND RESULTS OUTPUTS
//
// 1. Accuracy assessment table (OA, Kappa, PA, UA)
// 2. Area by class by year table
// 3. Transition matrix
// 4. LULC maps, five panels
// 5. Change map for key transitions
// 6. Index graphs, dry and monsoon, all years
//
// CLASS CODES (property = 'Landcover'):
// 0 Rice | 1 Vegetation | 2 Aquaculture
// 3 Fallow/Saline | 4 Settlement
// =====================================================
// -----------------------------------------------------
// 0. Shared constants
// -----------------------------------------------------
var CRS = 'EPSG:32645';          // UTM 45N, SW Bangladesh
var COMMON_SCALE = 30;
var PROJ30 = ee.Projection(CRS).atScale(COMMON_SCALE);
var CLASS_NAMES = ['Rice', 'Vegetation', 'Aquaculture',
                   'Fallow_Saline', 'Settlement'];
var CLASS_COLORS = ['ffd92f', '2e7d32', '00b8d4',
                    'd9a066', 'e31a1c'];
var INDICES = ['NDVI', 'NDWI', 'MNDWI', 'NDBI'];
var BANDS_L57 = ['SR_B1','SR_B2','SR_B3','SR_B4','SR_B5','SR_B7']
  .concat(INDICES);
var BANDS_S2 = ['B2','B3','B4','B8','B11','B12']
  .concat(INDICES);
// =====================================================
// STEP 4: TRAINING DATA AND CLASSIFICATION
// =====================================================
// -----------------------------------------------------
// 4.1 Merge each year's classes
// 'Landcover' is already set on every import
// -----------------------------------------------------
var train1991 = ee.FeatureCollection(y91_Rice)
  .merge(y91_Vegetation).merge(y91_Acquaculture)
  .merge(y91_Fallow).merge(y91_Settlement);
var train2001 = ee.FeatureCollection(y01_Rice)
  .merge(y01_Vegetation).merge(y01_Acquaculture)
  .merge(y01_Fallow).merge(y01_Settlement);
var train2010 = ee.FeatureCollection(y10_Rice)      // Rice empty
  .merge(y10_Vegetation).merge(y10_Acquaculture)
  .merge(y10_Fallow).merge(y10_Settlement);
var train2018 = ee.FeatureCollection(y18_Rice)
  .merge(y18_Vegetation).merge(y18_Acquaculture)
  .merge(y18_Fallow).merge(y18_Settlement);
var train2026 = ee.FeatureCollection(y26_Rice)
  .merge(y26_Vegetation).merge(y26_Acquaculture)
  .merge(y26_Fallow).merge(y26_Settlement);
print('=== POINTS PER CLASS ===');
print('1991:', train1991.aggregate_histogram('Landcover'));
print('2001:', train2001.aggregate_histogram('Landcover'));
print('2010:', train2010.aggregate_histogram('Landcover'));
print('2018:', train2018.aggregate_histogram('Landcover'));
print('2026:', train2026.aggregate_histogram('Landcover'));
// -----------------------------------------------------
// 4.2 Predictor stacks
//
// Bands are selected explicitly because sampleRegions
// drops a pixel if ANY band is masked there. The raw
// stacks carry QA, thermal and mask layers, and QA60
// comes through empty in recent Sentinel-2 imagery,
// which masked every pixel and made 2018 and 2026
// sample zero. This also stops Random Forest from
// training on QA layers.
// -----------------------------------------------------
var rf1991 = stack1991_dry.select(BANDS_L57);
var rf2001 = stack2001_dry.select(BANDS_L57);
var rf2010 = stack2010_dry.select(BANDS_L57);
var rf2018 = stack2018_dry.select(BANDS_S2);
var rf2026 = stack2026_dry.select(BANDS_S2);
// -----------------------------------------------------
// 4.3 Classify, returning an OBJECT not just an image
//
// This is the fix for "r1991 is not defined". The old
// version returned only the classified image, so the
// confusion matrix could not be reused downstream.
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
    numberOfTrees: 150, seed: 42
  }).train({
    features: training,
    classProperty: 'Landcover',
    inputProperties: stack.bandNames()
  });
  var confusion = validation.classify(classifier)
    .errorMatrix('Landcover', 'classification');
  print('=========== ' + label + ' ===========');
  print('Points drawn:',      points.size());
  print('Pixels sampled:',    samples.size());
  print('Sampled per class:', samples.aggregate_histogram('Landcover'));
  print('Overall accuracy:',  confusion.accuracy());
  print('Kappa:',             confusion.kappa());
  return {
    image:      stack.classify(classifier).clip(aoi),
    classifier: classifier,
    confusion:  confusion,
    nTrain:     training.size(),
    nValid:     validation.size(),
    label:      label
  };
}
var r1991 = classifyYear(rf1991, train1991, 30, '1991');
var r2001 = classifyYear(rf2001, train2001, 30, '2001');
var r2010 = classifyYear(rf2010, train2010, 30, '2010');
var r2018 = classifyYear(rf2018, train2018, 10, '2018');
var r2026 = classifyYear(rf2026, train2026, 10, '2026');
// -----------------------------------------------------
// 4.4 Majority filter
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
var lulc1991_s = majorityFilter(r1991.image, 30);
var lulc2001_s = majorityFilter(r2001.image, 30);
var lulc2010_s = majorityFilter(r2010.image, 30);
var lulc2018_s = majorityFilter(r2018.image, 10);
var lulc2026_s = majorityFilter(r2026.image, 10);
// =====================================================
// 1. ACCURACY ASSESSMENT TABLE
// OA, Kappa, per-class PA and UA, all five years
// =====================================================
function accuracyRow(r) {
  var pa = r.confusion.producersAccuracy().toList().flatten();
  var ua = r.confusion.consumersAccuracy().toList().flatten();
  var props = ee.Dictionary({
    year:              r.label,
    training_pixels:   r.nTrain,
    validation_pixels: r.nValid,
    overall_accuracy:  r.confusion.accuracy(),
    kappa:             r.confusion.kappa()
  });
  CLASS_NAMES.forEach(function(name, i) {
    props = props
      .set('PA_' + name, ee.Number(pa.get(i)))
      .set('UA_' + name, ee.Number(ua.get(i)));
  });
  return ee.Feature(null, props);
}
var accuracyTable = ee.FeatureCollection([
  accuracyRow(r1991), accuracyRow(r2001), accuracyRow(r2010),
  accuracyRow(r2018), accuracyRow(r2026)
]);
print('=== ACCURACY SUMMARY ===');
print(accuracyTable);
print(ui.Chart.feature.byFeature(accuracyTable, 'year',
    ['overall_accuracy', 'kappa'])
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Classification accuracy by year',
    hAxis: {title: 'Year'},
    vAxis: {title: 'Value', viewWindow: {min: 0, max: 1}},
    colors: ['2e7d32', '4a90d9']
  }));
// Full five by five matrices. Row and column order is
// the CLASS_NAMES order. Transcribe at least one of
// these into the thesis as a full table.
print('=== FULL CONFUSION MATRICES ===');
print('Order: ' + CLASS_NAMES.join(', '));
print('1991:', r1991.confusion.array());
print('2001:', r2001.confusion.array());
print('2010:', r2010.confusion.array());
print('2018:', r2018.confusion.array());
print('2026:', r2026.confusion.array());
// Matrices as CSV, one row per truth class per year
function matrixRows(r) {
  var arr = ee.Array(r.confusion.array()).toList();
  return ee.FeatureCollection(CLASS_NAMES.map(function(truth, i) {
    var row = ee.List(arr.get(i));
    var props = ee.Dictionary({year: r.label, truth_class: truth});
    CLASS_NAMES.forEach(function(pred, j) {
      props = props.set('pred_' + pred, ee.Number(row.get(j)));
    });
    return ee.Feature(null, props);
  }));
}
var matrixTable = matrixRows(r1991)
  .merge(matrixRows(r2001)).merge(matrixRows(r2010))
  .merge(matrixRows(r2018)).merge(matrixRows(r2026));
// Variable importance, a methods-chapter figure
var imp2026 = ee.Dictionary(r2026.classifier.explain().get('importance'));
print(ui.Chart.array.values({
  array: ee.Array(imp2026.values()),
  axis: 0,
  xLabels: imp2026.keys()
}).setChartType('ColumnChart')
  .setOptions({
    title: 'Random Forest variable importance, 2026',
    hAxis: {title: 'Predictor'},
    vAxis: {title: 'Importance'},
    legend: {position: 'none'}
  }));
// =====================================================
// 2. AREA BY CLASS BY YEAR TABLE
// =====================================================
function areaRow(classified, scale, year) {
  var grouped = ee.List(
    ee.Image.pixelArea().divide(10000)          // m2 to ha
      .addBands(classified.rename('class'))
      .reduceRegion({
        reducer: ee.Reducer.sum().group({
          groupField: 1, groupName: 'class'}),
        geometry: aoi, scale: scale,
        maxPixels: 1e10, tileScale: 4
      }).get('groups'));
  var props = ee.Dictionary(
    grouped.iterate(function(item, acc) {
      item = ee.Dictionary(item);
      var name = ee.List(CLASS_NAMES).get(item.getNumber('class'));
      return ee.Dictionary(acc).set(name, item.getNumber('sum'));
    }, ee.Dictionary({}))
  );
  return ee.Feature(null, props.set('year', year));
}
var areaTable = ee.FeatureCollection([
  areaRow(lulc1991_s, 30, 1991),
  areaRow(lulc2001_s, 30, 2001),
  areaRow(lulc2010_s, 30, 2010),
  areaRow(lulc2018_s, 10, 2018),
  areaRow(lulc2026_s, 10, 2026)
]);
print('=== AREA BY CLASS (ha) ===');
print(areaTable);
print(ui.Chart.feature.byFeature(areaTable, 'year', CLASS_NAMES)
  .setChartType('LineChart')
  .setOptions({
    title: 'Land cover area, Gabura Union 1991 to 2026',
    hAxis: {title: 'Year', format: '####'},
    vAxis: {title: 'Area (hectares)'},
    pointSize: 5, lineWidth: 2,
    colors: CLASS_COLORS
  }));
// Stacked percentage reads better than raw hectares
// when the AOI total shifts slightly between sensors
print(ui.Chart.feature.byFeature(areaTable, 'year', CLASS_NAMES)
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Land cover composition, Gabura Union',
    hAxis: {title: 'Year'},
    vAxis: {title: 'Share of AOI'},
    isStacked: 'percent',
    colors: CLASS_COLORS
  }));
// =====================================================
// 3. TRANSITION MATRIX
//
// Landsat years are 30 m, Sentinel years 10 m, so all
// maps go onto a shared 30 m grid first. Comparing them
// pixel by pixel without that produces false transitions
// along every boundary.
// =====================================================
// -----------------------------------------------------
// 3.1 Common grid
// -----------------------------------------------------
function toCommonGrid30(classified) {
  return classified
    .setDefaultProjection({crs: CRS, scale: 30})
    .reproject(PROJ30)
    .clip(aoi);
}
// mode() preserves class integers; mean would invent
// values that are not classes. maxPixels 16 is ample,
// since nine 10 m cells fit in a 30 m cell.
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
print('=== PROJECTION CHECK (expect EPSG:32645) ===');
print('c1991:', c1991.projection());
print('c2026:', c2026.projection());
// -----------------------------------------------------
// 3.2 Wide transition matrix
// One row per FROM class, one column per TO class.
// This is the layout a thesis table takes, so it
// pastes in with no pivoting.
// -----------------------------------------------------
function matrixWide(fromImg, toImg, label) {
  var rows = CLASS_NAMES.map(function(fromName, f) {
    var props = ee.Dictionary({period: label, from_class: fromName});
    CLASS_NAMES.forEach(function(toName, t) {
      var area = ee.Number(ee.Image.pixelArea().divide(10000)
        .updateMask(fromImg.eq(f).and(toImg.eq(t)).selfMask())
        .reduceRegion({
          reducer: ee.Reducer.sum(),
          geometry: aoi, scale: COMMON_SCALE, crs: CRS,
          maxPixels: 1e10, tileScale: 4
        }).get('area'));
      props = props.set('to_' + toName, area);
    });
    return ee.Feature(null, props);
  });
  return ee.FeatureCollection(rows);
}
// -----------------------------------------------------
// 3.3 Flat transition table
// One row per from-to pair. Feeds a Sankey directly
// once the unchanged rows are dropped.
// -----------------------------------------------------
function flatTransition(fromImg, toImg, label) {
  var pairs = [];
  for (var f = 0; f < 5; f++) {
    for (var t = 0; t < 5; t++) { pairs.push([f, t]); }
  }
  var rows = pairs.map(function(p) {
    var area = ee.Number(ee.Image.pixelArea().divide(10000)
      .updateMask(fromImg.eq(p[0]).and(toImg.eq(p[1])).selfMask())
      .reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi, scale: COMMON_SCALE, crs: CRS,
        maxPixels: 1e10, tileScale: 4
      }).get('area'));
    return ee.Feature(null, {
      period:    label,
      from:      CLASS_NAMES[p[0]],
      to:        CLASS_NAMES[p[1]],
      area_ha:   area,
      unchanged: p[0] === p[1]
    });
  });
  return ee.FeatureCollection(rows);
}
var mx_full      = matrixWide(c1991, c2026, '1991-2026');
var mx_1991_2001 = matrixWide(c1991, c2001, '1991-2001');
var mx_2001_2010 = matrixWide(c2001, c2010, '2001-2010');
var mx_2010_2018 = matrixWide(c2010, c2018, '2010-2018');
var mx_2018_2026 = matrixWide(c2018, c2026, '2018-2026');
var tt_full      = flatTransition(c1991, c2026, '1991-2026');
var tt_1991_2001 = flatTransition(c1991, c2001, '1991-2001');
var tt_2018_2026 = flatTransition(c2018, c2026, '2018-2026');
print('=== TRANSITION MATRIX 1991 to 2026 (ha) ===');
print(mx_full);
print('=== TRANSITION MATRIX 1991 to 2001 (ha) ===');
print(mx_1991_2001);
// Conversion pathways, unchanged dropped
var changedOnly = tt_full
  .filter(ee.Filter.eq('unchanged', false))
  .filter(ee.Filter.gt('area_ha', 1))
  .map(function(f) {
    return f.set('pathway',
      ee.String(f.get('from')).cat(' to ').cat(f.get('to')));
  });
print(ui.Chart.feature.byFeature(changedOnly, 'pathway', ['area_ha'])
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Conversion pathways, 1991 to 2026',
    hAxis: {title: 'Pathway', slantedText: true, slantedTextAngle: 45},
    vAxis: {title: 'Area (hectares)'},
    legend: {position: 'none'},
    colors: ['7b1fa2']
  }));
// =====================================================
// 4. LULC MAPS, FIVE PANELS
//
// Thumbnails give a quick draft figure. The GeoTIFF
// exports are what the final thesis figure should be
// built from, composed in ArcGIS Pro or QGIS where you
// control scale bar, north arrow and inset.
// =====================================================
var visClass = {min: 0, max: 4, palette: CLASS_COLORS};
Map.addLayer(lulc1991_s, visClass, 'LULC 1991', false);
Map.addLayer(lulc2001_s, visClass, 'LULC 2001', false);
Map.addLayer(lulc2010_s, visClass, 'LULC 2010', false);
Map.addLayer(lulc2018_s, visClass, 'LULC 2018', false);
Map.addLayer(lulc2026_s, visClass, 'LULC 2026', true);
// Land cover legend
var legend = ui.Panel({
  style: {position: 'bottom-left', padding: '8px 12px'}
});
legend.add(ui.Label('Land Cover', {
  fontWeight: 'bold', fontSize: '14px', margin: '0 0 6px 0'}));
['Rice','Vegetation','Aquaculture','Fallow/Saline','Settlement']
  .forEach(function(name, i) {
    legend.add(ui.Panel({
      widgets: [
        ui.Label('', {backgroundColor: CLASS_COLORS[i],
                      padding: '9px', margin: '0 6px 3px 0'}),
        ui.Label(name, {margin: '0 0 4px 0', fontSize: '12px'})
      ],
      layout: ui.Panel.Layout.Flow('horizontal')
    }));
  });
Map.add(legend);
// Draft thumbnails, one per year. Click each URL.
print('=== LULC PANEL THUMBNAILS (click to download) ===');
[{img: lulc1991_s, year: 1991},
 {img: lulc2001_s, year: 2001},
 {img: lulc2010_s, year: 2010},
 {img: lulc2018_s, year: 2018},
 {img: lulc2026_s, year: 2026}
].forEach(function(p) {
  print(p.year + ':', p.img.getThumbURL({
    region: aoi, dimensions: 900, format: 'png',
    min: 0, max: 4, palette: CLASS_COLORS
  }));
});
// =====================================================
// 5. CHANGE MAP FOR KEY TRANSITIONS
//
// One categorical raster where each key pathway gets
// its own value, so the whole change story sits in a
// single figure rather than five overlays.
//
// 1 Rice to Aquaculture
// 2 Rice to Fallow
// 3 Fallow to Aquaculture
// 4 Aquaculture to Rice   (the return farmers describe)
// 5 Fallow to Rice        (recovery of abandoned land)
// =====================================================
function transition(fromImg, toImg) {
  return fromImg.multiply(10).add(toImg).rename('transition');
}
var t1991_2001 = transition(c1991, c2001);
var t2001_2010 = transition(c2001, c2010);
var t2010_2018 = transition(c2010, c2018);
var t2018_2026 = transition(c2018, c2026);
var t1991_2026 = transition(c1991, c2026);
function keyChangeMap(tImg) {
  return ee.Image(0)
    .where(tImg.eq(2),  1)   // Rice to Aquaculture
    .where(tImg.eq(3),  2)   // Rice to Fallow
    .where(tImg.eq(32), 3)   // Fallow to Aquaculture
    .where(tImg.eq(20), 4)   // Aquaculture to Rice
    .where(tImg.eq(30), 5)   // Fallow to Rice
    .selfMask()
    .rename('change')
    .clip(aoi);
}
var changeMap_full = keyChangeMap(t1991_2026);
var changeMap_early = keyChangeMap(t1991_2001);
var CHANGE_NAMES = [
  'Rice to Aquaculture', 'Rice to Fallow',
  'Fallow to Aquaculture', 'Aquaculture to Rice',
  'Fallow to Rice'
];
var CHANGE_COLORS = ['e31a1c','ff8800','7b1fa2','2e7d32','9ccc65'];
Map.addLayer(changeMap_full,
  {min: 1, max: 5, palette: CHANGE_COLORS},
  'Key transitions 1991 to 2026', true);
Map.addLayer(changeMap_early,
  {min: 1, max: 5, palette: CHANGE_COLORS},
  'Key transitions 1991 to 2001', false);
var changeLegend = ui.Panel({
  style: {position: 'bottom-right', padding: '8px 12px'}
});
changeLegend.add(ui.Label('Key transitions', {
  fontWeight: 'bold', fontSize: '13px', margin: '0 0 6px 0'}));
CHANGE_NAMES.forEach(function(name, i) {
  changeLegend.add(ui.Panel({
    widgets: [
      ui.Label('', {backgroundColor: CHANGE_COLORS[i],
                    padding: '9px', margin: '0 6px 3px 0'}),
      ui.Label(name, {margin: '0 0 4px 0', fontSize: '12px'})
    ],
    layout: ui.Panel.Layout.Flow('horizontal')
  }));
});
Map.add(changeLegend);
print('=== CHANGE MAP THUMBNAILS ===');
print('1991-2026:', changeMap_full.getThumbURL({
  region: aoi, dimensions: 1100, format: 'png',
  min: 1, max: 5, palette: CHANGE_COLORS}));
print('1991-2001:', changeMap_early.getThumbURL({
  region: aoi, dimensions: 1100, format: 'png',
  min: 1, max: 5, palette: CHANGE_COLORS}));
// Area of each key pathway, so the map has numbers
// beside it in the text
function changeAreaTable(cm, label) {
  return ee.FeatureCollection(
    CHANGE_NAMES.map(function(name, i) {
      var area = ee.Number(ee.Image.pixelArea().divide(10000)
        .updateMask(cm.eq(i + 1))
        .reduceRegion({
          reducer: ee.Reducer.sum(),
          geometry: aoi, scale: COMMON_SCALE, crs: CRS,
          maxPixels: 1e10, tileScale: 4
        }).get('area'));
      return ee.Feature(null,
        {period: label, pathway: name, area_ha: area});
    }));
}
var changeAreas_full  = changeAreaTable(changeMap_full,  '1991-2026');
var changeAreas_early = changeAreaTable(changeMap_early, '1991-2001');
print('=== KEY TRANSITION AREAS ===');
print('1991 to 2026:', changeAreas_full);
print('1991 to 2001:', changeAreas_early);
// =====================================================
// 6. INDEX GRAPHS, DRY AND MONSOON, ALL YEARS
//
// AOI-wide mean, standard deviation and valid pixel
// count for each index, every composite year, both
// seasons. 2001 and 2008 composites are built on aoi2,
// but the reducer runs over aoi, so rows are comparable.
// =====================================================
function indexRow(stack, year, season, scale) {
  var stats = stack.select(INDICES).reduceRegion({
    reducer: ee.Reducer.mean()
      .combine(ee.Reducer.stdDev(), null, true)
      .combine(ee.Reducer.count(),  null, true),
    geometry: aoi, scale: scale,
    maxPixels: 1e10, tileScale: 4
  });
  return ee.Feature(null, ee.Dictionary(stats)
    .set('year', year).set('season', season));
}
var indexTable = ee.FeatureCollection([
  indexRow(stack1991_dry, 1991, 'dry', 30),
  indexRow(stack2001_dry, 2001, 'dry', 30),
  indexRow(stack2008_dry, 2008, 'dry', 30),
  indexRow(stack2010_dry, 2010, 'dry', 30),
  indexRow(stack2014_dry, 2014, 'dry', 30),
  indexRow(stack2018_dry, 2018, 'dry', 10),
  indexRow(stack2022_dry, 2022, 'dry', 10),
  indexRow(stack2024_dry, 2024, 'dry', 10),
  indexRow(stack2026_dry, 2026, 'dry', 10),
  indexRow(stack1991_mon, 1991, 'monsoon', 30),
  indexRow(stack2001_mon, 2001, 'monsoon', 30),
  indexRow(stack2008_mon, 2008, 'monsoon', 30),
  indexRow(stack2010_mon, 2010, 'monsoon', 30),
  indexRow(stack2014_mon, 2014, 'monsoon', 30),
  indexRow(stack2018_mon, 2018, 'monsoon', 10),
  indexRow(stack2022_mon, 2022, 'monsoon', 10),
  indexRow(stack2024_mon, 2024, 'monsoon', 10),
  indexRow(stack2026_mon, 2026, 'monsoon', 10)
]);
print('=== INDEX SUMMARY, ALL YEARS AND SEASONS ===');
print(indexTable);
var dryOnly = indexTable.filter(ee.Filter.eq('season', 'dry'));
var monOnly = indexTable.filter(ee.Filter.eq('season', 'monsoon'));
// -----------------------------------------------------
// 6a. One chart per index, dry against monsoon
// Four charts: NDVI, NDWI, MNDWI, NDBI
// -----------------------------------------------------
function seasonChart(indexName) {
  var d = dryOnly.map(function(f) {
    return ee.Feature(null, {
      year: f.get('year'), Dry: f.get(indexName + '_mean')});
  });
  var m = monOnly.map(function(f) {
    return ee.Feature(null, {
      year: f.get('year'), Monsoon: f.get(indexName + '_mean')});
  });
  print(ui.Chart.feature.byFeature(d.merge(m), 'year',
      ['Dry', 'Monsoon'])
    .setChartType('LineChart')
    .setOptions({
      title: indexName + ' mean over Gabura, dry and monsoon',
      hAxis: {title: 'Year', format: '####'},
      vAxis: {title: indexName + ' (AOI mean)'},
      pointSize: 5, lineWidth: 2,
      interpolateNulls: true,
      colors: ['d9a066', '2e7d32']
    }));
}
print('=== INDEX TRENDS BY SEASON ===');
INDICES.forEach(seasonChart);
// -----------------------------------------------------
// 6b. All four indices on one chart, per season
// -----------------------------------------------------
function allIndexChart(fc, seasonLabel) {
  var wide = fc.map(function(f) {
    return ee.Feature(null, {
      year:  f.get('year'),
      NDVI:  f.get('NDVI_mean'),
      NDWI:  f.get('NDWI_mean'),
      MNDWI: f.get('MNDWI_mean'),
      NDBI:  f.get('NDBI_mean')
    });
  });
  print(ui.Chart.feature.byFeature(wide, 'year', INDICES)
    .setChartType('LineChart')
    .setOptions({
      title: seasonLabel + ' season index means, 1991 to 2026',
      hAxis: {title: 'Year', format: '####'},
      vAxis: {title: 'Index value (AOI mean)'},
      pointSize: 5, lineWidth: 2,
      colors: ['2e7d32', '4a90d9', '0d47a1', 'e31a1c']
    }));
}
allIndexChart(dryOnly, 'Dry');
allIndexChart(monOnly, 'Monsoon');
// -----------------------------------------------------
// 6c. Seasonal gap
// Monsoon mean minus dry mean. A widening NDVI gap means
// more land green in monsoon and bare in dry, which is
// the signature of single-season Aman rice rather than
// year-round cultivation.
// -----------------------------------------------------
var YEARS = [1991, 2001, 2008, 2010, 2014, 2018, 2022, 2024, 2026];
var gapTable = ee.FeatureCollection(YEARS.map(function(y) {
  var d = ee.Feature(dryOnly.filter(ee.Filter.eq('year', y)).first());
  var m = ee.Feature(monOnly.filter(ee.Filter.eq('year', y)).first());
  return ee.Feature(null, {
    year: y,
    NDVI_gap:  ee.Number(m.get('NDVI_mean'))
                 .subtract(ee.Number(d.get('NDVI_mean'))),
    MNDWI_gap: ee.Number(m.get('MNDWI_mean'))
                 .subtract(ee.Number(d.get('MNDWI_mean')))
  });
}));
print('=== SEASONAL INDEX GAP ===');
print(gapTable);
print(ui.Chart.feature.byFeature(gapTable, 'year',
    ['NDVI_gap', 'MNDWI_gap'])
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Seasonal index gap (monsoon minus dry), Gabura',
    hAxis: {title: 'Year', format: '####'},
    vAxis: {title: 'Difference in AOI mean'},
    colors: ['2e7d32', '0d47a1']
  }));
// -----------------------------------------------------
// 6d. Valid pixel counts, a data quality check
// A year whose monsoon count sits far below its dry
// count has a composite full of holes, so its monsoon
// mean rests on few and possibly unrepresentative
// pixels. Check this before citing any monsoon figure.
// -----------------------------------------------------
var countTable = indexTable.map(function(f) {
  return ee.Feature(null, {
    year:   f.get('year'),
    season: f.get('season'),
    valid_pixels: f.get('NDVI_count')
  });
});
print('=== VALID PIXEL COUNTS ===');
print(countTable);
// =====================================================
// 7. EXPORT
//
// EPSG:32645 throughout, so areas measured in GIS match
// the hectare figures above. These calls only QUEUE the
// jobs. Open the Tasks tab and run each one.
// =====================================================
function exportTable(fc, name) {
  Export.table.toDrive({
    collection: fc, description: name,
    folder: 'Gabura_LULC',
    fileNamePrefix: 'Gabura_' + name,
    fileFormat: 'CSV'
  });
}
// Tables. Build the final thesis figures from these in
// Excel or R. GEE charts are for checking, not print.
exportTable(accuracyTable,     'accuracy_summary');
exportTable(matrixTable,       'confusion_matrices');
exportTable(areaTable,         'area_by_class');
exportTable(mx_full,           'matrix_1991_2026');
exportTable(mx_1991_2001,      'matrix_1991_2001');
exportTable(mx_2001_2010,      'matrix_2001_2010');
exportTable(mx_2010_2018,      'matrix_2010_2018');
exportTable(mx_2018_2026,      'matrix_2018_2026');
exportTable(tt_full,           'transitions_1991_2026');
exportTable(tt_1991_2001,      'transitions_1991_2001');
exportTable(tt_2018_2026,      'transitions_2018_2026');
exportTable(changeAreas_full,  'key_transitions_1991_2026');
exportTable(changeAreas_early, 'key_transitions_1991_2001');
exportTable(indexTable,        'index_summary_all_years');
exportTable(gapTable,          'seasonal_index_gap');
exportTable(countTable,        'index_valid_pixel_counts');
// Classified maps at native resolution
function exportLULC(image, year, scale) {
  Export.image.toDrive({
    image: image.toByte(),
    description: 'LULC_Gabura_' + year,
    folder: 'Gabura_LULC',
    fileNamePrefix: 'LULC_Gabura_' + year,
    region: aoi, scale: scale, crs: CRS, maxPixels: 1e10
  });
}
exportLULC(lulc1991_s, 1991, 30);
exportLULC(lulc2001_s, 2001, 30);
exportLULC(lulc2010_s, 2010, 30);
exportLULC(lulc2018_s, 2018, 10);
exportLULC(lulc2026_s, 2026, 10);
// Same maps on the shared 30 m grid, which is what the
// matrices were built from
function exportCommon(image, year) {
  Export.image.toDrive({
    image: image.toByte(),
    description: 'LULC_Gabura_' + year + '_30m',
    folder: 'Gabura_LULC',
    fileNamePrefix: 'LULC_Gabura_' + year + '_common30m',
    region: aoi, scale: COMMON_SCALE, crs: CRS, maxPixels: 1e10
  });
}
exportCommon(c1991, 1991);
exportCommon(c2001, 2001);
exportCommon(c2010, 2010);
exportCommon(c2018, 2018);
exportCommon(c2026, 2026);
// Change maps and full transition rasters
function exportImage(image, name) {
  Export.image.toDrive({
    image: image.toByte(),
    description: name,
    folder: 'Gabura_LULC',
    fileNamePrefix: 'Gabura_' + name,
    region: aoi, scale: COMMON_SCALE, crs: CRS, maxPixels: 1e10
  });
}
exportImage(changeMap_full,  'changemap_key_1991_2026');
exportImage(changeMap_early, 'changemap_key_1991_2001');
exportImage(t1991_2026, 'transition_1991_2026');
exportImage(t1991_2001, 'transition_1991_2001');
exportImage(t2001_2010, 'transition_2001_2010');
exportImage(t2010_2018, 'transition_2010_2018');
exportImage(t2018_2026, 'transition_2018_2026');
// Training points, part of the methods record
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
