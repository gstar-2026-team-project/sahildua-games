import { WORLD, BEAM_RANGE, dockingZone, rng, length, clamp, nearestCargo } from './simulation.js';
import { drawShip, drawStation, drawDock, drawAsteroid, drawCargoBody } from './art.js';

const TAU = Math.PI * 2;
function circle(ctx,x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,TAU);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function line(ctx,x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function glow(ctx,x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');circle(ctx,x,y,r,g);}
function rect(ctx,x,y,w,h,fill,stroke){ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);if(stroke){ctx.strokeStyle=stroke;ctx.strokeRect(x,y,w,h);}}

export class Renderer {
  constructor(canvas,radar){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.radar=radar;this.rctx=radar.getContext('2d');this.width=innerWidth;this.height=innerHeight;
    this.camera={x:0,y:0,zoom:1};this.particles=[];this.rings=[];this.trail=[];this.floaters=[];this.flash=0;this.shake=0;this.time=0;this.trailClock=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const random=rng(912384);
    this.stars=Array.from({length:500},()=>({x:random(),y:random(),r:random()*1.3+.3,depth:.1+random()*.5,alpha:.18+random()*.7,phase:random()*TAU}));
    this.dust=Array.from({length:34},()=>({x:(random()-.5)*WORLD.width,y:(random()-.5)*WORLD.height,r:random()*3+1,a:random()*TAU}));
    this.backdrop=new Image();this.backdrop.src=new URL('../assets/space-backdrop.png',import.meta.url).href;
    this.resize();
  }
  resize(){this.width=innerWidth;this.height=innerHeight;this.ratio=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(this.width*this.ratio);this.canvas.height=Math.round(this.height*this.ratio);}
  reset(game,menu=false){
    this.particles=[];this.rings=[];this.trail=[];this.floaters=[];this.shake=0;this.flash=0;this.trailClock=0;
    this.lastShip={x:game.ship.x,y:game.ship.y};
    this.camera.x=menu?-this.width*.22:game.ship.x;this.camera.y=menu?-this.height*.05:game.ship.y;this.camera.zoom=menu?1:this.targetZoom();
  }
  targetZoom(speed=0){return (this.width<760?.82:this.width<1100?1.04:1.16)*(1-Math.min(1,speed/220)*.08);}
  get effectsActive(){return this.particles.length>0||this.rings.length>0;}
  burst(x,y,color,count=22,energy=90){
    for(let i=0;i<count;i++){const a=Math.random()*TAU,v=energy*(.2+Math.random());this.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.4+Math.random()*.8,max:1.2,size:1+Math.random()*2,color});}
  }
  event(event){
    if(event.type==='delivery'){
      this.burst(event.x,event.y,'#8affdf',52,135);this.burst(event.x,event.y,'#ffd282',26,95);
      this.rings.push({x:event.x,y:event.y,t:0,color:'#83ffe0'},{x:event.x,y:event.y,t:-.18,color:'#ffe0a3'});
      this.floaters.push({x:event.x,y:event.y,t:0,text:`+${event.points}`,color:'#e6ffce'});
      if(!this.reduced)this.flash=.12;
    }
    if(event.type==='attach'){
      this.burst(event.x,event.y,'#71eaff',25,70);this.rings.push({x:event.x,y:event.y,t:0,color:'#7ceaff',pickup:true});
    }
    if(event.type==='release')this.burst(this.lastShip.x,this.lastShip.y,'#8ed6f2',10,35);
    if(event.type==='collision'||event.type==='cargo-hit'){
      this.burst(event.x,event.y,'#ffac5d',Math.min(36,Math.round(event.force/3)),150);
      if(!this.reduced){this.shake=Math.min(7,event.force*.035);this.flash=.05;}
    }
    if(event.type==='end'&&event.reason==='complete'){
      this.burst(this.lastShip.x,this.lastShip.y,'#8fffdc',38,175);
    }
  }
  update(game,dt,menu){
    this.time+=dt;const cam=this.camera,s=game.ship;
    this.lastShip={x:s.x,y:s.y};
    const tx=menu?-this.width*.22:s.x+s.vx*.4,ty=menu?-this.height*.05:s.y+s.vy*.32;
    const follow=1-Math.exp(-dt*4);cam.x+=(tx-cam.x)*follow;cam.y+=(ty-cam.y)*follow;cam.zoom+=((menu?1:this.targetZoom(length(s)))-cam.zoom)*follow;
    this.shake*=Math.exp(-dt*13);this.flash*=Math.exp(-dt*7);
    this.trailClock+=dt;
    if(!menu&&length(s)>15&&dt>0&&this.trailClock>.035){
      this.trailClock=0;this.trail.push({x:s.x-Math.cos(s.angle)*22,y:s.y-Math.sin(s.angle)*22,t:this.time});
    }
    this.trail=this.trail.filter(p=>this.time-p.t<1.1).slice(-35);
    for(const f of this.floaters)f.t+=dt;
    this.floaters=this.floaters.filter(f=>f.t<1.1);
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
    this.station(ctx,t,dockingZone(game),game.attachedId!==null);
    this.drawTrail(ctx);
    for(const a of game.asteroids)this.asteroid(ctx,a,t);
    for(const c of game.cargo)if(!c.delivered)this.cargo(ctx,c,game,t,menu);
    if(game.attachedId!==null){const c=game.cargo.find(c=>c.id===game.attachedId);if(c&&!c.delivered)this.beam(ctx,game.ship,c,t);}
    this.ship(ctx,game.ship,t);
    if(!menu)this.shipVector(ctx,game.ship);
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(const p of this.particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);line(ctx,p.x,p.y,p.x-p.vx*.035,p.y-p.vy*.035,p.color,p.size);circle(ctx,p.x,p.y,p.size*.7,'#fff9db');}
    ctx.restore();
    ctx.globalAlpha=1;
    for(const ring of this.rings){if(ring.t<0)continue;ctx.globalAlpha=(1-ring.t/1.4)*.8;ctx.lineWidth=ring.pickup?1.5:2.5;circle(ctx,ring.x,ring.y,ring.pickup?18+ring.t*45:25+ring.t*130,null,ring.color);}ctx.globalAlpha=1;
    for(const f of this.floaters){ctx.globalAlpha=Math.max(0,1-f.t/1.1);ctx.textAlign='center';ctx.font='600 19px "Space Grotesk",sans-serif';ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y-28-f.t*42);}ctx.globalAlpha=1;
    if(game.gust.active||game.gust.warning)this.wind(ctx,game,t);
    ctx.restore();
    if(menu){const fade=ctx.createLinearGradient(0,0,w*.65,0);fade.addColorStop(0,'#070e1af2');fade.addColorStop(.55,'#070e1ac4');fade.addColorStop(1,'#070e1a00');ctx.fillStyle=fade;ctx.fillRect(0,0,w*.65,h);}
    else{this.indicators(ctx,game);this.drawRadar(game,t);}
    if(this.flash>.002&&!this.reduced){ctx.fillStyle=`rgba(129,255,224,${this.flash})`;ctx.fillRect(0,0,w,h);}
  }
  background(ctx,w,h,t,cam){
    ctx.fillStyle='#09152c';ctx.fillRect(0,0,w,h);
    if(this.backdrop.complete&&this.backdrop.naturalWidth){
      const scale=Math.max(w/this.backdrop.naturalWidth,h/this.backdrop.naturalHeight)*1.1;
      const iw=this.backdrop.naturalWidth*scale,ih=this.backdrop.naturalHeight*scale;
      const dx=Math.max(-w*.04,Math.min(w*.04,-cam.x*.025)),dy=Math.max(-h*.04,Math.min(h*.04,-cam.y*.025));
      ctx.drawImage(this.backdrop,(w-iw)/2+dx,(h-ih)/2+dy,iw,ih);
      ctx.fillStyle='#05122b38';ctx.fillRect(0,0,w,h);
    }else{
      glow(ctx,w*.8,h*.2,w*.6,'#3359a544');glow(ctx,w*.2,h*.8,w*.5,'#8b3a9655');
    }
    // Independent near/far stars move over the painted sky, giving it depth.
    for(const s of this.stars){
      const x=((s.x*w-cam.x*s.depth*.2+t*s.depth*.5)%(w+20)+w+20)%(w+20)-10;
      const y=((s.y*h-cam.y*s.depth*.2+t*s.depth*.15)%(h+20)+h+20)%(h+20)-10;
      ctx.globalAlpha=s.alpha*(.75+.25*Math.sin(t*.5+s.phase));circle(ctx,x,y,s.r*.85,s.depth>.45?'#defaff':'#a7b6eb');
    }
    ctx.globalAlpha=1;
    if(!this.reduced){
      const phase=t%17;
      if(phase<.8){const x=w*.63+phase*260,y=h*.16+phase*90;const g=ctx.createLinearGradient(x-80,y-28,x,y);g.addColorStop(0,'#b5eeff00');g.addColorStop(1,'#d0f6ffb0');line(ctx,x-80,y-28,x,y,g,1);}
    }
  }
  drawTrail(ctx){
    if(this.trail.length<2)return;
    ctx.save();ctx.globalCompositeOperation='screen';ctx.lineCap='round';
    for(let i=1;i<this.trail.length;i++){
      const a=this.trail[i-1],b=this.trail[i],life=Math.max(0,1-(this.time-b.t)/1.1);
      ctx.globalAlpha=life*.19;line(ctx,a.x,a.y,b.x,b.y,'#ffb36b',life*6+.4);
    }ctx.restore();
  }
  worldGrid(ctx,t){
    ctx.strokeStyle='#83abc303';ctx.lineWidth=1;
    const cam=this.camera,w=this.width/cam.zoom,h=this.height/cam.zoom;
    for(let x=Math.floor((cam.x-w/2)/160)*160;x<cam.x+w/2;x+=160){ctx.beginPath();ctx.moveTo(x,cam.y-h/2);ctx.lineTo(x,cam.y+h/2);ctx.stroke();}
    for(let y=Math.floor((cam.y-h/2)/160)*160;y<cam.y+h/2;y+=160){ctx.beginPath();ctx.moveTo(cam.x-w/2,y);ctx.lineTo(cam.x+w/2,y);ctx.stroke();}
    ctx.lineWidth=1;ctx.setLineDash([3,15]);circle(ctx,0,0,430,null,'#84bfc510');circle(ctx,0,0,870,null,'#84bfc50a');ctx.setLineDash([]);
    const hw=WORLD.width/2,hh=WORLD.height/2;ctx.strokeStyle='#efb47977';ctx.setLineDash([8,12]);ctx.strokeRect(-hw,-hh,WORLD.width,WORLD.height);ctx.setLineDash([]);
  }
  station(ctx,t,dock,carrying=false){
    drawStation(ctx,t);drawDock(ctx,dock,t,carrying);
    // A distant broken freighter adds scale to the accident site.
    ctx.save();ctx.translate(-420,-310);ctx.rotate(.42+Math.sin(t*.03)*.02);ctx.globalAlpha=.65;
    rect(ctx,-108,-25,160,50,'#243c58','#6a839b');
    for(let i=0;i<5;i++){rect(ctx,-99+i*28,-21,22,42,i%2?'#486d89':'#7b664e','#9eb8c044');line(ctx,-97+i*28,-18,-97+i*28,18,'#d7b58d44');}
    rect(ctx,52,-16,43,32,'#526e89','#a4bec9');
    ctx.beginPath();ctx.moveTo(95,-16);ctx.lineTo(120,-7);ctx.lineTo(110,16);ctx.lineTo(95,16);ctx.fillStyle='#8795a5';ctx.fill();
    rect(ctx,-122,-17,12,34,'#45566b');rect(ctx,-123,-10,3,7,'#ef9e61');ctx.restore();
  }
  asteroid(ctx,a,t){drawAsteroid(ctx,a);}
  cargo(ctx,c,game,t,menu){
    const attached=game.attachedId===c.id,near=Math.hypot(c.x-game.ship.x,c.y-game.ship.y)<BEAM_RANGE;
    ctx.save();ctx.translate(c.x,c.y);
    glow(ctx,0,0,65,c.color+'22');
    if(!menu&&!attached){
      ctx.setLineDash([3,6]);line(ctx,0,0,c.vx*3,c.vy*3,c.color+'55');ctx.setLineDash([]);
      const endx=c.vx*3,endy=c.vy*3;if(length(c)>2){circle(ctx,endx,endy,2,null,c.color+'60');}
    }
    if(near&&!attached){ctx.setLineDash([4,6]);ctx.lineWidth=1;circle(ctx,0,0,35+Math.sin(t*3)*1.5,null,'#ffe2a155');ctx.setLineDash([]);}
    drawCargoBody(ctx,c,t,attached);
    if(near&&!attached){
      ctx.save();ctx.rotate(-t*.65);ctx.lineWidth=2;ctx.strokeStyle='#ffe0a1';
      for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(29,-10);ctx.lineTo(29,-17);ctx.lineTo(22,-17);ctx.stroke();}
      ctx.restore();
    }
    if(!attached){ctx.textAlign='center';ctx.font='10px "DM Sans",sans-serif';ctx.fillStyle='#a9bdc7';ctx.fillText(String(c.id).padStart(2,'0'),0,-40);}
    const dock=dockingZone(game);
    if(Math.hypot(c.x-dock.x,c.y-dock.y)<dock.radius+35&&length(c)>=dock.speed){ctx.fillStyle='#eeb576';ctx.font='10px "DM Sans",sans-serif';ctx.fillText(`Slow down · below ${dock.speed} m/s`,0,43);}
    ctx.restore();
  }
  ship(ctx,s,t){drawShip(ctx,s,t);}
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
    circle(ctx,w/2,h/2,3,'#8495ad9c');
    const dock=dockingZone(game),[homeX,homeY]=point(dock);
    ctx.beginPath();ctx.ellipse(homeX,homeY,dock.radius*sx,dock.radius*sy,0,0,TAU);ctx.fillStyle='#8ae5d51a';ctx.fill();ctx.strokeStyle='#8ae5d5';ctx.stroke();
    circle(ctx,homeX,homeY,2,'#8ae5d5');
    for(const c of game.cargo)if(!c.delivered){const[x,y]=point(c);rect(ctx,x-3,y-3,6,6,c.color,'#e8eee766');if(c.id===game.attachedId)circle(ctx,x,y,7,null,'#8ae5d5');}
    const s=game.ship,[x,y]=point(s);ctx.save();ctx.translate(x,y);ctx.rotate(s.angle);ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(-4.5,-4);ctx.lineTo(-3,0);ctx.lineTo(-4.5,4);ctx.closePath();ctx.fillStyle='#fff';ctx.fill();ctx.restore();
    const cam=this.camera;ctx.strokeStyle='#8ae5d55c';ctx.strokeRect(w/2+(cam.x-this.width/cam.zoom/2)*sx,h/2+(cam.y-this.height/cam.zoom/2)*sy,this.width/cam.zoom*sx,this.height/cam.zoom*sy);
  }
}
