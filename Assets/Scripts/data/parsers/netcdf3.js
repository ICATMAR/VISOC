// A minimal reader for NetCDF-3 files (the classic and 64-bit-offset formats,
// "CDF\x01" / "CDF\x02") - what ERDDAP's griddap answers .nc requests with.
// Enough to pull a variable's values out as a typed array; no writing, no
// NetCDF-4/HDF5.
//
// Only fixed-size variables: a variable along the record (unlimited)
// dimension is interleaved with every other record variable, and ERDDAP's
// griddap files don't have one (numrecs is 0), so it is refused rather than
// read wrong.
//
// Format: https://docs.unidata.ucar.edu/netcdf-c/current/file_format_specifications.html

const NC_DIMENSION = 0x0A;
const NC_VARIABLE = 0x0B;
const NC_ATTRIBUTE = 0x0C;

// nc_type -> [bytes per value, DataView getter, TypedArray]
const TYPES = {
  1: [1, 'getInt8', Int8Array],      // byte
  2: [1, 'getUint8', Uint8Array],    // char
  3: [2, 'getInt16', Int16Array],    // short
  4: [4, 'getInt32', Int32Array],    // int
  5: [4, 'getFloat32', Float32Array],// float
  6: [8, 'getFloat64', Float64Array],// double
};

// Parses the header of `buffer` (an ArrayBuffer): { dimensions, attributes,
// variables }, each variable { name, dimensions: [names], shape, type,
// attributes, read() } - read() returns its values as a typed array, in the
// file's (C) order.
export function readNetCDF3(buffer) {
  const view = new DataView(buffer);
  let p = 0;
  const u32 = () => { const v = view.getUint32(p); p += 4; return v; };
  const offset = version => {
    if (version === 2) { const v = Number(view.getBigUint64(p)); p += 8; return v; }
    return u32();
  };
  const pad = n => (n + 3) & ~3;
  const name = () => {
    const length = u32();
    const text = new TextDecoder().decode(new Uint8Array(buffer, p, length));
    p += pad(length);
    return text;
  };

  const magic = new TextDecoder().decode(new Uint8Array(buffer, 0, 3));
  const version = view.getUint8(3);
  if (magic !== 'CDF' || (version !== 1 && version !== 2))
    throw new Error('Not a NetCDF-3 file');
  p = 4;
  const numrecs = u32();

  const readValues = (type, count) => {
    const [size, getter] = TYPES[type];
    const values = [];
    for (let i = 0; i < count; i++) values.push(view[getter](p + i * size));
    p += pad(count * size);
    return type === 2 ? String.fromCharCode(...values).replace(/\0+$/, '') : values;
  };
  const attributeList = () => {
    const tag = u32();
    const count = u32();
    if (tag !== NC_ATTRIBUTE && count !== 0) throw new Error('Bad NetCDF attribute list');
    const attributes = {};
    for (let i = 0; i < count; i++) {
      const key = name();
      const type = u32();
      const values = readValues(type, u32());
      attributes[key] = Array.isArray(values) && values.length === 1 ? values[0] : values;
    }
    return attributes;
  };

  // Dimensions
  let tag = u32();
  let count = u32();
  if (tag !== NC_DIMENSION && count !== 0) throw new Error('Bad NetCDF dimension list');
  const dimensions = [];
  for (let i = 0; i < count; i++) dimensions.push({ name: name(), size: u32() });

  const attributes = attributeList();

  // Variables
  tag = u32();
  count = u32();
  if (tag !== NC_VARIABLE && count !== 0) throw new Error('Bad NetCDF variable list');
  const variables = {};
  for (let i = 0; i < count; i++) {
    const varName = name();
    const dimIds = Array.from({ length: u32() }, () => u32());
    const varAttributes = attributeList();
    const type = u32();
    u32(); // vsize - recomputed from the shape below, it saturates for big variables
    const begin = offset(version);
    const dims = dimIds.map(id => dimensions[id]);
    const isRecord = dims.some(d => d.size === 0);
    const shape = dims.map(d => d.size === 0 ? numrecs : d.size);
    variables[varName] = {
      name: varName,
      dimensions: dims.map(d => d.name),
      shape,
      type,
      attributes: varAttributes,
      read() {
        if (isRecord) throw new Error(`NetCDF record variable '${varName}' is not supported`);
        const [size, getter, TypedArray] = TYPES[type];
        const length = shape.reduce((a, b) => a * b, 1);
        // One byte per value has no byte order: copy it straight out
        if (size === 1) return new TypedArray(buffer.slice(begin, begin + length));
        const out = new TypedArray(length);
        // Big-endian on disk, so not a straight view onto the buffer
        for (let k = 0; k < length; k++) out[k] = view[getter](begin + k * size);
        return out;
      },
    };
  }

  return { dimensions, attributes, variables };
}
