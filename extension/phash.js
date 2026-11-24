// Image fingerprints for ARGUS Provenance, shared by the extension's service worker and the
// /register page (served from here, so both compute exactly the same thing).
//
//   phash:  a 64-bit difference hash. The image is shrunk to 9×8 grey pixels and each bit says
//           whether a pixel is brighter than its right-hand neighbour. Resizing, recompression,
//           filters and small edits barely change it, so a re-upload or screenshot still matches.
//   mirror: the same for the image flipped left-to-right, so a mirrored copy is recognised.
//   crops:  the same for 45 crops of the image (smaller centre and corner crops, one side
//           trimmed off, and square crops like Instagram makes). Stored when a creator registers
//           an image, so a heavily cropped copy still matches one of them.
//   sha256: the exact file, for "this is the very same file".
// Only these fingerprints are sent to the server, never the image itself.
(function (scope) {
  // dHash of one region (sx, sy, sw, sh) of the bitmap, optionally flipped left-to-right.
  // The region is drawn at 72×64 and each 8×8 block averaged into one of the 9×8 greys: a true
  // area average, so a copy at any size or compression gives (almost) the same bits. Shrinking a
  // big photo straight to 9×8 in one step is unstable (up to 11 bits off for the same picture).
  const G = 8; // pixels averaged per grey, each way
  function dhash(ctx, bitmap, sx, sy, sw, sh, flip = false) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 9 * G, 8 * G);
    if (flip) ctx.setTransform(-1, 0, 0, 1, 9 * G, 0);
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, 9 * G, 8 * G);
    const px = ctx.getImageData(0, 0, 9 * G, 8 * G).data;
    const grey = [];
    for (let by = 0; by < 8; by++) {
      for (let bx = 0; bx < 9; bx++) {
        let sum = 0;
        for (let y = 0; y < G; y++) {
          for (let x = 0; x < G; x++) {
            const i = ((by * G + y) * 9 * G + bx * G + x) * 4;
            sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          }
        }
        grey.push(sum);
      }
    }
    let hex = '';
    for (let y = 0; y < 8; y++) {
      let byte = 0;
      for (let x = 0; x < 8; x++) byte = (byte << 1) | (grey[y * 9 + x] > grey[y * 9 + x + 1] ? 1 : 0);
      hex += byte.toString(16).padStart(2, '0');
    }
    return hex;
  }

  // The crop regions stored at registration: [sx, sy, sw, sh] in pixels.
  function cropRegions(W, H) {
    const out = [];
    for (const s of [0.92, 0.84, 0.76, 0.68, 0.6]) {           // smaller, keeping a corner or the centre
      const w = W * s, h = H * s;
      for (const [ax, ay] of [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]]) out.push([(W - w) * ax, (H - h) * ay, w, h]);
    }
    for (const s of [0.85, 0.7]) {                              // one side trimmed off (a watermark strip)
      out.push([0, 0, W, H * s], [0, H * (1 - s), W, H * s], [0, 0, W * s, H], [W * (1 - s), 0, W * s, H]);
    }
    const side = Math.min(W, H);                                // square crops, as Instagram makes
    // Every 10% across: a square crop shifted by just 5% of the photo already changes ~8 bits.
    for (let a = 0; a <= 1.0001; a += 0.1) out.push(W >= H ? [(W - side) * a, 0, side, side] : [0, (H - side) * a, side, side]);
    out.push([(W - side * 0.8) / 2, (H - side * 0.8) / 2, side * 0.8, side * 0.8]);
    return out;
  }

  async function fingerprint(blob) {
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas = new OffscreenCanvas(9 * G, 8 * G);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      const W = bitmap.width, H = bitmap.height;
      const phash = dhash(ctx, bitmap, 0, 0, W, H);
      const mirror = dhash(ctx, bitmap, 0, 0, W, H, true);
      const crops = cropRegions(W, H).map(([sx, sy, sw, sh]) => dhash(ctx, bitmap, sx, sy, sw, sh));
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      const sha256 = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
      return { phash, mirror, crops, sha256, width: W, height: H };
    } finally { bitmap.close?.(); }
  }
  scope.argusFingerprint = fingerprint;
})(typeof self !== 'undefined' ? self : globalThis);
