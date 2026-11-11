import { WORLD, BEAM_RANGE, dockingZone, rng, length, clamp, nearestCargo } from './simulation.js';

const TAU = Math.PI * 2;
function circle(ctx,x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,TAU);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function line(ctx,x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function polygon(ctx,r,n=8,offset=0){ctx.beginPath();for(let i=0;i<n;i++){const a=offset+i/n*TAU;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();}
function glow(ctx,x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');circle(ctx,x,y,r,g);}
function rect(ctx,x,y,w,h,fill,stroke){ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);if(stroke){ctx.strokeStyle=stroke;ctx.strokeRect(x,y,w,h);}}

export class Renderer {
  constructor(canvas,radar){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.radar=radar;this.rctx=radar.getContext('2d');this.width=innerWidth;this.height=innerHeight;
    this.camera={x:0,y:0,zoom:1};this.particles=[];this.rings=[];this.shake=0;this.time=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const random=rng(912384);
    this.stars=Array.from({length:500},()=>({x:random(),y:random(),r:random()*1.3+.3,depth:.1+random()*.5,alpha:.18+random()*.7,phase:random()*TAU}));
    this.dust=Array.from({length:34},()=>({x:(random()-.5)*WORLD.width,y:(random()-.5)*WORLD.height,r:random()*3+1,a:random()*TAU}));
    this.resize();
  }
  resize(){this.width=innerWidth;this.height=innerHeight;this.ratio=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(this.width*this.ratio);this.canvas.height=Math.round(this.height*this.ratio);}
  reset(game,menu=false){this.particles=[];this.rings=[];this.shake=0;this.camera.x=menu?-this.width*.24/.82:game.ship.x;this.camera.y=menu?-this.height*.05/.82:game.ship.y;this.camera.zoom=menu?.82:this.targetZoom();}
  targetZoom(){return this.width<760?.73:this.width<1100?.85:1;}
  burst(x,y,color,count=22,energy=90){
    for(let i=0;i<count;i++){const a=Math.random()*TAU,v=energy*(.2+Math.random());this.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.4+Math.random()*.8,max:1.2,size:1+Math.random()*2,color});}
  }
  event(event){
    if(event.type==='delivery'){this.burst(event.x,event.y,'#8ae5d5',55,140);this.rings.push({x:event.x,y:event.y,t:0});}
    if(event.type==='attach')this.burst(event.x,event.y,'#8ae5d5',18,65);
    if(event.type==='collision'||event.type==='cargo-hit'){this.burst(event.x,event.y,'#ffbd7b',Math.min(30,Math.round(event.force/4)),100);if(!this.reduced)this.shake=Math.min(9,event.force*.035);}
  }
  update(game,dt,menu){
    this.time+=dt;const cam=this.camera,s=game.ship;
    const tx=menu?-this.width*.24/.82:s.x+s.vx*.48,ty=menu?-this.height*.05/.82:s.y+s.vy*.38;
    const follow=1-Math.exp(-dt*4);cam.x+=(tx-cam.x)*follow;cam.y+=(ty-cam.y)*follow;cam.zoom+=((menu?.82:this.targetZoom())-cam.zoom)*follow;
    this.shake*=Math.exp(-dt*13);
    for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.vx*=1-dt*1.5;p.vy*=1-dt*1.5;}
    this.particles=this.particles.filter(p=>p.life>0).slice(-550);
    for(const ring of this.rings)ring.t+=dt;
    this.rings=this.rings.filter(r=>r.t<1.4);
    if(s.thrust&&game.status==='playing'&&dt>0){
      const reverse=s.thrust<0,dir=s.angle+(reverse?0:Math.PI),ax=s.x+Math.cos(dir)*21,ay=s.y+Math.sin(dir)*21;
      for(let i=0;i<Math.ceil(dt*70*Math.abs(s.thrust));i++){const a=dir+(Math.random()-.5)*.35;this.particles.push({x:ax,y:ay,vx:s.vx+Math.cos(a)*(70+Math.random()*60),vy:s.vy+Math.sin(a)*(70+Math.random()*60),life:.25+Math.random()*.3,max:.6,size:1+Math.random()*2.5,color:i%2?'#ffc98d':'#f1845c'});}
    }
  }
  render(game,menu=false,paused=false){
    const ctx=this.ctx,w=this.width,h=this.height,cam=this.camera,t=this.time;
    ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.globalAlpha=1;ctx.clearRect(0,0,w,h);
    this.background(ctx,w,h,t,cam);
    ctx.save();ctx.translate(w/2+(paused?0:(Math.random()-.5)*this.shake),h/2+(paused?0:(Math.random()-.5)*this.shake));ctx.scale(cam.zoom,cam.zoom);ctx.translate(-cam.x,-cam.y);
    this.worldGrid(ctx,t);
    for(const d of this.dust){ctx.save();ctx.translate(d.x+Math.sin(t*.08+d.a)*13,d.y+Math.cos(t*.07+d.a)*13);ctx.rotate(d.a+t*.08);rect(ctx,-d.r,-1,d.r*2,2,'#52697b70');ctx.restore();}
    this.station(ctx,t,dockingZone(game));
    for(const a of game.asteroids)this.asteroid(ctx,a,t);
    for(const c of game.cargo)if(!c.delivered)this.cargo(ctx,c,game,t,menu);
    if(game.attachedId!==null){const c=game.cargo.find(c=>c.id===game.attachedId);if(c&&!c.delivered)this.beam(ctx,game.ship,c,t);}
    this.ship(ctx,game.ship,t);
    if(!menu)this.shipVector(ctx,game.ship);
    for(const p of this.particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);circle(ctx,p.x,p.y,p.size,p.color);}
    ctx.globalAlpha=1;
    for(const ring of this.rings){ctx.globalAlpha=1-ring.t/1.4;ctx.lineWidth=2;circle(ctx,ring.x,ring.y,25+ring.t*130,null,'#8ae5d5');}ctx.globalAlpha=1;
    if(game.gust.active||game.gust.warning)this.wind(ctx,game,t);
    ctx.restore();
    if(menu){const fade=ctx.createLinearGradient(0,0,w*.65,0);fade.addColorStop(0,'#070e1af0');fade.addColorStop(.55,'#070e1ac0');fade.addColorStop(1,'#070e1a00');ctx.fillStyle=fade;ctx.fillRect(0,0,w*.65,h);}
    else{this.indicators(ctx,game);this.drawRadar(game,t);}
  }
  background(ctx,w,h,t,cam){
    const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#080f1e');g.addColorStop(.55,'#0b1628');g.addColorStop(1,'#11172e');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    glow(ctx,w*.77-cam.x*.025,h*.54-cam.y*.025,w*.58,'#26325e36');
    glow(ctx,w*.9,h*.87,w*.4,'#592e6524');glow(ctx,w*.35,h*.3,w*.37,'#17536418');
    for(const s of this.stars){const x=((s.x*w-cam.x*s.depth*.13+t*s.depth*.45)%(w+20)+w+20)%(w+20)-10;const y=((s.y*h-cam.y*s.depth*.13+t*s.depth*.12)%(h+20)+h+20)%(h+20)-10;ctx.globalAlpha=s.alpha*(.8+.2*Math.sin(t*.5+s.phase));circle(ctx,x,y,s.r,s.depth>.45?'#c8e7ed':'#7696b4');if(s.r>1.45){line(ctx,x-3,y,x+3,y,'#9abbd250',.5);line(ctx,x,y-3,x,y+3,'#9abbd250',.5);}}
    ctx.globalAlpha=1;
    // A shaded gas giant, behind the salvage lane.
    const px=w*.88-cam.x*.03,py=h*.18-cam.y*.03,r=Math.min(w*.115,150);
    ctx.save();glow(ctx,px,py,r*1.14,'#637b9d12');circle(ctx,px,py,r,'#122037');ctx.beginPath();ctx.arc(px,py,r,0,TAU);ctx.clip();
    const planet=ctx.createLinearGradient(px-r,py-r,px+r*.6,py+r*.3);planet.addColorStop(0,'#50687c');planet.addColorStop(.25,'#30435b');planet.addColorStop(.68,'#142039');planet.addColorStop(1,'#0b1325');ctx.fillStyle=planet;ctx.fillRect(px-r,py-r,r*2,r*2);
    ctx.translate(px,py);ctx.rotate(-.3);for(let i=-8;i<9;i++){ctx.globalAlpha=.035;ctx.fillStyle=i%2?'#c9d1c7':'#060a15';ctx.fillRect(-r,i*r/8,r*2,r/18);}ctx.restore();ctx.globalAlpha=1;
    ctx.lineWidth=.8;circle(ctx,px,py,r,null,'#91adbc20');
  }
  worldGrid(ctx,t){
    ctx.strokeStyle='#83abc307';ctx.lineWidth=1;
    const cam=this.camera,w=this.width/cam.zoom,h=this.height/cam.zoom;
    for(let x=Math.floor((cam.x-w/2)/160)*160;x<cam.x+w/2;x+=160){ctx.beginPath();ctx.moveTo(x,cam.y-h/2);ctx.lineTo(x,cam.y+h/2);ctx.stroke();}
    for(let y=Math.floor((cam.y-h/2)/160)*160;y<cam.y+h/2;y+=160){ctx.beginPath();ctx.moveTo(cam.x-w/2,y);ctx.lineTo(cam.x+w/2,y);ctx.stroke();}
    ctx.lineWidth=1;ctx.setLineDash([3,15]);circle(ctx,0,0,430,null,'#84bfc510');circle(ctx,0,0,870,null,'#84bfc50a');ctx.setLineDash([]);
    const hw=WORLD.width/2,hh=WORLD.height/2;ctx.strokeStyle='#e4b77b45';ctx.setLineDash([8,12]);ctx.strokeRect(-hw,-hh,WORLD.width,WORLD.height);ctx.setLineDash([]);
  }
  station(ctx,t,dock){
    ctx.save();glow(ctx,0,0,300,'#4c9cab13');
    // Solar arrays and reinforced connector booms.
    line(ctx,-230,0,-60,0,'#40596e',13);line(ctx,-230,0,-60,0,'#8b9da7',3);
    for(const side of [-1,1]){
      ctx.save();ctx.translate(-175,side*71);ctx.rotate(Math.sin(t*.035)*.02);
      rect(ctx,-67,-40,134,80,'#0b172a','#526f87');
      for(let x=0;x<8;x++)for(let y=0;y<5;y++){const gradient=ctx.createLinearGradient(-63+x*16,-37+y*15,-48+x*16,-24+y*15);gradient.addColorStop(0,'#2c4c70');gradient.addColorStop(1,'#17324d');rect(ctx,-63+x*16,-37+y*15,14,13,gradient);line(ctx,-61+x*16,-32+y*15,-52+x*16,-32+y*15,'#7bacca25',.5);}
      line(ctx,-67,0,67,0,'#668297',2);ctx.restore();
    }
    ctx.save();ctx.rotate(t*.035);ctx.lineWidth=12;circle(ctx,0,0,86,null,'#182d40');ctx.lineWidth=2;circle(ctx,0,0,92,null,'#4c6475');ctx.lineWidth=1;circle(ctx,0,0,76,null,'#5a7b873b');
    for(let i=0;i<8;i++){
      ctx.save();ctx.rotate(i/8*TAU);rect(ctx,57,-16,43,32,'#283f50','#587383');rect(ctx,69,-12,22,24,'#344b59');rect(ctx,74,-9,9,3,i%2?'#83d6c8':'#bdc5b2');line(ctx,61,12,96,12,'#0c1b2a',2);line(ctx,61,-12,96,-12,'#71828c',1);ctx.restore();
    }ctx.restore();
    // Station center remains steady while the habitat ring turns.
    ctx.lineWidth=1.5;polygon(ctx,57,8,Math.PI/8);const core=ctx.createLinearGradient(-50,-50,50,50);core.addColorStop(0,'#63767b');core.addColorStop(.48,'#334c59');core.addColorStop(1,'#182e3e');ctx.fillStyle=core;ctx.fill();ctx.strokeStyle='#78939d';ctx.stroke();
    polygon(ctx,44,8,Math.PI/8);ctx.fillStyle='#112638';ctx.fill();ctx.strokeStyle='#44616b';ctx.stroke();
    for(const side of [-1,1]){rect(ctx,-15,side*25-4,30,8,'#6b8086');rect(ctx,-9,side*25-2,18,3,'#abc4bf');}
    circle(ctx,0,0,20,'#1c3c48','#688f92');circle(ctx,0,0,13,'#254c54','#79c6b3');circle(ctx,0,0,6,'#8ae5d5');glow(ctx,0,0,26,'#8ae5d52b');
    for(const [x,y]of [[-43,-48],[43,-48],[-43,48],[43,48]]){circle(ctx,x,y,2,'#8ae5d5');glow(ctx,x,y,10,'#8ae5d52b');}
    // The fixed recovery field is deliberately generous and visually separated from the hull.
    const x=dock.x,y=dock.y,r=dock.radius;
    glow(ctx,x,y,r*1.5,'#55e5cb0b');ctx.fillStyle='#66e2c908';circle(ctx,x,y,r,ctx.fillStyle);
    ctx.lineWidth=1;ctx.setLineDash([5,9]);circle(ctx,x,y,r,null,'#79d8ca59');ctx.setLineDash([]);
    ctx.save();ctx.translate(x,y);ctx.rotate(-t*.1);ctx.strokeStyle='#83e6d4a0';ctx.lineWidth=2;
    for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(0,0,r-6,i*Math.PI/2,i*Math.PI/2+.3);ctx.stroke();}ctx.restore();
    ctx.save();ctx.translate(x,y);ctx.strokeStyle='#8ae5d570';ctx.lineWidth=1;
    const b=24;for(const sx of [-1,1])for(const sy of [-1,1]){ctx.beginPath();ctx.moveTo(sx*(b-8),sy*b);ctx.lineTo(sx*b,sy*b);ctx.lineTo(sx*b,sy*(b-8));ctx.stroke();}
    line(ctx,-9,0,9,0,'#8ae5d540');line(ctx,0,-9,0,9,'#8ae5d540');ctx.restore();
    ctx.textAlign='center';ctx.font='11px "DM Sans",sans-serif';ctx.letterSpacing='1.6px';ctx.fillStyle='#88c8c1';ctx.fillText('HOME',x,y+54);ctx.letterSpacing='0px';
    // A broken freighter silhouette hangs beyond the habitat.
    ctx.save();ctx.translate(-420,-310);ctx.rotate(.42+Math.sin(t*.03)*.02);ctx.globalAlpha=.48;rect(ctx,-105,-23,159,46,'#1e3247','#3c5265');for(let i=0;i<5;i++)rect(ctx,-95+i*27,-19,20,38,'#263a50','#40546b');rect(ctx,50,-15,45,30,'#32465a','#597084');ctx.beginPath();ctx.moveTo(95,-15);ctx.lineTo(118,-7);ctx.lineTo(109,15);ctx.lineTo(95,15);ctx.fillStyle='#3e5161';ctx.fill();rect(ctx,-120,-15,12,30,'#354a5c');rect(ctx,-121,-11,3,6,'#a46d59');ctx.restore();
    ctx.restore();
  }
  asteroid(ctx,a,t){
    ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.angle);const r=a.radius;
    ctx.beginPath();for(let i=0;i<a.shape.length;i++){const angle=i/a.shape.length*TAU,rr=r*a.shape[i];i?ctx.lineTo(Math.cos(angle)*rr,Math.sin(angle)*rr):ctx.moveTo(Math.cos(angle)*rr,Math.sin(angle)*rr);}ctx.closePath();
    const g=ctx.createLinearGradient(-r,-r,r,r);g.addColorStop(0,'#586273');g.addColorStop(.4,'#333e50');g.addColorStop(1,'#192337');ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#8390a13d';ctx.lineWidth=1;ctx.stroke();
    ctx.save();ctx.clip();ctx.beginPath();ctx.moveTo(-r,-r*.1);ctx.lineTo(r*.1,-r*.5);ctx.lineTo(r*.5,r*.4);ctx.lineTo(-r*.5,r);ctx.fillStyle='#121e3240';ctx.fill();
    circle(ctx,-r*.2,-r*.2,r*.23,'#1b29394d','#8192a11b');circle(ctx,r*.4,r*.3,r*.15,'#14213380','#8192a119');circle(ctx,-r*.5,r*.35,r*.11,'#1b2939a0');line(ctx,-r*.4,-r*.6,r*.3,-r*.45,'#98a1a320');ctx.restore();ctx.restore();
  }
  cargo(ctx,c,game,t,menu){
    const attached=game.attachedId===c.id,near=Math.hypot(c.x-game.ship.x,c.y-game.ship.y)<BEAM_RANGE;
    ctx.save();ctx.translate(c.x,c.y);
    glow(ctx,0,0,57,c.color+'10');
    if(!menu&&!attached){
      ctx.setLineDash([3,6]);line(ctx,0,0,c.vx*3,c.vy*3,c.color+'55');ctx.setLineDash([]);
      const endx=c.vx*3,endy=c.vy*3;if(length(c)>2){circle(ctx,endx,endy,2,null,c.color+'60');}
    }
    if(near&&!attached){ctx.setLineDash([4,6]);ctx.lineWidth=1;circle(ctx,0,0,33+Math.sin(t*3)*1.5,null,'#8ae5d570');ctx.setLineDash([]);}
    ctx.save();ctx.rotate(c.angle);
    ctx.shadowColor=c.color+'33';ctx.shadowBlur=12;rect(ctx,-19,-14,38,28,'#1b2634','#7a8b8f');ctx.shadowBlur=0;
    const g=ctx.createLinearGradient(-15,-13,15,13);g.addColorStop(0,c.color);g.addColorStop(1,c.color+'88');rect(ctx,-15,-12,30,24,g);
    for(const x of [-10,0,10]){line(ctx,x,-10,x,10,'#0914204d',1.5);line(ctx,x+1,-10,x+1,10,'#ffffff16',.5);}
    for(const x of [-20,14])rect(ctx,x,-16,6,32,'#405766','#90a0a477');
    for(const x of [-18,16])for(const y of [-13,10])rect(ctx,x,y,2,3,'#bcc8c4');
    rect(ctx,-4,-3,8,6,'#182d37');rect(ctx,-2,-1,4,2,'#b3f3cf');ctx.restore();
    if(!attached){ctx.textAlign='center';ctx.font='10px "DM Sans",sans-serif';ctx.fillStyle='#a9bdc7';ctx.fillText(String(c.id).padStart(2,'0'),0,-40);}
    const dock=dockingZone(game);
    if(Math.hypot(c.x-dock.x,c.y-dock.y)<dock.radius+35&&length(c)>=dock.speed){ctx.fillStyle='#eeb576';ctx.font='10px "DM Sans",sans-serif';ctx.fillText('S · Brake',0,43);}
    ctx.restore();
  }
  ship(ctx,s,t){
    ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.angle);
    glow(ctx,-7,0,48,'#6cbbcf12');
    if(s.thrust>0){
      const flicker=.8+Math.sin(t*61)*.1+Math.sin(t*91)*.1;
      for(const y of [-8,8]){const len=(20+Math.abs(s.thrust)*23)*flicker;const g=ctx.createLinearGradient(-19,y,-19-len,y);g.addColorStop(0,'#fff0b8');g.addColorStop(.25,'#ffb567');g.addColorStop(1,'#ed795400');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-17,y-3.5);ctx.quadraticCurveTo(-26-len*.3,y-7,-19-len,y);ctx.quadraticCurveTo(-26-len*.3,y+7,-17,y+3.5);ctx.fill();}glow(ctx,-24,0,35,'#ff9e5925');
    }else if(s.thrust<0){for(const y of [-8,8]){glow(ctx,14,y,14,'#8ae5d533');ctx.fillStyle='#b7efe3';ctx.beginPath();ctx.moveTo(12,y-2);ctx.lineTo(25+Math.sin(t*90)*3,y);ctx.lineTo(12,y+2);ctx.fill();}}
    // Engine pods, armor shoulders, fuselage, cockpit and running lights.
    for(const y of [-10,10]){rect(ctx,-17,y-4,25,8,'#839494','#c0c8be');rect(ctx,-20,y-3,5,6,'#233b46','#6f9299');rect(ctx,-6,y-4,3,8,'#405e6a');}
    ctx.beginPath();ctx.moveTo(25,0);ctx.lineTo(8,-10);ctx.lineTo(-14,-7);ctx.lineTo(-17,0);ctx.lineTo(-14,7);ctx.lineTo(8,10);ctx.closePath();const g=ctx.createLinearGradient(0,-10,0,10);g.addColorStop(0,'#dfe0cc');g.addColorStop(.45,'#b0c4bb');g.addColorStop(1,'#607f88');ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#d0e1d0';ctx.lineWidth=.8;ctx.stroke();
    ctx.beginPath();ctx.moveTo(17,0);ctx.lineTo(6,-5);ctx.lineTo(-1,-4);ctx.lineTo(-1,4);ctx.lineTo(6,5);ctx.closePath();ctx.fillStyle='#133e50';ctx.fill();line(ctx,4,-3,11,0,'#8ae5d5a0',1.2);
    rect(ctx,-12,-4,7,8,'#3e5c65','#abc1ba55');line(ctx,-9,-2,-9,2,'#97afac');
    circle(ctx,-5,-14,1.5,'#e9ac78');circle(ctx,-5,14,1.5,'#8ae5d5');glow(ctx,-5,14,8,'#8ae5d52b');
    if(Math.abs(s.omega)>.2){const side=s.omega>0?-1:1;ctx.fillStyle='#a4e8df';ctx.beginPath();ctx.moveTo(7,side*9);ctx.lineTo(11,side*20);ctx.lineTo(4,side*10);ctx.fill();}
    ctx.restore();
  }
  shipVector(ctx,s){
    const v=length(s);if(v<9)return;
    ctx.setLineDash([2,7]);line(ctx,s.x,s.y,s.x+s.vx*.65,s.y+s.vy*.65,'#a8d9df40');ctx.setLineDash([]);
    circle(ctx,s.x+s.vx*.65,s.y+s.vy*.65,2,null,'#a8d9df60');
  }
  beam(ctx,s,c,t){
    const dx=c.x-s.x,dy=c.y-s.y,d=Math.hypot(dx,dy),nx=-dy/(d||1),ny=dx/(d||1);
    ctx.save();ctx.lineCap='round';
    for(const side of [-1,1]){
      ctx.globalAlpha=.6;line(ctx,s.x+nx*side*8,s.y+ny*side*8,c.x+nx*side*8,c.y+ny*side*8,'#8ae5d5',2);
    }
    ctx.globalAlpha=.12;line(ctx,s.x,s.y,c.x,c.y,'#8ae5d5',16);ctx.restore();
  }
  wind(ctx,game,t){
    const g=game.gust,cam=this.camera;ctx.save();ctx.strokeStyle=g.active?'#c5a9e74d':'#c5a9e71a';ctx.lineWidth=1;
    const w=this.width/cam.zoom,h=this.height/cam.zoom;
    for(let i=0;i<30;i++){const travel=t*(g.active?160:40),x=cam.x+((i*197+g.x*travel)%w+w)%w-w/2,y=cam.y+((i*139+g.y*travel)%h+h)%h-h/2;line(ctx,x,y,x+g.x*35,y+g.y*35,g.active?'#c5a9e74d':'#c5a9e71a');}ctx.restore();
  }
  indicators(ctx,game){
    const cam=this.camera,w=this.width,h=this.height,mobile=w<760;
    const left=mobile?28:36,right=w-(mobile?28:36),top=mobile?148:158,bottom=h-(mobile?155:85);
    const nearest=nearestCargo(game);
    const targets=game.attachedId!==null?[{...dockingZone(game),label:'HOME',color:'#8ae5d5'}]:nearest?[{...nearest,label:'CARGO',color:nearest.color}]:[];
    for(const target of targets){
      const x=(target.x-cam.x)*cam.zoom+w/2,y=(target.y-cam.y)*cam.zoom+h/2;
      if(x>left&&x<right&&y>top&&y<bottom)continue;
      const cx=w/2,cy=clamp(h/2,top+10,bottom-10),dx=x-cx,dy=y-cy;
      const scale=Math.min(Math.abs((dx>0?right-cx:left-cx)/(dx||.001)),Math.abs((dy>0?bottom-cy:top-cy)/(dy||.001)),1);
      const px=clamp(cx+dx*scale,left,right),py=clamp(cy+dy*scale,top,bottom),angle=Math.atan2(dy,dx);
      ctx.save();ctx.translate(px,py);ctx.rotate(angle);ctx.fillStyle=target.color;ctx.globalAlpha=.85;ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(-4,-4);ctx.lineTo(-4,4);ctx.closePath();ctx.fill();ctx.restore();
      ctx.textAlign=px>w/2?'right':'left';ctx.fillStyle=target.color;ctx.font='10px "DM Sans",sans-serif';ctx.fillText(target.label,px+(px>w/2?-12:12),py+3);
    }
  }
  drawRadar(game,t){
    const ctx=this.rctx,w=this.radar.clientWidth||232,h=this.radar.clientHeight||172,ratio=this.ratio;
    if(this.radar.width!==Math.round(w*ratio)||this.radar.height!==Math.round(h*ratio)){
      this.radar.width=Math.round(w*ratio);this.radar.height=Math.round(h*ratio);
    }
    ctx.setTransform(ratio,0,0,ratio,0,0);
    const sx=w/WORLD.width,sy=h/WORLD.height;
    ctx.clearRect(0,0,w,h);ctx.strokeStyle='#759db51a';ctx.lineWidth=1;
    for(let i=1;i<4;i++){line(ctx,w*i/4,0,w*i/4,h,'#759db51a');line(ctx,0,h*i/4,w,h*i/4,'#759db51a');}
    const point=b=>[w/2+b.x*sx,h/2+b.y*sy];
    for(const a of game.asteroids){const[x,y]=point(a);circle(ctx,x,y,2,'#8495ad9c');}
    circle(ctx,w/2,h/2,6,'#8ae5d51a','#8ae5d5');circle(ctx,w/2,h/2,2,'#8ae5d5');
    for(const c of game.cargo)if(!c.delivered){const[x,y]=point(c);rect(ctx,x-3,y-3,6,6,c.color,'#e8eee766');if(c.id===game.attachedId)circle(ctx,x,y,7,null,'#8ae5d5');}
    const s=game.ship,[x,y]=point(s);ctx.save();ctx.translate(x,y);ctx.rotate(s.angle);ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(-4.5,-4);ctx.lineTo(-3,0);ctx.lineTo(-4.5,4);ctx.closePath();ctx.fillStyle='#fff';ctx.fill();ctx.restore();
    const cam=this.camera;ctx.strokeStyle='#8ae5d55c';ctx.strokeRect(w/2+(cam.x-this.width/cam.zoom/2)*sx,h/2+(cam.y-this.height/cam.zoom/2)*sy,this.width/cam.zoom*sx,this.height/cam.zoom*sy);
  }
}
