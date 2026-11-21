// Étape 1 bis de la carte des opportunités : eau de surface en saison sèche et terres proches non exploitées.
// À coller dans l'éditeur Google Earth Engine (https://code.earthengine.google.com), puis Run, puis Tasks > Run.
//
// Pourquoi Earth Engine : l'eau de surface est cartographiée à 30 m (plus de 200 millions de pixels pour le
// Sénégal). On ne charge pas ces pixels dans Snowflake : Earth Engine les ramène à une ligne par département
// et on n'exporte que ce résultat (45 lignes), chargé ensuite dans SALTIS.RAW.E_EAU_SURFACE_DEPARTEMENT.
//
// Avant de lancer : importer les contours GADM niveau 2 du Sénégal comme « table » dans vos assets
// (Assets > New > Shape files, avec le contenu de gadm41_SEN_shp.zip : fichiers gadm41_SEN_2.*),
// puis remplacer le chemin ci-dessous.
var DEPARTEMENTS = ee.FeatureCollection('projects/VOTRE_PROJET/assets/gadm41_SEN_2');

// ---- Paramètres (documentés dans docs/technique/carte-opportunites.md)
var MOIS_EAU_MIN = 10;         // eau présente au moins 10 mois sur 12 : encore là en saison sèche
var RAYON_PROCHE_M = 2000;     // terres à moins de 2 km de cette eau : irrigables par pompage simple
var NDVI_VERT = 0.3;           // en saison sèche, au-dessus de 0,3 la parcelle est cultivée (ou boisée)
var ANNEES = [2021, 2024];     // saisons sèches observées (février à avril)
var ECHELLE_M = 100;           // résolution de calcul (l'eau est cartographiée à 30 m, regroupée à 100 m)

// ---- 1. Eau de surface (JRC Global Surface Water, Landsat 1984-2021) : nombre de mois avec de l'eau
var gsw = ee.Image('JRC/GSW1_4/GlobalSurfaceWater');
var proj = ee.Projection('EPSG:4326').atScale(ECHELLE_M);
var eauPermanente = gsw.select('seasonality').gte(MOIS_EAU_MIN).unmask(0)
  .reduceResolution({reducer: ee.Reducer.max(), maxPixels: 1024}).reproject(proj);
var eauSaisonniere = gsw.select('seasonality').gt(0).and(gsw.select('seasonality').lt(MOIS_EAU_MIN)).unmask(0)
  .reduceResolution({reducer: ee.Reducer.max(), maxPixels: 1024}).reproject(proj);

// ---- 2. Terres proches de cette eau (hors eau)
var procheEau = eauPermanente.focalMax({radius: RAYON_PROCHE_M, units: 'meters'}).and(eauPermanente.not());

// ---- 3. Terres qu'on peut mettre en culture : cultures, prairies, arbustes (ESA WorldCover 2021, 10 m)
// Exclus : arbres, bâti, eau, zones humides, mangroves, sol nu (souvent des tannes salées).
var occupation = ee.ImageCollection('ESA/WorldCover/v200').first();
var cultivable = occupation.remap([20, 30, 40], [1, 1, 1], 0)
  .reduceResolution({reducer: ee.Reducer.mode(), maxPixels: 1024}).reproject(proj);

// ---- 4. Végétation en saison sèche (MODIS MOD13Q1, 250 m) : médiane février-avril des années retenues
var ndvi = ee.ImageCollection('MODIS/061/MOD13Q1')
  .filter(ee.Filter.calendarRange(ANNEES[0], ANNEES[1], 'year'))
  .filter(ee.Filter.calendarRange(2, 4, 'month'))
  .select('NDVI').median().multiply(0.0001)
  .resample('bilinear').reproject(proj);
var vertSaisonSeche = ndvi.gte(NDVI_VERT);

// ---- 5. Surfaces en hectares
var ha = ee.Image.pixelArea().divide(10000);
var procheCultivable = procheEau.and(cultivable);
var surfaces = ee.Image.cat([
  ha.updateMask(eauPermanente).rename('surface_eau_permanente_ha'),
  ha.updateMask(eauSaisonniere).rename('surface_eau_saisonniere_ha'),
  ha.updateMask(procheEau).rename('surface_proche_eau_ha'),
  ha.updateMask(procheCultivable).rename('surface_proche_eau_cultivable_ha'),
  ha.updateMask(procheCultivable.and(vertSaisonSeche)).rename('surface_proche_eau_verte_ha'),
  ha.updateMask(procheCultivable.and(vertSaisonSeche.not())).rename('surface_proche_eau_inexploitee_ha')
]);
var sommes = surfaces.reduceRegions({
  collection: DEPARTEMENTS, reducer: ee.Reducer.sum(), scale: ECHELLE_M, crs: 'EPSG:4326', tileScale: 4
});
var ndviProche = ndvi.updateMask(procheCultivable).rename('ndvi_saison_seche_proche_eau');
var resultat = ndviProche.reduceRegions({
  collection: sommes, reducer: ee.Reducer.mean().setOutputs(['ndvi_saison_seche_proche_eau']),
  scale: ECHELLE_M, crs: 'EPSG:4326', tileScale: 4
}).map(function (f) {
  return f.set({
    code_departement: f.get('GID_2'),
    periode_ndvi: 'février-avril ' + ANNEES[0] + '-' + ANNEES[1],
    source: 'JRC Global Surface Water v1.4 ; ESA WorldCover 2021 ; MODIS MOD13Q1 v061'
  });
});

// Contrôle visuel avant export
Map.centerObject(DEPARTEMENTS, 7);
Map.addLayer(eauPermanente.selfMask(), {palette: ['0050ff']}, 'Eau au moins ' + MOIS_EAU_MIN + ' mois');
Map.addLayer(procheCultivable.and(vertSaisonSeche.not()).selfMask(), {palette: ['ffb000']}, 'Proche de l\'eau, non exploité');
Map.addLayer(procheCultivable.and(vertSaisonSeche).selfMask(), {palette: ['00a050']}, 'Proche de l\'eau, déjà vert');
print('Aperçu (3 départements)', resultat.limit(3));

Export.table.toDrive({
  collection: resultat,
  description: 'e_eau_surface_departement',
  fileNamePrefix: 'e_eau_surface_departement',
  fileFormat: 'CSV',
  selectors: [
    'code_departement', 'surface_eau_permanente_ha', 'surface_eau_saisonniere_ha', 'surface_proche_eau_ha',
    'surface_proche_eau_cultivable_ha', 'surface_proche_eau_verte_ha', 'surface_proche_eau_inexploitee_ha',
    'ndvi_saison_seche_proche_eau', 'periode_ndvi', 'source'
  ]
});
// Le fichier arrive dans Google Drive : le copier dans data/modules/e_eau_surface_departement.csv.
