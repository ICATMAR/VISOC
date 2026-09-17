// The standard vocabulary: what every code in the app means, and the unit it
// is ALWAYS carried in outside the view layer.
//
// Sources and data products deal only in these units. A source that publishes
// something else converts on the way in, through the catalogue's
// `unitTransform` (see Catalogue.js) - so by the time a value reaches DPBuoys
// or the block cache it is standard, and stays standard. The only place a
// value becomes anything else is at render time, through the unit options
// below.
//
// That split is what keeps the cache valid across a unit change: switching to
// knots re-renders, it doesn't re-fetch.
//
// `unit` is the CF table's own unit, written with slashes rather than negative
// exponents ('m/s', not 'm s-1'), so it reads the same way the display
// spellings in UNIT_GROUPS do. A variable with no `unitGroup` isn't
// switchable and is shown in its standard unit as-is.

// Beaufort is a SCALE, not a unit: a force number covers a band of speeds
// rather than converting from one. These are the WMO band UPPER limits in m/s
// (force 0 is below 0.5, force 12 is anything above the last one), so the
// index of the first limit a speed doesn't exceed is its force.
//
// Being lossy is the point - a mariner reads "force 6", not "12.4 m/s" - but
// it does mean this is the one display unit you cannot convert back from, so
// nothing but rendering may ever use it.
const BEAUFORT_LIMITS = [0.5, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
const toBeaufort = speed => {
  const force = BEAUFORT_LIMITS.findIndex(limit => speed < limit);
  return force === -1 ? 12 : force;
};

// Quantities the user can switch, and how to get from the standard unit to
// each alternative. The FIRST option of every group is the standard one, so
// its toDisplay is the identity - keep it that way when adding units.
const UNIT_GROUPS = {
  windSpeed: [
    { unit: 'm/s',  decimals: 1, toDisplay: value => value },
    { unit: 'kn',   decimals: 0, toDisplay: value => value * 1.94384 },
    { unit: 'km/h', decimals: 0, toDisplay: value => value * 3.6 },
    // Whole forces only - a fractional Beaufort would be a contradiction
    { unit: 'Bft',  decimals: 0, toDisplay: toBeaufort },
  ],
  // Kept apart from windSpeed even though both are m/s: currents are read in
  // cm/s where wind never is, and nobody wants one picker driving both.
  waterSpeed: [
    { unit: 'm/s',  decimals: 2, toDisplay: value => value },
    { unit: 'cm/s', decimals: 0, toDisplay: value => value * 100 },
    { unit: 'kn',   decimals: 2, toDisplay: value => value * 1.94384 },
  ],
  temperature: [
    { unit: 'ºC', decimals: 1, toDisplay: value => value },
    { unit: 'ºF', decimals: 1, toDisplay: value => value * 9 / 5 + 32 },
    // No degree sign: kelvin is written K, never ºK
    { unit: 'K',  decimals: 1, toDisplay: value => value + 273.15 },
  ],
  waveHeight: [
    { unit: 'm',  decimals: 1, toDisplay: value => value },
    { unit: 'ft', decimals: 0, toDisplay: value => value * 3.28084 },
  ],
  // Vertical measures - depth, height, sea level. Nautical miles would be
  // meaningless here; they belong to coastDistance below.
  distance: [
    { unit: 'm',  decimals: 1, toDisplay: value => value },
    { unit: 'ft', decimals: 1, toDisplay: value => value * 3.28084 },
  ],
  // How far offshore something is, which is the one horizontal distance the
  // app shows - and the only quantity here whose standard unit isn't the SI
  // base one, because the catalogue already records it in km.
  coastDistance: [
    { unit: 'km', decimals: 0, toDisplay: value => value },
    { unit: 'NM', decimals: 0, toDisplay: value => value / 1.852 },
  ],
};

const VARIABLES = {
  // DIMENSIONS
  LATITUDE:         { longName: 'Latitude of each sample',      standardName: 'latitude',             unit: 'deg' },
  LONGITUDE:        { longName: 'Longitude of each sample',     standardName: 'longitude',            unit: 'deg' },
  DEPLOY_LATITUDE:  { longName: 'Latitude of each deployment',  standardName: 'deployment_latitude',  unit: 'deg' },
  DEPLOY_LONGITUDE: { longName: 'Longitude of each deployment', standardName: 'deployment_longitude', unit: 'deg' },
  DEPTH:  { longName: 'Depth below sea water',  standardName: 'depth',               unit: 'm',    unitGroup: 'distance' },
  HEIGHT: { longName: 'Height above sea water', standardName: 'height',              unit: 'm',    unitGroup: 'distance' },
  PRES:   { longName: 'Sea water pressure',     standardName: 'sea_water_pressure',  unit: 'dbar' },
  // Not a CF code - a property of a platform rather than a measurement (see
  // distanceToCoast in Data/buoys/buoys.js), kept here so it can be named and
  // switched like everything else.
  DISTCOAST: { longName: 'Distance to the coast', unit: 'km', unitGroup: 'coastDistance' },

  // WAVES - significant or average height
  VHM0:  { longName: 'Spectral significant wave height (Hm0)',      standardName: 'sea_surface_wave_significant_height',            unit: 'm', unitGroup: 'waveHeight' },
  VGHS:  { longName: 'Generic significant wave height (Hs)',        standardName: 'sea_surface_wave_significant_height',            unit: 'm', unitGroup: 'waveHeight' },
  VHM1:  { longName: 'Spectral wave height (Hm1)',                                                                                 unit: 'm', unitGroup: 'waveHeight' },
  VAVH:  { longName: 'Average height highest 1/3 wave (H1/3)',      standardName: 'sea_surface_wave_significant_height',            unit: 'm', unitGroup: 'waveHeight' },
  VH110: { longName: 'Average height highest 1/10 wave (H1/10)',    standardName: 'sea_surface_wave_mean_height_of_highest_tenth',  unit: 'm', unitGroup: 'waveHeight' },
  VHZA:  { longName: 'Average zero crossing wave height (Hzm)',     standardName: 'sea_surface_wave_mean_height',                   unit: 'm', unitGroup: 'waveHeight' },
  // WAVES - maximum height
  VZMX:  { longName: 'Maximum zero crossing wave height (Hmax)',    standardName: 'sea_surface_wave_maximum_height',        unit: 'm', unitGroup: 'waveHeight' },
  VEMH:  { longName: 'Estimated maximum wave height',              standardName: 'sea_surface_wave_maximum_height',        unit: 'm', unitGroup: 'waveHeight' },
  VHMH:  { longName: 'Spectral maximum wave height (Hmax)',        standardName: 'sea_surface_wave_maximum_height',        unit: 'm', unitGroup: 'waveHeight' },
  VCMX:  { longName: 'Maximum crest trough wave height (Hc,max)',  standardName: 'sea_surface_wave_maximum_height',        unit: 'm', unitGroup: 'waveHeight' },
  VMXL:  { longName: 'Height of the highest crest',                standardName: 'sea_surface_wave_maximum_crest_height',  unit: 'm', unitGroup: 'waveHeight' },
  // WAVES - period
  VGTA:  { longName: 'Generic average wave period',                       standardName: 'sea_surface_wave_mean_period', unit: 's' },
  VMTW:  { longName: 'Wave energy period',                                                                              unit: 's' },
  VM01:  { longName: 'Spectral moments (0,1) wave period (Tm01)',         standardName: 'sea_surface_wave_mean_period_from_variance_spectral_density_first_frequency_moment',   unit: 's' },
  VTM02: { longName: 'Spectral moments (0,2) wave period (Tm02)',         standardName: 'sea_surface_wave_mean_period_from_variance_spectral_density_second_frequency_moment',  unit: 's' },
  VTM10: { longName: 'Spectral moments (-1,0) wave period (Tm-10)',       standardName: 'sea_surface_wave_mean_period_from_variance_spectral_density_inverse_frequency_moment', unit: 's' },
  VTZA:  { longName: 'Average zero crossing wave period (Tz)',            standardName: 'sea_surface_wave_mean_period', unit: 's' },
  VT3:   { longName: 'Wave mean period of the 1/3 highest waves',         standardName: 'sea_surface_wave_mean_period', unit: 's' },
  VT10:  { longName: 'Wave mean period of the 1/10 highest waves',        standardName: 'sea_surface_wave_mean_period', unit: 's' },
  // WAVES - peak period
  VTPK:  { longName: 'Wave period at spectral peak / peak period (Tp)',   standardName: 'sea_surface_wave_period_at_variance_spectral_density_maximum', unit: 's' },
  VAVT:  { longName: 'Average period highest 1/3 wave (T1/3)',            standardName: 'sea_surface_wave_significant_period',           unit: 's' },
  VT110: { longName: 'Average period highest 1/10 wave (T1/10)',          standardName: 'sea_surface_wave_mean_period_of_highest_tenth', unit: 's' },
  VPMX:  { longName: 'Period based on successive up/downcrossings (Pmax)', standardName: 'sea_surface_wave_maximum_period',              unit: 's' },
  VTMX:  { longName: 'Maximum wave period (Tmax)',                        standardName: 'sea_surface_wave_maximum_period',               unit: 's' },
  VTZM:  { longName: 'Period of the highest wave (Thmax)',                standardName: 'sea_surface_wave_period_of_highest_wave',       unit: 's' },
  // WAVES - mean direction
  VMDR:   { longName: 'Mean wave direction from (Mdir)', standardName: 'sea_surface_wave_from_direction', unit: 'deg' },
  VDIR:   { longName: 'Wave direction rel. true north',  standardName: 'sea_surface_wave_from_direction', unit: 'deg' },
  THETA1: { longName: 'Mean wave from direction',        standardName: 'sea_surface_wave_from_direction', unit: 'deg' },
  // WAVES - peak direction
  VPED:   { longName: 'Wave principal direction at spectral peak', standardName: 'sea_surface_wave_from_direction_at_variance_spectral_density_maximum', unit: 'deg' },
  THETA2: { longName: 'Principal wave from direction',             standardName: 'sea_surface_wave_from_direction', unit: 'deg' },
  // WAVES - swell
  VSWH: { longName: 'Swell height',    standardName: 'sea_surface_swell_wave_significant_height', unit: 'm', unitGroup: 'waveHeight' },
  VSWT: { longName: 'Swell period',    standardName: 'sea_surface_swell_wave_period',             unit: 's' },
  VSWD: { longName: 'Swell direction', standardName: 'sea_surface_swell_wave_from_direction',     unit: 'deg' },
  // WAVES - wind waves
  VMWH: { longName: 'Wind wave height',    standardName: 'sea_surface_wind_wave_significant_height', unit: 'm', unitGroup: 'waveHeight' },
  VMWT: { longName: 'Wind wave period',    standardName: 'sea_surface_wind_wave_mean_period',        unit: 's' },
  VMWD: { longName: 'Wind wave direction', standardName: 'sea_surface_wind_wave_from_direction',     unit: 'deg' },
  // WAVES - Fourier coefficients of the wave spectrum
  VFA1: { longName: 'Fourier coefficient a1 of the wave spectrum', unit: '1' },
  VFA2: { longName: 'Fourier coefficient a2 of the wave spectrum', unit: '1' },
  VFB1: { longName: 'Fourier coefficient b1 of the wave spectrum', unit: '1' },
  VFB2: { longName: 'Fourier coefficient b2 of the wave spectrum', unit: '1' },
  // WAVES - other
  VST1:    { longName: 'Maximum wave steepness',                    standardName: 'sea_surface_wave_maximum_steepness', unit: '1' },
  VEPK:    { longName: 'Wave spectrum peak energy (Smax)',          standardName: 'sea_surface_wave_energy_at_variance_spectral_density_maximum', unit: 'm2 s' },
  VPSP:    { longName: 'Wave directional spreading at spectral peak', standardName: 'sea_surface_wave_directional_spread_at_variance_spectral_density_maximum', unit: 'deg' },
  VSPEC1D: { longName: 'Wave scalar spectral density',              standardName: 'sea_surface_wave_variance_spectral_density', unit: 'm2 s' },
  STHETA1: { longName: 'Directional spread around THETA1',          standardName: 'sea_surface_wave_directional_spread', unit: 'deg' },
  STHETA2: { longName: 'Directional spread around THETA2',          standardName: 'sea_surface_wave_directional_spread', unit: 'deg' },
  UNDX:    { longName: 'Unidirectivity index of waves by acoustic doppler wave array', unit: '1' },

  // PHYSICAL OCEANOGRAPHY
  TEMP:   { longName: 'Sea temperature',             standardName: 'sea_water_temperature',           unit: 'ºC', unitGroup: 'temperature' },
  THETAO: { longName: 'Sea potential temperature',   standardName: 'sea_water_potential_temperature', unit: 'ºC', unitGroup: 'temperature' },
  PSAL:   { longName: 'Practical salinity',          standardName: 'sea_water_practical_salinity',    unit: '1' },
  CNDC:   { longName: 'Electrical conductivity',     standardName: 'sea_water_electrical_conductivity', unit: 'S/m' },
  DENS:   { longName: 'Sea density (sigma-theta)',   standardName: 'sea_water_sigma_theta',           unit: 'kg/m3' },
  SIGT:   { longName: 'Sea density (sigma-t)',       standardName: 'sea_water_sigma_t',               unit: 'kg/m3' },
  SVEL:   { longName: 'Sound velocity',              standardName: 'speed_of_sound_in_sea_water',     unit: 'm/s' },
  BATH:   { longName: 'Bathymetric depth',           standardName: 'sea_floor_depth_below_sea_surface', unit: 'm', unitGroup: 'distance' },

  // SEA WATER VELOCITY
  HCSP: { longName: 'Horizontal current speed',                  standardName: 'sea_water_speed',                unit: 'm/s', unitGroup: 'waterSpeed' },
  HCDT: { longName: 'Current to direction relative true north',  standardName: 'direction_of_sea_water_velocity', unit: 'deg' },
  EWCT: { longName: 'West-east current component',               standardName: 'eastward_sea_water_velocity',    unit: 'm/s', unitGroup: 'waterSpeed' },
  NSCT: { longName: 'South-north current component',             standardName: 'northward_sea_water_velocity',   unit: 'm/s', unitGroup: 'waterSpeed' },
  VCSP: { longName: 'Bottom-top current component',              standardName: 'upward_sea_water_velocity',      unit: 'm/s', unitGroup: 'waterSpeed' },

  // METEOROLOGICAL
  WSPD: { longName: 'Horizontal wind speed',                       standardName: 'wind_speed',              unit: 'm/s', unitGroup: 'windSpeed' },
  WDIR: { longName: 'Wind from direction relative true north',     standardName: 'wind_from_direction',     unit: 'deg' },
  WRSP: { longName: 'Relative wind speed',                         standardName: 'wind_speed',              unit: 'm/s', unitGroup: 'windSpeed' },
  WRDR: { longName: 'Relative wind direction',                     standardName: 'wind_from_direction',     unit: 'deg' },
  WCDR: { longName: 'Corrected wind direction',                    standardName: 'wind_from_direction',     unit: 'deg' },
  GSPD: { longName: 'Gust wind speed',                             standardName: 'wind_speed_of_gust',      unit: 'm/s', unitGroup: 'windSpeed' },
  GDIR: { longName: 'Gust wind from direction relative true north', standardName: 'wind_gust_from_direction', unit: 'deg' },
  WSPE: { longName: 'West-east wind component',                    standardName: 'eastward_wind',           unit: 'm/s', unitGroup: 'windSpeed' },
  WSPN: { longName: 'South-north wind component',                  standardName: 'northward_wind',          unit: 'm/s', unitGroup: 'windSpeed' },
  WSPU: { longName: 'Bottom-top wind component',                   standardName: 'upward_air_velocity',     unit: 'm/s', unitGroup: 'windSpeed' },
  WBFO: { longName: 'Beaufort wind force',                         standardName: 'beaufort_wind_force',     unit: '1' },
  DRYT: { longName: 'Air temperature in dry bulb',                 standardName: 'air_temperature',         unit: 'ºC', unitGroup: 'temperature' },
  WETT: { longName: 'Air temperature in wet bulb',                 standardName: 'wet_bulb_temperature',    unit: 'ºC', unitGroup: 'temperature' },
  DEWT: { longName: 'Dew point temperature',                       standardName: 'dew_point_temperature',   unit: 'ºC', unitGroup: 'temperature' },
  RELH: { longName: 'Relative humidity',                           standardName: 'relative_humidity',       unit: '%' },
  ATMS: { longName: 'Atmospheric pressure at sea level',           standardName: 'air_pressure_at_sea_level', unit: 'hPa' },
  ATMP: { longName: 'Atmospheric pressure at altitude',            standardName: 'air_pressure',            unit: 'hPa' },
  ATPT: { longName: 'Atmospheric pressure hourly tendency',        standardName: 'tendency_of_air_pressure', unit: 'hPa/h' },
  ADNS: { longName: 'Air density',                                 standardName: 'air_density',             unit: 'kg/m3' },
  PRRT: { longName: 'Hourly precipitation rate (liquid water equivalent)', standardName: 'lwe_precipitation_rate', unit: 'mm/h' },
  PRRD: { longName: 'Daily precipitation rate (liquid water equivalent)',  standardName: 'lwe_precipitation_rate', unit: 'mm/d' },
  RAINR: { longName: 'Rainfall rate',      standardName: 'rainfall_rate',     unit: 'm/s' },
  RAIND: { longName: 'Rain duration',      standardName: 'rain_duration',     unit: 's' },
  RAINC: { longName: 'Rain accumulation',  standardName: 'rain_accumulation', unit: 'mm' },

  // SEA LEVEL
  SLEV: { longName: 'Water surface height above a specific datum',       standardName: 'water_surface_height_above_reference_datum',       unit: 'm', unitGroup: 'distance' },
  SLVR: { longName: 'Non tidal elevation of sea surface height',         standardName: 'non_tidal_elevation_of_sea_surface_height',        unit: 'm', unitGroup: 'distance' },
  TIDE: { longName: 'Tidal sea surface height above a specific datum',   standardName: 'tidal_sea_surface_height_above_reference_datum',   unit: 'm', unitGroup: 'distance' },

  // BIO-CHEMICAL
  DOXY: { longName: 'Dissolved oxygen',  standardName: 'mole_concentration_of_dissolved_molecular_oxygen_in_sea_water', unit: 'mmol/m3' },
  DOX1: { longName: 'Dissolved oxygen',  standardName: 'volume_fraction_of_oxygen_in_sea_water',                        unit: 'ml/l' },
  DOX2: { longName: 'Dissolved oxygen',  standardName: 'moles_of_oxygen_per_unit_mass_in_sea_water',                    unit: 'µmol/kg' },
  OSAT: { longName: 'Oxygen saturation', standardName: 'fractional_saturation_of_oxygen_in_sea_water',                  unit: '%' },
  CPHL: { longName: 'Chlorophyll-a',     standardName: 'mass_concentration_of_chlorophyll_a_in_sea_water',              unit: 'mg/m3' },
  CHLT: { longName: 'Total chlorophyll', standardName: 'mass_concentration_of_chlorophyll_in_sea_water',                unit: 'mg/m3' },
  TUR4: { longName: 'Turbidity',         standardName: 'sea_water_turbidity',                                          unit: '1' },
  PHPH: { longName: 'Ph',                standardName: 'sea_water_ph_reported_on_total_scale',                          unit: '1' },

  // SENSOR DATA
  SVLT:   { longName: 'Voltage from battery, solar panel, power supply or other', unit: 'V' },
  SCUR:   { longName: 'Current of the system',                                    unit: 'A' },
  STMP:   { longName: 'Temperature of device or system',                          unit: 'ºC', unitGroup: 'temperature' },
  SISON:  { longName: 'Is the sensor on',                                         unit: '1' },
  SHEAD:  { longName: 'Sensor heading',                                           unit: 'deg' },
  SYAW:   { longName: 'Sensor yaw',    standardName: 'platform_yaw',              unit: 'deg' },
  SPITCH: { longName: 'Sensor pitch',  standardName: 'platform_pitch',            unit: 'deg' },
  SROLL:  { longName: 'Sensor roll',   standardName: 'platform_roll',             unit: 'deg' },
  SSNUM:  { longName: 'Number of samples',                 standardName: 'number_of_observations',         unit: '1' },
  SSREM:  { longName: 'Number of remaining measurements',  standardName: 'number_of_missing_observations', unit: '1' },
};

export { VARIABLES, UNIT_GROUPS };
export default VARIABLES;
