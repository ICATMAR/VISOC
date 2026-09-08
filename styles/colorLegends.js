// Timeline cell colour scales (normalized 0..1 over a variable's range), one
// palette shared by every variable that's conceptually similar.
const LEGENDS = {
  WIND: [
    [0.00, [255, 255, 255]], // 0
    [0.15, [0, 255, 255]],   // 6 kn
    [0.25, [0, 180, 0]],     // 10 kn
    [0.50, [255, 255, 0]],   // 20 kn
    [0.75, [255, 0, 0]],     // 30 kn
    [1.00, [255, 0, 255]],   // 40 kn
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
    [0.15, [114, 200, 255]], // 0.6 m
    [0.30, [127, 131, 255]], // 1.2 m
    [0.60, [70, 70, 0]],     // 2.4 m
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


export default COLOR_LEGENDS;
