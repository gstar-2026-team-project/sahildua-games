import { WORLD, rng } from './simulation.js';

const TAU = Math.PI * 2;

// Separate depth planes prevent the sky from behaving like a screen wallpaper.
// Far light moves slowly; nearby dust provides the stronger motion reference.
export function layerOffset(camera, time, depth, drift = 0) {
  return {
    x: -camera.x * depth - time * drift,
    y: -camera.y * depth + time * drift * .23,
  };
}

export function skyPlacement(camera, time, width, height, imageWidth, imageHeight, reduced = false) {
  const depth = .22;
  // Overscan covers the entire playable sector, including camera look-ahead.
  // There is no clamp that makes the backdrop stop panning mid-flight.
  const marginX = WORLD.width / 2 * depth + 85;
  const marginY = WORLD.height / 2 * depth + 85;
  const scale = Math.max((width + marginX * 2) / imageWidth, (height + marginY * 2) / imageHeight);
  const w = imageWidth * scale, h = imageHeight * scale;
  return {
    x: (width - w) / 2 - camera.x * depth + (reduced ? 0 : Math.sin(time * .045) * 24),
    y: (height - h) / 2 - camera.y * depth + (reduced ? 0 : Math.sin(time * .033) * 16),
    width: w, height: h,
  };
}

function cloudTile(seed, rgb) {
  const size = 640, random = rng(seed), canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 30; i++) {
    const x = random() * size, y = random() * size, r = 70 + random() * 140;
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      if (x+ox+r<0 || x+ox-r>size || y+oy+r<0 || y+oy-r>size) continue;
      const g = ctx.createRadialGradient(x+ox, y+oy, 0, x+ox, y+oy, r);
      g.addColorStop(0, `rgba(${rgb},.09)`);
      g.addColorStop(.5, `rgba(${rgb},.035)`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.fillRect(x+ox-r, y+oy-r, r*2, r*2);
    }
  }
  return canvas;
}

export class SpaceBackground {
  constructor(reduced = false) {
    this.reduced = reduced;
    this.image = new Image();
    this.image.src = new URL('../assets/space-backdrop-realistic.png', import.meta.url).href;
    const random = rng(912384);
    this.stars = Array.from({ length: 280 }, () => ({
      x: random(), y: random(), r: .35 + random() * .8,
      depth: [.045, .18, .45][Math.floor(random() * 3)], alpha: .3 + random() * .6,
    }));
    this.motes = Array.from({ length: 90 }, () => ({
      x: random(), y: random(), depth: .65 + random() * .55,
      r: .85 + random() * 1.5, alpha: .25 + random() * .35,
    }));
    this.clouds = [
      { tile: cloudTile(720, '59,67,75'), depth: .35, drift: 6, alpha: .28 },
      { tile: cloudTile(512, '84,83,78'), depth: .75, drift: 15, alpha: .2 },
    ];
    this.patterns = null;
    this.cameraVelocity = { x: 0, y: 0 };
  }

  update(camera, previous, dt) {
    if (dt <= 0) { this.cameraVelocity.x = 0; this.cameraVelocity.y = 0; return; }
    const blend = 1 - Math.exp(-dt * 5);
    this.cameraVelocity.x += ((camera.x - previous.x) / dt - this.cameraVelocity.x) * blend;
    this.cameraVelocity.y += ((camera.y - previous.y) / dt - this.cameraVelocity.y) * blend;
  }

  reset() { this.cameraVelocity = { x: 0, y: 0 }; }

  draw(ctx, width, height, time, camera) {
    ctx.fillStyle = '#06090e'; ctx.fillRect(0, 0, width, height);
    if (this.image.complete && this.image.naturalWidth) {
      const p = skyPlacement(camera, time, width, height, this.image.naturalWidth, this.image.naturalHeight, this.reduced);
      ctx.drawImage(this.image, p.x, p.y, p.width, p.height);
      ctx.fillStyle = '#06101a25'; ctx.fillRect(0, 0, width, height);
    }

    for (const star of this.stars) {
      const offset = layerOffset(camera, this.reduced ? 0 : time, star.depth, .12);
      const x = ((star.x*width + offset.x) % width + width) % width;
      const y = ((star.y*height + offset.y) % height + height) % height;
      ctx.globalAlpha = star.alpha;
      ctx.beginPath(); ctx.arc(x, y, star.r, 0, TAU); ctx.fillStyle = '#c8deed'; ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (!this.patterns) this.patterns = this.clouds.map(c => ctx.createPattern(c.tile, 'repeat'));
    this.clouds.forEach((cloud, i) => {
      const offset = layerOffset(camera, this.reduced ? 0 : time, cloud.depth, cloud.drift);
      const x = offset.x % 640, y = offset.y % 640;
      ctx.save(); ctx.translate(x, y); ctx.globalAlpha = cloud.alpha;
      ctx.fillStyle = this.patterns[i];
      ctx.fillRect(-640, -640, width+1280, height+1280); ctx.restore();
    });

    // Diffuse nearby flecks drift even with no controls, then sweep past with
    // the camera during flight. These are dust, not fast-moving distant stars.
    const velocity = this.reduced ? { x: 0, y: 0 } : this.cameraVelocity;
    for (const mote of this.motes) {
      const offset = layerOffset(camera, this.reduced ? 0 : time, mote.depth, 24);
      const x = ((mote.x*width + offset.x) % width + width) % width;
      const y = ((mote.y*height + offset.y) % height + height) % height;
      const tx = Math.max(-9, Math.min(9, (velocity.x * mote.depth + (this.reduced ? 0 : 24)) * .04));
      const ty = Math.max(-9, Math.min(9, (velocity.y * mote.depth - (this.reduced ? 0 : 5.5)) * .04));
      ctx.globalAlpha = mote.alpha; ctx.strokeStyle = '#aac6d6'; ctx.lineWidth = mote.r*.6;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+tx,y+ty); ctx.stroke();
      ctx.beginPath(); ctx.arc(x,y,mote.r*.65,0,TAU); ctx.fillStyle='#a8bfcd'; ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
