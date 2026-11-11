// Local pre-rendered artwork; no service or dependency is needed at runtime.
// Trim each transparent atlas cell once, rather than stretching empty padding.
let sprites = null, loading;
const names = ['ship', 'station', 'cargo', 'asteroid'];

export function loadHardware() {
  if (loading) return loading;
  if (typeof Image === 'undefined') return Promise.resolve(false);
  loading = new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const entries = names.map((name, index) => {
          const x0 = Math.floor(index % 2 * canvas.width / 2), y0 = Math.floor(Math.floor(index / 2) * canvas.height / 2);
          const x1 = Math.floor((index % 2 + 1) * canvas.width / 2), y1 = Math.floor((Math.floor(index / 2) + 1) * canvas.height / 2);
          let left = x1, top = y1, right = x0, bottom = y0;
          for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
            if (pixels[(y * canvas.width + x) * 4 + 3] < 32) continue;
            left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
          }
          if (right <= left || bottom <= top) throw new Error(`Empty hardware cell: ${name}`);
          return [name, { image, x: left, y: top, width: right - left + 1, height: bottom - top + 1 }];
        });
        sprites = Object.fromEntries(entries); resolve(true);
      } catch { resolve(false); }
    };
    image.onerror = () => resolve(false);
    image.src = new URL('../assets/salvage-hardware-realistic.png', import.meta.url).href;
  });
  return loading;
}

export function hardwareReady() { return sprites !== null; }

export function drawHardware(ctx, name, x, y, width, height) {
  const sprite = sprites?.[name];
  if (!sprite) return false;
  ctx.drawImage(sprite.image, sprite.x, sprite.y, sprite.width, sprite.height, x, y, width, height);
  return true;
}
