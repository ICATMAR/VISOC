// How the HFR dashboard describes a data source in the info panel - shared
// by Compare (a source picked in its names column) and Point (the selected
// hour's source): rows of { label, value, url, long }, labels translated by
// the panel.

// Text the EU HFR Node published as Latin-1 read as UTF-8 ("DirecciÃ³" for
// "Direcció"): re-read as UTF-8. escape() gives the Latin-1 bytes back and
// decodeURIComponent reads them as UTF-8; on text that was right to begin
// with ("Política"), that is not valid UTF-8 and throws, so it is kept.
export const repairEncoding = text => {
  try { return /[À-ÿ][\u0080-¿]/.test(text) ? decodeURIComponent(escape(text)) : text; }
  catch { return text; }
};

// ISO 8601 durations as ERDDAP writes them: 'PT1H' -> '1 h', 'P1D' -> '1 d'
export const formatDuration = value => {
  const match = String(value ?? '').match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match || !match.slice(1).some(Boolean)) return value;
  const [, d, h, m, sec] = match;
  return [d && `${d} d`, h && `${h} h`, m && `${m} min`, sec && `${sec} s`].filter(Boolean).join(' ');
};

// Rows of label / value, leaving out what has no value - and the
// placeholders some datasets write instead of leaving it out
const collector = () => {
  const rows = [];
  const add = (label, value, long) => {
    if (value == undefined || /^(|void|none|unknown|n\/a)$/i.test(String(value).trim())) return;
    rows.push({ label, value: repairEncoding(String(value)).replace(/\s+/g, ' ').trim(), long });
  };
  return { rows, add };
};

// The parts of an ERDDAP dataset's NC_GLOBAL worth showing
export const metadataRows = metadata => {
  const { rows, add } = collector();
  add('Title', metadata.title, true);
  // Some list one institution twice ('A, B, B')
  add('Institution', metadata.institution && [...new Set(repairEncoding(String(metadata.institution)).split(/\s*,\s*/))].join(', '));
  add('Network', metadata.network ?? metadata.site_code);
  add('Source', metadata.source);
  add('Processing level', metadata.processing_level);
  add('Time step', formatDuration(metadata.time_coverage_resolution));
  add('Updated', metadata.update_interval);
  if (metadata.geospatial_lat_resolution)
    add('Resolution', `${Number(metadata.geospatial_lat_resolution).toFixed(3)}º × ${Number(metadata.geospatial_lon_resolution).toFixed(3)}º`);
  if (metadata.time_coverage_start)
    add('Coverage', `${String(metadata.time_coverage_start).substring(0, 10)} – ${String(metadata.time_coverage_end ?? '').substring(0, 10)}`);
  add('License', metadata.license, true);
  add('Acknowledgement', metadata.acknowledgement ?? metadata.citation, true);
  return rows;
};

// What an ICATMAR GitHub file's header (a CODAR LLUV .tuv / .ruv) says that
// an ERDDAP dataset's metadata says too - its instrument, processing, time
// step, resolution - and nothing the ERDDAP datasets don't have
export const fileHeaderRows = header => {
  const { rows, add } = collector();
  const unquote = value => value == undefined ? value : String(value).replace(/"/g, '').trim();
  add('Source', header.Manufacturer);
  add('Processing tool', header.ProcessingTool ?? header.LLUVSpec);
  // The time the file's data was averaged over ('75.000 Minutes')
  const coverage = String(header.TimeCoverage ?? '').match(/^([\d.]+)\s*Minutes?/i);
  add('Time coverage', coverage ? `${Number(coverage[1])} min` : header.TimeCoverage);
  if (header.GridSpacing) add('Resolution', header.GridSpacing);
  else if (header.RangeResolutionKMeters)
    add('Resolution', `${Number(header.RangeResolutionKMeters).toFixed(2)} km × ${unquote(header.AngularResolution)}`);
  if (header.TransmitCenterFreqMHz) add('Frequency', `${Number(header.TransmitCenterFreqMHz).toFixed(3)} MHz`);
  const stamp = String(header.ProcessedTimeStamp ?? '').trim().split(/\s+/);
  if (stamp.length >= 6) add('Processed', `${stamp[0]}-${stamp[1]}-${stamp[2]} ${stamp[3]}:${stamp[4]} UTC`);
  return rows;
};
