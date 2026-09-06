import sharp from 'sharp';
const [src, out, x, y, w, h, scale] = process.argv.slice(2);
await sharp(src).extract({ left: +x, top: +y, width: +w, height: +h })
  .resize({ width: (+w) * (+scale || 2) }).png().toFile(out);
console.log('cropped', out);
