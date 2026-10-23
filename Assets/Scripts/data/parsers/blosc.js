// A minimal Blosc (v1) decompressor - what Copernicus Marine's ARCO Zarr
// stores are compressed with (see SourceCMEMS): Blosc with LZ4 and byte
// shuffle, every product checked so far (MED and IBI physics, waves,
// biogeochemistry). Decompression only.
//
// Anything else - another inner compressor (zstd, zlib, blosclz) or the
// bit shuffle - is refused rather than read wrong.
//
// Format: https://github.com/Blosc/c-blosc/blob/main/README_CHUNK_FORMAT.rst
//         https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md

const HEADER_SIZE = 16;

const BYTE_SHUFFLE = 0x01;
const MEMCPYED = 0x02;     // stored uncompressed
const BIT_SHUFFLE = 0x04;
const DONT_SPLIT = 0x10;   // blocks were compressed whole, not one stream per byte of a value
const LZ4 = 1;             // compressor code, in the flags' top 3 bits

// One LZ4 block (no frame) from src[start, end) into dst[offset, offset +
// length). Returns nothing - the whole output length is known beforehand.
function lz4Block(src, start, end, dst, offset, length) {
  let s = start;
  let d = offset;
  const stop = offset + length;
  while (s < end) {
    const token = src[s++];

    // Literals
    let literals = token >> 4;
    if (literals === 15) {
      let b;
      do { b = src[s++]; literals += b; } while (b === 255);
    }
    dst.set(src.subarray(s, s + literals), d);
    s += literals;
    d += literals;
    if (s >= end) break; // the last sequence is literals only

    // Match: copied from what was already written, possibly overlapping itself
    const distance = src[s] | (src[s + 1] << 8);
    s += 2;
    let match = token & 15;
    if (match === 15) {
      let b;
      do { b = src[s++]; match += b; } while (b === 255);
    }
    match += 4;
    let from = d - distance;
    if (distance === 0 || from < offset) throw new Error('Blosc: corrupt LZ4 block');
    for (let i = 0; i < match; i++) dst[d++] = dst[from++];
  }
  if (d !== stop) throw new Error(`Blosc: LZ4 block decoded to ${d - offset} bytes, expected ${length}`);
}

// Decompresses one Blosc chunk (a Uint8Array or ArrayBuffer) into a
// Uint8Array of its original bytes.
export function decompressBlosc(input) {
  const src = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(src.buffer, src.byteOffset, src.byteLength);

  const flags = src[2];
  const typesize = src[3];
  const nbytes = view.getUint32(4, true);
  const blocksize = view.getUint32(8, true);

  const out = new Uint8Array(nbytes);
  if (flags & MEMCPYED) {
    out.set(src.subarray(HEADER_SIZE, HEADER_SIZE + nbytes));
    return out;
  }
  if (flags & BIT_SHUFFLE) throw new Error('Blosc: bit shuffle is not supported');
  const compressor = flags >> 5;
  if (compressor !== LZ4) throw new Error(`Blosc: compressor ${compressor} is not supported (only LZ4)`);

  const nblocks = Math.ceil(nbytes / blocksize);
  const block = new Uint8Array(blocksize); // reused - shuffled bytes, before unshuffling
  for (let b = 0; b < nblocks; b++) {
    const size = Math.min(blocksize, nbytes - b * blocksize);
    // A full block is split into one stream per byte of a value (unless the
    // flags say otherwise); the leftover last block never is
    const streams = !(flags & DONT_SPLIT) && size === blocksize ? typesize : 1;
    const streamSize = size / streams;

    let p = view.getInt32(HEADER_SIZE + b * 4, true);
    for (let i = 0; i < streams; i++) {
      const compressed = view.getInt32(p, true);
      p += 4;
      // A stream that wouldn't compress is stored as it is
      if (compressed === streamSize) block.set(src.subarray(p, p + compressed), i * streamSize);
      else lz4Block(src, p, p + compressed, block, i * streamSize, streamSize);
      p += compressed;
    }

    // Byte shuffle: every value's first byte, then every value's second
    // byte... Trailing bytes that don't make a whole value aren't shuffled.
    const target = b * blocksize;
    if (flags & BYTE_SHUFFLE && typesize > 1) {
      const count = Math.floor(size / typesize);
      for (let j = 0; j < typesize; j++) {
        const base = j * count;
        for (let k = 0; k < count; k++) out[target + k * typesize + j] = block[base + k];
      }
      const rest = count * typesize;
      out.set(block.subarray(rest, size), target + rest);
    } else {
      out.set(block.subarray(0, size), target);
    }
  }
  return out;
}
