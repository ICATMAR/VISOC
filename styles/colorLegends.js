// Timeline cell colour scales (normalized 0..1 over a variable's range), one
// palette shared by every variable that's conceptually similar.
const LEGENDS = {
  WIND: [
    [0.00, [255, 255, 255]], // 0
    [0.15, [0, 255, 255]],   // 6 kn
    [0.25, [110, 200, 110]],     // 10 kn
    [0.37, [255, 230, 130]],   // 20 kn
    [0.50, [255, 180, 130]],   // 20 kn
    [0.75, [255, 140, 140]],     // 30 kn
    [1.00, [255, 140, 255]],   // 40 kn
  ],
  CLOUDS: [ // White to gray
    [0.00, [255, 255, 255]],
    [0.50, [255, 255, 255]],
    [0.75, [220, 220, 220]],
    [1.00, [127, 127, 127]],
  ],
  TEMPERATURE: [
    [0.00, [206, 226, 226]],
    [0.25, [208, 214, 226]],
    [0.50, [226, 208, 161]],
    [1.00, [226, 172, 165]],
  ],
  BLANK: [
    [0.00, [255, 255, 255]],
    [1.00, [255, 255, 255]],
  ],
  WAVES: [
    [0.00, [255, 255, 255]], // 0 m
    [0.15, [200, 240, 255]], // 0.6 m
    [0.3, [114, 200, 255]], // 1.2 m
    // [0.30, [127, 131, 255]], // 1.2 m
    [0.60, [80, 140, 255]],     // 2.4 m
    [1.00, [255, 0, 255]],   // 4 m
  ],
  HUMIDITY: [ // White to clear blue
    [0.00, [255, 255, 255]],
    [0.50, [255, 255, 255]],
    [1.00, [0, 255, 255]],
  ],
  PHPH: [
    [0.00, [175, 255, 110]], // 7
    [0.33, [110, 255, 120]], // 
    [0.66, [120, 255, 190]], // 
    [1, [140, 255, 250]] // 9
  ]
};


// Standard variable code -> legend. Codes not listed fall back to BLANK (see
// GUIManager.colorLegend), which is a fine default for anything without an
// obviously matching palette.
const COLOR_LEGENDS = {
  // Wind speed, gusts, relative wind, and current speed all read as a "how
  // strong" scale
  WSPD: LEGENDS.WIND,
  GUST: LEGENDS.WIND,
  WRSP: LEGENDS.WIND,
  HCSP: LEGENDS.WIND,

  // Air/sea/dew point/wet bulb temperatures
  DRYT: LEGENDS.TEMPERATURE,
  TEMP: LEGENDS.TEMPERATURE,
  SAMITEMP: LEGENDS.TEMPERATURE,
  DEWT: LEGENDS.TEMPERATURE,
  WETT: LEGENDS.TEMPERATURE,

  CLOUD: LEGENDS.CLOUDS,

  PHPH: LEGENDS.PHPH,

  // Reused as a generic low-to-high gradient for other bounded variables
  RELH: LEGENDS.HUMIDITY,
  VTM02: LEGENDS.HUMIDITY, // wave period
  PSAL: LEGENDS.HUMIDITY,  // salinity
  ATMS: LEGENDS.HUMIDITY,  // atmospheric pressure

  ADNS: LEGENDS.BLANK, // air density: no dedicated palette

  VHM0: LEGENDS.WAVES,

  // Fallback for any code above without an entry (see GUIManager.colorLegend)
  BLANK: LEGENDS.BLANK,
};


// What each scale is normalized OVER, in STANDARD units (see
// data/variables.js) - the [min, max] that maps onto a legend's 0..1 stops.
//
// Here rather than in variables.js because a range isn't a property of the
// variable, it's a property of how we choose to colour it: it is picked to
// spread the Catalan coast's usual values across the palette, not to bound
// what the variable can be. Values outside it clamp to the end colours.
//
// A code with no entry has no colour: GUIManager.colorFor returns undefined
// and the caller keeps whatever background it draws by default.
const VARIABLE_RANGES = {
  // Wind and currents
  WSPD: [0, 20],    // m/s
  GUST: [0, 25],    // m/s
  WRSP: [0, 20],    // m/s
  HCSP: [0, 1],     // m/s

  // Waves
  VHM0: [0, 4],     // m
  VTM02: [0, 12],   // s

  // Temperatures - sea and air are spread differently, which is exactly why
  // a range can't belong to the unit group they share
  TEMP: [10, 28],     // ºC
  SAMITEMP: [10, 28], // ºC
  DRYT: [0, 35],      // ºC
  DEWT: [0, 35],      // ºC
  WETT: [0, 35],      // ºC

  // Other bounded variables
  PSAL: [36, 38.5],   // practical salinity
  RELH: [0, 100],     // %
  ATMS: [980, 1030],  // hPa
  PHPH: [7, 9],
};


export { VARIABLE_RANGES };
export default COLOR_LEGENDS;
