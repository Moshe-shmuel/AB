import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const electronDir = path.join(rootDir, 'electron');
const publicDir = path.join(rootDir, 'public');

fs.mkdirSync(electronDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

const WIDTH = 256;
const HEIGHT = 256;

// Precompute CRC32 table for valid PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Signed Distance Function for a rounded rectangle
function sdRoundedBox(px, py, x, y, w, h, r) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const hx = w / 2 - r;
  const hy = h / 2 - r;
  const dx = Math.max(Math.abs(px - cx) - hx, 0);
  const dy = Math.max(Math.abs(py - cy) - hy, 0);
  const outside = Math.hypot(dx, dy);
  const inside = Math.min(Math.max(Math.abs(px - cx) - hx, Math.abs(py - cy) - hy), 0);
  return outside + inside - r;
}

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function blendPixel(dst, srcR, srcG, srcB, srcA) {
  const a = clamp01(srcA);
  if (a <= 0) return;
  const outA = a + dst.a * (1 - a);
  if (outA <= 0) return;
  dst.r = (srcR * a + dst.r * dst.a * (1 - a)) / outA;
  dst.g = (srcG * a + dst.g * dst.a * (1 - a)) / outA;
  dst.b = (srcB * a + dst.b * dst.a * (1 - a)) / outA;
  dst.a = outA;
}

// Render 256x256 anti-aliased RGBA icon
const rawData = Buffer.alloc(HEIGHT * (1 + WIDTH * 4));

for (let y = 0; y < HEIGHT; y++) {
  const rowOffset = y * (1 + WIDTH * 4);
  rawData[rowOffset] = 0; // PNG filter type 0 (None)

  for (let x = 0; x < WIDTH; x++) {
    const px = x + 0.5;
    const py = y + 0.5;
    const pixel = { r: 0, g: 0, b: 0, a: 0 };

    // 1. Main Squircle Background (12, 12, 232, 232, rx=56)
    const dBg = sdRoundedBox(px, py, 12, 12, 232, 232, 56);
    const covBg = clamp01(0.5 - dBg);
    if (covBg > 0) {
      const gradT = clamp01((px + py - 24) / 440);
      // #2563EB (37, 99, 235) -> #1E3A8A (30, 58, 138)
      const bgR = lerp(37, 30, gradT);
      const bgG = lerp(99, 58, gradT);
      const bgB = lerp(235, 138, gradT);
      blendPixel(pixel, bgR, bgG, bgB, covBg);

      // Subtle inner border ring
      const borderAlpha = clamp01(1 - Math.abs(dBg + 2.5) / 1.5) * 0.18 * covBg;
      blendPixel(pixel, 255, 255, 255, borderAlpha);

      // 2. Right Bar (164, 132, 32, 68, rx=12) -> #93C5FD (147, 197, 253)
      const dBar1 = sdRoundedBox(px, py, 164, 132, 32, 68, 12);
      const covBar1 = clamp01(0.5 - dBar1);
      if (covBar1 > 0) {
        blendPixel(pixel, 147, 197, 253, covBar1);
      }

      // 3. Middle Bar (112, 98, 32, 102, rx=12) -> #FFFFFF (255, 255, 255)
      const dBar2 = sdRoundedBox(px, py, 112, 98, 32, 102, 12);
      const covBar2 = clamp01(0.5 - dBar2);
      if (covBar2 > 0) {
        blendPixel(pixel, 255, 255, 255, covBar2);
      }

      // 4. Left Tall Bar (60, 64, 32, 136, rx=12) -> Emerald Gradient #34D399 to #10B981
      const dBar3 = sdRoundedBox(px, py, 60, 64, 32, 136, 12);
      const covBar3 = clamp01(0.5 - dBar3);
      if (covBar3 > 0) {
        const emT = clamp01((py - 64) / 136);
        const emR = lerp(52, 16, emT);
        const emG = lerp(211, 185, emT);
        const emB = lerp(153, 129, emT);
        blendPixel(pixel, emR, emG, emB, covBar3);
      }

      // 5. Gold Coin / Maaser Emblem at (180, 82, r=22) -> #FBBF24 (251, 191, 36)
      const dCoin = sdCircle(px, py, 180, 82, 22);
      const covCoin = clamp01(0.5 - dCoin);
      if (covCoin > 0) {
        blendPixel(pixel, 251, 191, 36, covCoin);
        // Inner coin ring at r=14.5
        const ringAlpha = clamp01(1 - Math.abs(dCoin + 7.5) / 1.4) * 0.65 * covCoin;
        blendPixel(pixel, 254, 243, 199, ringAlpha);
      }
    }

    const pIdx = rowOffset + 1 + x * 4;
    rawData[pIdx] = Math.round(pixel.r);
    rawData[pIdx + 1] = Math.round(pixel.g);
    rawData[pIdx + 2] = Math.round(pixel.b);
    rawData[pIdx + 3] = Math.round(pixel.a * 255);
  }
}

// Assemble PNG buffer
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8; // 8-bit depth
ihdr[9] = 6; // RGBA color type
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const compressedData = zlib.deflateSync(rawData, { level: 9 });
const pngBuffer = Buffer.concat([
  pngSignature,
  makePngChunk('IHDR', ihdr),
  makePngChunk('IDAT', compressedData),
  makePngChunk('IEND', Buffer.alloc(0)),
]);

// Assemble Windows .ICO buffer (256x256 PNG-in-ICO format)
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // Reserved
icoHeader.writeUInt16LE(1, 2); // Type 1 = ICO
icoHeader.writeUInt16LE(1, 4); // 1 image

const icoEntry = Buffer.alloc(16);
icoEntry[0] = 0; // 0 means 256px width
icoEntry[1] = 0; // 0 means 256px height
icoEntry[2] = 0; // Palette
icoEntry[3] = 0; // Reserved
icoEntry.writeUInt16LE(1, 4); // Color planes
icoEntry.writeUInt16LE(32, 6); // 32 bits per pixel
icoEntry.writeUInt32LE(pngBuffer.length, 8); // Size of PNG data
icoEntry.writeUInt32LE(22, 12); // Offset (6 + 16 = 22)

const icoBuffer = Buffer.concat([icoHeader, icoEntry, pngBuffer]);

const pngPath = path.join(electronDir, 'icon.png');
const icoPath = path.join(electronDir, 'icon.ico');
const publicIcoPath = path.join(publicDir, 'favicon.ico');

fs.writeFileSync(pngPath, pngBuffer);
fs.writeFileSync(icoPath, icoBuffer);
fs.writeFileSync(publicIcoPath, icoBuffer);

console.log('✅ Generated Electron & Windows app icons (256x256):');
console.log('   -', pngPath);
console.log('   -', icoPath);
console.log('   -', publicIcoPath);
