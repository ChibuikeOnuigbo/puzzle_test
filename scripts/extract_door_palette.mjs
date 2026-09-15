/* Extract a door paint palette from a generated reference PNG.
   Pure-node PNG decode (zlib inflate + unfilter), then samples the door
   body: base (median), light (bright decile), shade (dark decile of the
   lower half), frame dark. Output JSON to stdout.
   usage: node scripts/extract_door_palette.mjs <png>
*/
import fs from "node:fs";
import zlib from "node:zlib";

const file = process.argv[2];
const buf = fs.readFileSync(file);
if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a png");
let pos = 8, ihdr = null;
const idat = [];
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.toString("ascii", pos + 4, pos + 8);
  const data = buf.subarray(pos + 8, pos + 8 + len);
  if (type === "IHDR") ihdr = {
    w: data.readUInt32BE(0), h: data.readUInt32BE(4),
    depth: data[8], color: data[9], interlace: data[12],
  };
  if (type === "IDAT") idat.push(data);
  if (type === "IEND") break;
  pos += 12 + len;
}
if (!ihdr || ihdr.depth !== 8 || ihdr.interlace !== 0) throw new Error("unsupported png");
const ch = ihdr.color === 6 ? 4 : ihdr.color === 2 ? 3 : ihdr.color === 0 ? 1 : 0;
if (!ch) throw new Error("unsupported color type " + ihdr.color);
const raw = zlib.inflateSync(Buffer.concat(idat));
const stride = ihdr.w * ch;
const out = Buffer.alloc(ihdr.h * stride);
const paeth = (a, b, c) => {
  const p = a + b - c;
  const da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
  return da <= db && da <= dc ? a : db <= dc ? b : c;
};
for (let y = 0; y < ihdr.h; y++) {
  const f = raw[y * (stride + 1)];
  const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
  const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
  const cur = out.subarray(y * stride, (y + 1) * stride);
  for (let x = 0; x < stride; x++) {
    const a = x >= ch ? cur[x - ch] : 0;
    const b = prev ? prev[x] : 0;
    const c = prev && x >= ch ? prev[x - ch] : 0;
    let v = line[x];
    if (f === 1) v += a;
    else if (f === 2) v += b;
    else if (f === 3) v += (a + b) >> 1;
    else if (f === 4) v += paeth(a, b, c);
    cur[x] = v & 255;
  }
}
const px = (x, y) => {
  const i = y * stride + x * ch;
  return [out[i], out[i + 1], out[i + 2]];
};
/* sample the door body: centre columns, skip background margins */
const xs = [], lum = [];
for (let y = Math.floor(ihdr.h * 0.12); y < Math.floor(ihdr.h * 0.95); y += 3) {
  for (let x = Math.floor(ihdr.w * 0.40); x < Math.floor(ihdr.w * 0.60); x += 3) {
    const p = px(x, y);
    xs.push(p); lum.push(0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]);
  }
}
const order = xs.map((_, i) => i).sort((a, b) => lum[a] - lum[b]);
const avg = (idxs) => {
  const s = [0, 0, 0];
  idxs.forEach((i) => { s[0] += xs[i][0]; s[1] += xs[i][1]; s[2] += xs[i][2]; });
  const n = idxs.length;
  return s.map((v) => Math.round(v / n));
};
const n = order.length;
const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
const median = avg([order[Math.floor(n / 2)]]);
const light = avg(order.slice(Math.floor(n * 0.85)));
const shade = avg(order.slice(0, Math.floor(n * 0.15)));
console.log(JSON.stringify({ file, base: hex(median), light: hex(light), shade: hex(shade) }, null, 2));
