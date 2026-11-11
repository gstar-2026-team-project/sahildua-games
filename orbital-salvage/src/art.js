// Pre-rendered materials with Canvas effects and a procedural loading fallback.
import { drawHardware, hardwareReady } from './hardware-sprites.js';
const TAU = Math.PI * 2;
const SUN_ANGLE = -2.3;

// The light stays in world space while a hull turns beneath it.
function sunlight(ctx, rotation, radius, stops) {
  const angle = SUN_ANGLE - rotation, x = Math.cos(angle)*radius, y = Math.sin(angle)*radius;
  const gradient = ctx.createLinearGradient(x, y, -x, -y);
  stops.forEach(([position, color]) => gradient.addColorStop(position, color));
  return gradient;
}

const rockTextures = new Map();
function rockTexture(rock) {
  const key = `${rock.radius}:${rock.shape.join(',')}`;
  if (rockTextures.has(key)) return rockTextures.get(key);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 160;
  const ctx = canvas.getContext('2d');
  let seed = Math.round(rock.radius * 137 + rock.shape.reduce((sum,v)=>sum+v,0)*997) >>> 0;
  const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  for (let i=0;i<1800;i++) {
    const x=random()*160,y=random()*160,size=.3+random()*1.8;
    ctx.fillStyle = random()>.5 ? '#e8d5b017' : '#060e2440';
    ctx.fillRect(x,y,size,size);
  }
  for (let i=0;i<18;i++) {
    const x=random()*160,y=random()*160,r=2+random()*8;
    const g=ctx.createRadialGradient(x-r*.3,y-r*.3,.2,x,y,r);
    g.addColorStop(0,'#0c152d77');g.addColorStop(.7,'#11192b50');g.addColorStop(1,'#ddd4bd22');
    disc(ctx,x,y,r,g);
  }
  if (rockTextures.size>=48) rockTextures.delete(rockTextures.keys().next().value);
  rockTextures.set(key,canvas); return canvas;
}

export function disc(ctx, x, y, r, fill, stroke) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

export function halo(ctx, x, y, r, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, color); gradient.addColorStop(1, 'transparent');
  disc(ctx, x, y, r, gradient);
}

function path(ctx, points, fill, stroke, width = 1) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

function plate(ctx, x, y, w, h, fill, stroke, radius = 2) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineWidth = 1; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function stroke(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
}

function drawProceduralShip(ctx, ship, time) {
  ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.angle);
  // A crisp dark silhouette makes the hull readable over the nebula.
  ctx.lineJoin = 'round';
  path(ctx, [[33,0],[9,-13],[-10,-17],[-23,-15],[-26,-6],[-22,0],[-26,6],[-23,15],[-10,17],[9,13]], '#081626', '#060e20', 2);
  halo(ctx, -15, 0, 55, ship.thrust > 0 ? '#ff873427' : '#3de7fa0d');
  for (const y of [-11, 11]) {
    if (ship.thrust > 0) {
      const flicker = 0.86 + Math.sin(time * 67) * .07 + Math.sin(time * 113) * .07;
      const reach = (29 + ship.thrust * 28) * flicker;
      const jet = ctx.createLinearGradient(-23, y, -23 - reach, y);
      jet.addColorStop(0, '#faffec'); jet.addColorStop(.15, '#ffe292'); jet.addColorStop(.45, '#ff923c'); jet.addColorStop(1, '#ff603000');
      path(ctx, [[-20,y-4],[-35,y-6],[-24-reach,y],[-35,y+6],[-20,y+4]], jet);
      path(ctx, [[-22,y-2],[-43,y],[-22,y+2]], '#f8fff0');
      halo(ctx, -29, y, 21, '#ff9c4355');
    }
    plate(ctx, -23, y - 5, 27, 10, sunlight(ctx,ship.angle,20,[[0,'#bdc7c9'],[.35,'#607887'],[.65,'#263a4a'],[1,'#112230']]), '#657c89');
    plate(ctx, -18, y - 5, 17, 4, '#b49262');
    plate(ctx, -27, y - 3.5, 7, 7, '#152c40', '#6098a5');
    stroke(ctx, -25, y - 2, -25, y + 2, ship.thrust > 0 ? '#fff0ae' : '#48c4df', 2);
    stroke(ctx, -11, y - 4, -11, y + 4, '#293d51', 2);
  }
  const armor = sunlight(ctx,ship.angle,26,[[0,'#f7e4c5'],[.35,'#bac6c7'],[.52,'#829ba6'],[1,'#293d52']]);
  path(ctx, [[32,0],[9,-11],[-17,-9],[-20,0],[-17,9],[9,11]], armor, '#e5fcff', 1.1);
  path(ctx, [[28,0],[9,-4],[-15,-3],[-15,3],[9,4]], sunlight(ctx,ship.angle,24,[[0,'#e3af6e'],[.4,'#b77b43'],[1,'#694631']]));
  stroke(ctx,-16,-8,8,-10,'#fff2d180',.7);
  stroke(ctx,-15,8,8,10,'#12273e99',1.5);
  path(ctx, [[22,0],[8,-7],[-2,-6],[-5,0],[-2,6],[8,7]], '#0b293e', '#6bb9ce', 1);
  const glass = sunlight(ctx,ship.angle,12,[[0,'#b6e2de'],[.25,'#507f9b'],[.45,'#1e486b'],[1,'#07182d']]);
  path(ctx, [[19,0],[7,-5],[-1,-4],[-3,0],[-1,4],[7,5]], glass);
  stroke(ctx, 2, -3, 10, -1, '#d7f3e880', .8);
  stroke(ctx, 5, -4, 5, 4, '#b9fff52a', .7);
  plate(ctx, -15, -5, 7, 10, '#203d50', '#618ca0');
  for (let i = 0; i < 3; i++) stroke(ctx, -13 + i * 2, -3, -13 + i * 2, 3, '#6b98a7', .7);
  for (const side of [-1, 1]) {
    disc(ctx, -8, side * 16, 2, side < 0 ? '#ffbf65' : '#53fff0');
    halo(ctx, -8, side * 16, 10, side < 0 ? '#ffac4a44' : '#4cf4e644');
    if (ship.thrust < 0) {
      const reach = 14 + Math.sin(time * 75) * 2;
      path(ctx, [[11,side*8],[11+reach,side*12],[9,side*12]], '#86f6ffbb');
      halo(ctx, 17, side * 10, 16, '#61e5ff33');
    }
  }
  if (Math.abs(ship.omega) > .2) {
    const side = ship.omega > 0 ? -1 : 1;
    path(ctx, [[7,side*11],[7,side*22],[2,side*12]], '#a7ffffbb');
  }
  ctx.restore();
}

function drawProceduralStation(ctx, time) {
  ctx.save();
  halo(ctx, 0, 0, 260, '#42cbf015');
  ctx.save(); ctx.translate(6, 10);
  disc(ctx, 0, 0, 105, '#030a1c88'); ctx.restore();
  // Sun-catching solar sails and copper service rails.
  stroke(ctx, -242, 0, -75, 0, '#0a1729', 19);
  stroke(ctx, -242, -3, -75, -3, '#c2d3cf', 7);
  stroke(ctx, -242, 4, -75, 4, '#d98a3c', 3);
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(-179, side * 73); ctx.rotate(Math.sin(time * .04) * .025);
    plate(ctx, -73, -42, 146, 84, '#0b2039', '#a3c9d2');
    for (let x = 0; x < 9; x++) for (let y = 0; y < 5; y++) {
      const cell = ctx.createLinearGradient(0, -38 + y * 15, 0, -23 + y * 15);
      cell.addColorStop(0, '#537c99'); cell.addColorStop(.5, '#284768'); cell.addColorStop(1, '#13283f');
      plate(ctx, -68 + x * 15, -37 + y * 15, 13, 13, cell);
      stroke(ctx, -66 + x * 15, -33 + y * 15, -57 + x * 15, -33 + y * 15, '#9be5ef44', .6);
    }
    for (const x of [-73, 70]) plate(ctx, x, -45, 4, 90, '#ac9573');
    stroke(ctx, -70, 0, 70, 0, '#8fc2cc', 2);
    ctx.restore();
  }
  ctx.save(); ctx.rotate(time * .045);
  const ringMetal=sunlight(ctx,time*.045,106,[[0,'#d0c9b4'],[.35,'#6d8490'],[.65,'#344c60'],[1,'#102338']]);
  ctx.lineWidth = 19; disc(ctx, 0, 0, 91, null, ringMetal);
  ctx.lineWidth = 1; disc(ctx, 0, 0, 100, null, '#92a8ae');
  ctx.lineWidth = 1; disc(ctx, 0, 0, 79, null, '#659aa5');
  for (let i = 0; i < 8; i++) {
    ctx.save(); ctx.rotate(i / 8 * TAU);
    const podAngle=time*.045+i/8*TAU;
    ctx.save();ctx.translate(2,3);plate(ctx,69,-18,39,36,'#020b18aa',null,4);ctx.restore();
    plate(ctx, 69, -18, 39, 36, sunlight(ctx,podAngle,108,[[0,'#d7d6c6'],[.4,'#8c9fa3'],[1,'#273c50']]), '#77909b', 4);
    plate(ctx, 72, -17, 30, 14, i % 3 === 0 ? '#af8051' : '#b6c0b7', null, 3);
    plate(ctx, 73, 1, 29, 14, '#3c5264', null, 2);
    plate(ctx, 79, -12, 15, 7, '#13364d', '#7faeb7');
    for (let w = 0; w < 3; w++) plate(ctx, 77 + w * 7, 4, 4, 4, '#89c6bb');
    for (let b=0;b<3;b++)disc(ctx,75+b*11,-15,.7,'#e1e3d1');
    stroke(ctx, 73, 14, 101, 14, '#172b3c', 2);
    disc(ctx, 105, 0, 1.7, i % 2 ? '#ffc77a' : '#72fff0');
    ctx.restore();
  }
  ctx.restore();
  // Layered armored hub with a living reactor core.
  const hub = sunlight(ctx,0,65,[[0,'#e0d8c0'],[.25,'#b0bdbb'],[.5,'#5c7886'],[1,'#21364c']]);
  const hubPoints = Array.from({ length: 8 }, (_, i) => [Math.cos(i / 8 * TAU + Math.PI / 8) * 63, Math.sin(i / 8 * TAU + Math.PI / 8) * 63]);
  path(ctx, hubPoints, hub, '#b6e7e3', 1.5);
  path(ctx, hubPoints.map(([x,y]) => [x*.77,y*.77]), '#142e43', '#5f9aab', 2);
  const pulse = .75 + Math.sin(time * 2) * .12;
  halo(ctx, 0, 0, 55, `rgba(52,245,225,${pulse*.2})`);
  ctx.lineWidth = 3; disc(ctx, 0, 0, 30, '#194658', '#62d6d1');
  ctx.lineWidth = 1; disc(ctx, 0, 0, 23, '#103449', '#c3fff1');
  const core=ctx.createRadialGradient(-4,-5,1,0,0,15);
  core.addColorStop(0,'#c8e7d7');core.addColorStop(.3,'#4caca5');core.addColorStop(1,'#163847');
  disc(ctx, 0, 0, 14, core);
  ctx.save(); ctx.rotate(-time * .2);
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 35, i*TAU/3, i*TAU/3+.7); ctx.strokeStyle='#8fffe2';ctx.lineWidth=2;ctx.stroke(); }
  ctx.restore();
  plate(ctx, -10, -60, 20, 13, '#f7bb66', '#ffe5af');
  plate(ctx, -10, 47, 20, 13, '#f7bb66', '#ffe5af');
  for (const [x,y] of [[-43,-43],[43,-43],[-43,43],[43,43]]) { disc(ctx,x,y,2,'#a5ffde');halo(ctx,x,y,12,'#6affd533'); }
  ctx.restore();
}

export function drawDock(ctx, dock, time, active) {
  const {x,y,radius:r}=dock;
  ctx.save();ctx.translate(x,y);
  // A navigational overlay marks the exact recovery radius without a shield.
  const field=ctx.createRadialGradient(0,0,r*.4,0,0,r);
  field.addColorStop(0,'#8ba69c00');field.addColorStop(1,active?'#8ba69c14':'#8ba69c06');
  disc(ctx,0,0,r,field);
  ctx.lineWidth=1;ctx.setLineDash([4,7]);disc(ctx,0,0,r,null,active?'#b3cfc1b0':'#a9bdb58a');ctx.setLineDash([]);
  for(let i=0;i<4;i++){
    const angle=i*Math.PI/2;
    ctx.beginPath();ctx.arc(0,0,r,angle-.08,angle+.08);ctx.lineWidth=1.8;ctx.strokeStyle=active?'#c8dbcb':'#9db9b0';ctx.stroke();
    disc(ctx,Math.cos(angle)*r,Math.sin(angle)*r,1.5,'#d6ddd2');
  }
  if(active){
    const f=(time*.25)%1,px=r*(1-f)*.75;
    ctx.globalAlpha=Math.sin(f*Math.PI)*.5;
    stroke(ctx,px+5,-6,px,0,'#c0d7c5',1);stroke(ctx,px,0,px+5,6,'#c0d7c5',1);
  }
  ctx.globalAlpha=1;ctx.textAlign='center';ctx.font='600 17px "DM Sans",sans-serif';
  ctx.letterSpacing='1px';ctx.fillStyle='#d7e1d7';ctx.fillText('HOME',0,r*.55);ctx.letterSpacing='0px';ctx.restore();
}

function drawProceduralAsteroid(ctx, rock) {
  ctx.save();ctx.translate(rock.x,rock.y);ctx.rotate(rock.angle);
  const r=rock.radius,vertices=rock.shape.map((v,i)=>[Math.cos(i/rock.shape.length*TAU)*r*v,Math.sin(i/rock.shape.length*TAU)*r*v]);
  const surface=sunlight(ctx,rock.angle,r,[[0,'#c2b197'],[.3,'#8c8073'],[.7,'#484958'],[1,'#19273e']]);
  path(ctx,vertices,surface,'#c0b6aa66');
  ctx.save();ctx.clip();
  for(let i=0;i<vertices.length;i++){
    const a=vertices[i],b=vertices[(i+1)%vertices.length];
    path(ctx,[a,b,[r*.1,-r*.08]],i%3===0?'#c8bba525':i%3===1?'#0c193b30':'#a8c6d010');
  }
  ctx.drawImage(rockTexture(rock),-r,-r,r*2,r*2);
  for(const [x,y,size] of [[-.3,-.25,.24],[.38,.25,.17],[-.42,.4,.11]]){
    disc(ctx,x*r,y*r,size*r,'#24283b88','#b6af9b30');
    ctx.beginPath();ctx.arc(x*r,y*r,size*r,.8,3.6);ctx.strokeStyle='#d7c6a844';ctx.lineWidth=1.2;ctx.stroke();
  }
  const warm=(rock.id??0)%3===0;
  stroke(ctx,-r*.5,-r*.4,-r*.13,-r*.12,warm?'#ffb96c88':'#a4d1df44',1);
  stroke(ctx,-r*.13,-r*.12,r*.07,r*.27,warm?'#ffb96c55':'#a4d1df22',.7);
  if(warm){disc(ctx,r*.3,-r*.28,1.4,'#ffcb87');halo(ctx,r*.3,-r*.28,r*.2,'#ffb46322');}
  ctx.restore();ctx.restore();
}

function drawProceduralCargo(ctx, cargo, time, attached) {
  ctx.save();ctx.rotate(cargo.angle);
  // Rounded armored corners, luminous end caps and a small cargo insignia.
  plate(ctx,-23,-17,46,34,'#08192c','#99c3c9',3);
  const coating=sunlight(ctx,cargo.angle,23,[[0,'#e0dac5'],[.22,cargo.color],[.5,cargo.color],[1,'#273e4f']]);
  plate(ctx,-18,-14,36,28,coating,null,2);
  for(const x of [-12,-4,4,12]){
    stroke(ctx,x,-11,x,11,'#0d21394d',2);stroke(ctx,x+1,-11,x+1,11,'#ffffff22',.6);
  }
  for(const x of [-23,17]){
    plate(ctx,x,-18,6,36,sunlight(ctx,cargo.angle,24,[[0,'#dee0cf'],[.4,'#9baaaa'],[1,'#344b60']]),'#a4b4b8',1);
    plate(ctx,x+1,-15,4,8,'#f8d38c');plate(ctx,x+1,7,4,8,attached?'#8cffdf':'#b9eeea');
  }
  plate(ctx,-6,-6,12,12,'#183145','#d0e6d5',2);
  path(ctx,[[0,-3],[3,0],[0,3],[-3,0]],attached?'#72ffdb':'#ffe4b2');
  const pulse=.65+Math.sin(time*2+cargo.id)*.25;
  ctx.globalAlpha=pulse;stroke(ctx,-13,-14,13,-14,'#f5fbe7',1);ctx.globalAlpha=1;
  ctx.restore();
}

function exhaust(ctx, x, y, direction, amount, time) {
  const reach = (9 + amount*23) * (1 + Math.sin(time*53)*.045);
  ctx.save(); ctx.translate(x,y); ctx.rotate(direction);
  const plume = ctx.createLinearGradient(0,0,-reach,0);
  plume.addColorStop(0,'#dceeffd9'); plume.addColorStop(.18,'#87b7d197');
  plume.addColorStop(.6,'#6888ab3d'); plume.addColorStop(1,'#7296b400');
  ctx.fillStyle = plume; ctx.beginPath();ctx.ellipse(-reach/2,0,reach/2,2.2+amount*.8,0,0,TAU);ctx.fill();
  halo(ctx,0,0,7,'#a1c5e62b');ctx.restore();
}

export function drawShip(ctx, ship, time) {
  if (!hardwareReady()) return drawProceduralShip(ctx,ship,time);
  ctx.save();ctx.translate(ship.x,ship.y);ctx.rotate(ship.angle);
  if (ship.thrust>0) for (const side of [-1,1]) exhaust(ctx,-32,side*10.7,0,ship.thrust,time);
  if (ship.thrust<0) for (const side of [-1,1]) exhaust(ctx,23,side*10,Math.PI,-ship.thrust*.45,time);
  if (Math.abs(ship.omega)>.2) exhaust(ctx,14,-Math.sign(ship.omega)*11,-Math.sign(ship.omega)*Math.PI/2,.15,time);
  drawHardware(ctx,'ship',-33,-16,67,32);
  for (const side of [-1,1]) {
    disc(ctx,0,side*13.8,.8,side<0?'#d4a387':'#a0bab1');
    halo(ctx,0,side*13.8,3,side<0?'#c5a28c28':'#92bbae22');
  }
  ctx.restore();
}

export function drawStation(ctx, time) {
  if (!hardwareReady()) return drawProceduralStation(ctx,time);
  ctx.save();
  drawHardware(ctx,'station',-156,-108,312,216);
  // A slow service beacon and navigation lamps, rather than a glowing reactor.
  for (const side of [-1,1]) {
    disc(ctx,side*96,0,1,'#bcd0c5');halo(ctx,side*96,0,5,'#adcabb25');
  }
  const phase=(time*.12)%1;
  ctx.globalAlpha=.45+Math.sin(phase*TAU)*.25;
  disc(ctx,0,-100,1.5,'#d2a880');halo(ctx,0,-100,7,'#c6a07725');ctx.restore();
}

export function drawAsteroid(ctx, rock) {
  if (!hardwareReady()) return drawProceduralAsteroid(ctx,rock);
  ctx.save();ctx.translate(rock.x,rock.y);ctx.rotate(rock.angle);
  const r=rock.radius;
  const vertices=rock.shape.map((v,i)=>[Math.cos(i/rock.shape.length*TAU)*r*v,Math.sin(i/rock.shape.length*TAU)*r*v]);
  path(ctx,vertices);ctx.clip();
  drawHardware(ctx,'asteroid',-r*1.06,-r*1.06,r*2.12,r*2.12);
  // Shade the rotating surface from a fixed sun direction in world space.
  ctx.fillStyle=sunlight(ctx,rock.angle,r,[[0,'#e2d4bb0c'],[.35,'#18233100'],[1,'#030a18a8']]);
  ctx.fillRect(-r*1.1,-r*1.1,r*2.2,r*2.2);ctx.restore();
}

export function drawCargoBody(ctx, cargo, time, attached) {
  if (!hardwareReady()) return drawProceduralCargo(ctx,cargo,time,attached);
  ctx.save();ctx.rotate(cargo.angle);
  drawHardware(ctx,'cargo',-23,-14,46,28);
  // Small tracking strips preserve each target's color without neon armor.
  stroke(ctx,-16,-11,-7,-11,cargo.color,1.3);
  disc(ctx,18,0,.9,attached?'#b6dbcb':'#d7bd8d');
  ctx.restore();
}
