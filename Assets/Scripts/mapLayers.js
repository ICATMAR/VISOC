// Map layers shared by more than one map.

// The coastline from the local vector tiles in Data/shoreline-tiles (XYZ
// order, uncompressed MVT, one layer `shoreline`, zooms 0-10 - see its
// metadata.json). Past zoom 10 OpenLayers keeps drawing the zoom-10 tiles,
// which is plenty for a 180px map.
export function createShorelineLayer() {
  return new ol.layer.VectorTile({
    source: new ol.source.VectorTile({
      format: new ol.format.MVT(),
      url: './Data/shoreline-tiles/{z}/{x}/{y}.pbf',
      maxZoom: 10,
    }),
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({ color: 'rgba(255, 255, 255, 0.8)', width: 1 }),
    }),
  });
}

// The platform-detail mini maps: Esri's dark gray canvas (grayscale, so the
// coloured readings and the white circle arrows stand out on it), our own
// shoreline on top for a crisp coast, and the canvas' labels above both so the
// towns can be read. Esri's canvases need no key, like the main map's imagery.
const ESRI_CANVAS = 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/';
function createEsriCanvasLayer(name) {
  return new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: `${ESRI_CANVAS}${name}/MapServer/tile/{z}/{y}/{x}`,
      attributions: '© Esri, HERE, Garmin, © OpenStreetMap contributors',
      maxZoom: 16,
      crossOrigin: 'anonymous',
    }),
  });
}
export function createDetailMapLayers() {
  return [
    createEsriCanvasLayer('World_Dark_Gray_Base'),
    createShorelineLayer(),
    createEsriCanvasLayer('World_Dark_Gray_Reference'),
  ];
}

// The zoom at which a platform `distanceKm` from the coast still has the coast
// in view on a mini map centred on it, never closer than `maxZoom`. Near-shore
// platforms keep maxZoom; offshore ones zoom out just enough.
//
// The coast can be in any direction, so it has to fit within the map's
// half-width, less a margin so it isn't drawn on the very edge. Web Mercator
// stretches distances by 1/cos(latitude), hence the correction.
export function zoomToShowCoast(distanceKm, latitude, maxZoom, mapSizePx = 180) {
  if (!(distanceKm > 0)) return maxZoom;
  const reachPx = mapSizePx / 2 * 0.75;
  const projectedMeters = distanceKm * 1000 / Math.cos(latitude * Math.PI / 180);
  const resolution = projectedMeters / reachPx;     // map units per pixel needed
  const zoom = Math.log2(156543.03392804097 / resolution);
  return Math.min(maxZoom, zoom);
}
