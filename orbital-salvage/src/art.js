// Procedural foreground artwork. All animation here is visual only.
const TAU = Math.PI * 2;

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

export function drawShip(ctx, ship, time) {
  ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.angle);
  // A crisp dark silhouette makes the hull readable over the nebula.
  ctx.lineJoin = 'round';
  path(ctx, [[33,0],[9,-13],[-10,-17],[-23,-15],[-26,-6],[-22,0],[-26,6],[-23,15],[-10,17],[9,13]], '#081626', '#060e20', 4);
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
    plate(ctx, -23, y - 5, 27, 10, '#21354b', '#a6bdcc');
    plate(ctx, -18, y - 5, 17, 4, '#f3bc65');
    plate(ctx, -27, y - 3.5, 7, 7, '#152c40', '#6098a5');
    stroke(ctx, -25, y - 2, -25, y + 2, ship.thrust > 0 ? '#fff0ae' : '#48c4df', 2);
    stroke(ctx, -11, y - 4, -11, y + 4, '#293d51', 2);
  }
  const armor = ctx.createLinearGradient(0, -13, 0, 13);
  armor.addColorStop(0, '#fff3d3'); armor.addColorStop(.4, '#d9e8e5'); armor.addColorStop(.55, '#9bbbc1'); armor.addColorStop(1, '#547487');
  path(ctx, [[32,0],[9,-11],[-17,-9],[-20,0],[-17,9],[9,11]], armor, '#e5fcff', 1.1);
  path(ctx, [[28,0],[9,-4],[-15,-3],[-15,3],[9,4]], '#fa9c39');
  path(ctx, [[22,0],[8,-7],[-2,-6],[-5,0],[-2,6],[8,7]], '#0b293e', '#6bb9ce', 1);
  const glass = ctx.createLinearGradient(0, -5, 14, 4);
  glass.addColorStop(0, '#9effef'); glass.addColorStop(.4, '#3ac7e4'); glass.addColorStop(1, '#18639c');
  path(ctx, [[19,0],[7,-5],[-1,-4],[-3,0],[-1,4],[7,5]], glass);
  stroke(ctx, 5, -4, 5, 4, '#b9fff555', .7);
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

export function drawStation(ctx, time) {
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
      cell.addColorStop(0, '#3c8fc2'); cell.addColorStop(.5, '#205c9b'); cell.addColorStop(1, '#153b72');
      plate(ctx, -68 + x * 15, -37 + y * 15, 13, 13, cell);
      stroke(ctx, -66 + x * 15, -33 + y * 15, -57 + x * 15, -33 + y * 15, '#9be5ef44', .6);
    }
    for (const x of [-73, 70]) plate(ctx, x, -45, 4, 90, '#eead54');
    stroke(ctx, -70, 0, 70, 0, '#8fc2cc', 2);
    ctx.restore();
  }
  ctx.save(); ctx.rotate(time * .045);
  ctx.lineWidth = 16; disc(ctx, 0, 0, 91, null, '#15263b');
  ctx.lineWidth = 3; disc(ctx, 0, 0, 100, null, '#92c2ca');
  ctx.lineWidth = 1; disc(ctx, 0, 0, 79, null, '#659aa5');
  for (let i = 0; i < 8; i++) {
    ctx.save(); ctx.rotate(i / 8 * TAU);
    plate(ctx, 69, -18, 39, 36, '#172e44', '#779caa', 4);
    plate(ctx, 72, -17, 30, 14, i % 3 === 0 ? '#e59c45' : '#cfddd5', null, 3);
    plate(ctx, 73, 1, 29, 14, '#456176', null, 2);
    plate(ctx, 79, -12, 15, 7, '#13364d', '#7faeb7');
    for (let w = 0; w < 3; w++) plate(ctx, 77 + w * 7, 4, 4, 4, '#86f4d9');
    stroke(ctx, 73, 14, 101, 14, '#172b3c', 2);
    disc(ctx, 105, 0, 1.7, i % 2 ? '#ffc77a' : '#72fff0');
    ctx.restore();
  }
  ctx.restore();
  // Layered armored hub with a living reactor core.
  const hub = ctx.createLinearGradient(-55, -55, 50, 50);
  hub.addColorStop(0, '#deeee2'); hub.addColorStop(.25, '#a7c4c5'); hub.addColorStop(.5, '#497387'); hub.addColorStop(1, '#213e56');
  const hubPoints = Array.from({ length: 8 }, (_, i) => [Math.cos(i / 8 * TAU + Math.PI / 8) * 63, Math.sin(i / 8 * TAU + Math.PI / 8) * 63]);
  path(ctx, hubPoints, hub, '#b6e7e3', 1.5);
  path(ctx, hubPoints.map(([x,y]) => [x*.77,y*.77]), '#142e43', '#5f9aab', 2);
  const pulse = .75 + Math.sin(time * 2) * .12;
  halo(ctx, 0, 0, 55, `rgba(52,245,225,${pulse*.2})`);
  ctx.lineWidth = 3; disc(ctx, 0, 0, 30, '#194658', '#62d6d1');
  ctx.lineWidth = 1; disc(ctx, 0, 0, 23, '#103449', '#c3fff1');
  disc(ctx, 0, 0, 14, '#3ce6d1'); disc(ctx, -4, -4, 5, '#c4ffec');
  ctx.save(); ctx.rotate(-time * .2);
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 35, i*TAU/3, i*TAU/3+.7); ctx.strokeStyle='#8fffe2';ctx.lineWidth=2;ctx.stroke(); }
  ctx.restore();
  plate(ctx, -10, -60, 20, 13, '#f7bb66', '#ffe5af');
  plate(ctx, -10, 47, 20, 13, '#f7bb66', '#ffe5af');
  for (const [x,y] of [[-43,-43],[43,-43],[-43,43],[43,43]]) { disc(ctx,x,y,2,'#a5ffde');halo(ctx,x,y,12,'#6affd533'); }
  ctx.restore();
}

export function drawDock(ctx, dock, time, active) {
  const { x, y, radius:r } = dock;
  ctx.save(); ctx.translate(x,y);
  const color = active ? '#66ffe0' : '#53cfc4';
  halo(ctx, 0, 0, r*1.35, active ? '#32f8c41e' : '#32d8de09');
  const field = ctx.createRadialGradient(0,0,8,0,0,r);
  field.addColorStop(0,'#3febcb03');field.addColorStop(.8,active?'#31f8c912':'#31d8d505');field.addColorStop(1,active?'#51ffe932':'#51ffe916');
  disc(ctx,0,0,r,field);
  ctx.lineWidth=1;disc(ctx,0,0,r,null,active?'#8cffe6a0':'#77dcca55');
  ctx.setLineDash([3,10]);disc(ctx,0,0,r-9,null,'#9affea77');ctx.setLineDash([]);
  ctx.save();ctx.rotate(time*.13);
  for(let i=0;i<4;i++){
    ctx.beginPath();ctx.arc(0,0,r-3,i*Math.PI/2,i*Math.PI/2+.42);ctx.lineWidth=3;ctx.strokeStyle=color;ctx.stroke();
  }ctx.restore();
  for(let i=0;i<4;i++){
    const angle=i*Math.PI/2;const px=Math.cos(angle)*r,py=Math.sin(angle)*r;
    disc(ctx,px,py,3,'#caffeb');halo(ctx,px,py,14,'#70ffda44');
  }
  // Inward-moving chevrons make the recovery field legible without extra text.
  if(active){
    for(let i=0;i<3;i++){
      const f=(time*.3+i/3)%1,px=r*(1-f)*.78;
      ctx.globalAlpha=Math.sin(f*Math.PI)*.7;
      stroke(ctx,px+7,-9,px,0,'#a3ffdd',2);stroke(ctx,px,0,px+7,9,'#a3ffdd',2);
    }
  }
  ctx.globalAlpha=1;
  for(const sx of [-1,1])for(const sy of [-1,1]){
    ctx.beginPath();ctx.moveTo(sx*17,sy*27);ctx.lineTo(sx*27,sy*27);ctx.lineTo(sx*27,sy*17);ctx.lineWidth=1.2;ctx.strokeStyle='#92eadf88';ctx.stroke();
  }
  ctx.textAlign='center';ctx.font='600 10px "DM Sans",sans-serif';ctx.letterSpacing='2px';ctx.fillStyle='#c0ffeb';ctx.fillText('HOME',0,53);ctx.letterSpacing='0px';
  ctx.restore();
}

export function drawAsteroid(ctx, rock) {
  ctx.save();ctx.translate(rock.x,rock.y);ctx.rotate(rock.angle);
  const r=rock.radius,vertices=rock.shape.map((v,i)=>[Math.cos(i/rock.shape.length*TAU)*r*v,Math.sin(i/rock.shape.length*TAU)*r*v]);
  ctx.save();ctx.translate(4,6);path(ctx,vertices,'#02081966');ctx.restore();
  const surface=ctx.createLinearGradient(-r,-r,r,r);
  surface.addColorStop(0,'#b3a691');surface.addColorStop(.3,'#776b68');surface.addColorStop(.7,'#464253');surface.addColorStop(1,'#252c44');
  path(ctx,vertices,surface,'#c0b6aa66');
  ctx.save();ctx.clip();
  for(let i=0;i<vertices.length;i++){
    const a=vertices[i],b=vertices[(i+1)%vertices.length];
    path(ctx,[a,b,[r*.1,-r*.08]],i%3===0?'#c8bba525':i%3===1?'#0c193b30':'#a8c6d010');
  }
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

export function drawCargoBody(ctx, cargo, time, attached) {
  ctx.save();ctx.rotate(cargo.angle);
  // Rounded armored corners, luminous end caps and a small cargo insignia.
  plate(ctx,-23,-17,46,34,'#08192c','#99c3c9',3);
  const coating=ctx.createLinearGradient(0,-14,0,14);
  coating.addColorStop(0,cargo.color);coating.addColorStop(.5,cargo.color);coating.addColorStop(1,'#273e5f');
  plate(ctx,-18,-14,36,28,coating,null,2);
  for(const x of [-12,-4,4,12]){
    stroke(ctx,x,-11,x,11,'#0d21394d',2);stroke(ctx,x+1,-11,x+1,11,'#ffffff22',.6);
  }
  for(const x of [-23,17]){
    plate(ctx,x,-18,6,36,'#a1b8bb','#d7e7dd',1);
    plate(ctx,x+1,-15,4,8,'#f8d38c');plate(ctx,x+1,7,4,8,attached?'#8cffdf':'#b9eeea');
  }
  plate(ctx,-6,-6,12,12,'#183145','#d0e6d5',2);
  path(ctx,[[0,-3],[3,0],[0,3],[-3,0]],attached?'#72ffdb':'#ffe4b2');
  const pulse=.65+Math.sin(time*2+cargo.id)*.25;
  ctx.globalAlpha=pulse;stroke(ctx,-13,-14,13,-14,'#f5fbe7',1);ctx.globalAlpha=1;
  ctx.restore();
}
