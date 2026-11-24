// Image fingerprints for ARGUS Provenance, shared by the extension's service worker and the
// /register page (served from here, so both compute exactly the same thing).
//
//   phash:  a 64-bit difference hash. The image is shrunk to 9×8 grey pixels and each bit says
//           whether a pixel is brighter than its right-hand neighbour. Resizing, recompression and
//           small edits barely change it, so a re-upload or screenshot still matches.
//   sha256: the exact file, for "this is the very same file".
// Only these fingerprints are sent to the server for matching, never the image itself.
(function (scope) {
  async function fingerprint(blob) {
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas = new OffscreenCanvas(9, 8);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, 9, 8);
      const px = ctx.getImageData(0, 0, 9, 8).data;
      const grey = (x, y) => { const i = (y * 9 + x) * 4; return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; };
      let hex = '';
      for (let y = 0; y < 8; y++) {
        let byte = 0;
        for (let x = 0; x < 8; x++) byte = (byte << 1) | (grey(x, y) > grey(x + 1, y) ? 1 : 0);
        hex += byte.toString(16).padStart(2, '0');
      }
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      const sha256 = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
      return { phash: hex, sha256, width: bitmap.width, height: bitmap.height };
    } finally { bitmap.close?.(); }
  }
  scope.argusFingerprint = fingerprint;
})(typeof self !== 'undefined' ? self : globalThis);
