import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, toggleBeam, observe, length, DT, DOCK, MISSIONS, CARGO_OFFSET, BEAM_RANGE, WORLD } from '../src/simulation.js';

function advance(g,seconds,input={}){for(let i=0;i<Math.round(seconds/DT);i++)stepGame(g,typeof input==='function'?input(g):input,DT);}
function empty(id='first'){const g=createGame(id);g.asteroids=[];return g;}

test('seeds reproduce complete initial conditions and variation changes them',()=>{
  assert.deepEqual(observe(createGame('storm',17)),observe(createGame('storm',17)));
  assert.notDeepEqual(createGame('storm',17).cargo,createGame('storm',18).cargo);
  for(const m of MISSIONS){const g=createGame(m.id);assert.equal(g.cargo.length,m.count);assert.equal(g.asteroids.length,m.asteroids);}
});
test('the world and mission clock advance with absolutely no input',()=>{
  const g=createGame(),c={...g.cargo[0]},a={...g.asteroids[0]};advance(g,10);
  assert.ok(g.elapsed>9.99);assert.ok(Math.hypot(g.cargo[0].x-c.x,g.cargo[0].y-c.y)>10);
  assert.ok(Math.hypot(g.asteroids[0].x-a.x,g.asteroids[0].y-a.y)>10);
});
test('thrust consumes fuel; drift persists; rotation does not rotate velocity',()=>{
  const g=empty();g.ship.angle=0;advance(g,1,{thrust:1});assert.ok(g.ship.vx>100);assert.ok(g.ship.fuel<g.mission.fuel);
  const speed=length(g.ship),fuel=g.ship.fuel;advance(g,1,{turn:1});assert.ok(Math.abs(g.ship.angle)>2);assert.ok(length(g.ship)>speed*.9);assert.ok(Math.abs(g.ship.vy)<.01);assert.equal(g.ship.fuel,fuel);
});
test('reverse thrust gently opposes the nose direction and preserves sideways drift',()=>{
  const g=empty();Object.assign(g.ship,{x:500,y:500,angle:0,vx:100,vy:60});
  advance(g,.5,{thrust:-.55});assert.ok(g.ship.vx>60&&g.ship.vx<75);assert.ok(g.ship.vy>55);
  advance(g,2,{thrust:-.55});assert.ok(g.ship.vx<0);
  const stopped=empty();stopped.ship.angle=Math.PI/2;advance(stopped,.5,{thrust:-.55});assert.ok(stopped.ship.vy<-25);
});
test('running out of fuel disables thrust but preserves coasting and rotation',()=>{
  const g=empty();g.ship.fuel=0;g.ship.vx=30;advance(g,1,{thrust:1,turn:.5});assert.ok(g.ship.vx<30&&g.ship.vx>25);assert.equal(g.ship.fuel,0);assert.ok(g.ship.angle>0);
});
test('beam attaches only within range, releases, and selects the closest cargo',()=>{
  const g=empty();assert.equal(toggleBeam(g),false);const c=g.cargo[1];c.x=g.ship.x+70;c.y=g.ship.y;
  assert.equal(toggleBeam(g),true);assert.equal(g.attachedId,c.id);assert.equal(toggleBeam(g),true);assert.equal(g.attachedId,null);
});
function assertCarried(g,c){
  assert.ok(Math.abs(c.x-(g.ship.x-Math.cos(g.ship.angle)*CARGO_OFFSET))<1e-8);
  assert.ok(Math.abs(c.y-(g.ship.y-Math.sin(g.ship.angle)*CARGO_OFFSET))<1e-8);
  assert.equal(c.vx,g.ship.vx);assert.equal(c.vy,g.ship.vy);assert.equal(c.angle,g.ship.angle);
}
test('pickup discards cargo drift and locks it to the ship immediately',()=>{
  const g=empty();g.ship.x=400;g.ship.y=400;g.ship.angle=0;const c=g.cargo[0];Object.assign(c,{x:500,y:400,vx:0,vy:0});g.cargo=[c];toggleBeam(g);
  assertCarried(g,c);assert.equal(length(g.ship),0);
  advance(g,10,()=>({turn:.35,thrust:.3}));assertCarried(g,c);assert.equal(g.attachedId,c.id);
});
test('heavy cargo follows sustained thrust, turns and braking without swinging or breaking off',()=>{
  for(const mass of [1.25,2,3.8]){
    const g=empty();g.ship.x=700;g.ship.y=600;g.ship.vx=180;const c=g.cargo[0];Object.assign(c,{x:810,y:600,vx:-110,vy:35,mass});g.cargo=[c];toggleBeam(g);
    assert.equal(g.ship.vx,180);assertCarried(g,c);
    for(let i=0;i<20;i++){advance(g,.5,{thrust:i%3===0?-.55:1,turn:.8});assertCarried(g,c);assert.equal(g.attachedId,c.id);}
  }
});
test('dropping cargo inherits ship drift with no extra swinging velocity',()=>{
  const g=empty();g.ship.x=600;g.ship.y=400;g.ship.vx=50;g.ship.vy=-20;const c=g.cargo[0];Object.assign(c,{x:670,y:400,vx:-130,vy:160});toggleBeam(g);advance(g,.5,{turn:1});
  const before={...c};toggleBeam(g);assert.equal(c.vx,g.ship.vx);assert.equal(c.vy,g.ship.vy);assert.equal(c.spin,0);
  advance(g,.2);assert.ok(Math.hypot(c.x-before.x,c.y-before.y)>5);assert.equal(g.attachedId,null);
});
test('an asteroid hitting carried cargo pushes the craft without dislodging the load',()=>{
  const g=empty();Object.assign(g.ship,{x:700,y:600,angle:0});const c=g.cargo[0];Object.assign(c,{x:750,y:600});toggleBeam(g);
  g.asteroids=[{x:c.x-30,y:c.y,vx:150,vy:0,radius:25,mass:7,angle:0,spin:0}];stepGame(g);assert.ok(g.ship.vx>0);assert.equal(g.attachedId,c.id);assertCarried(g,c);
});
test('a carried container stays inside the sector and follows its ship after boundary bounce',()=>{
  const g=empty();Object.assign(g.ship,{x:WORLD.width/2-100,y:600,angle:Math.PI,vx:150});const c=g.cargo[0];Object.assign(c,{x:g.ship.x+50,y:600});toggleBeam(g);advance(g,1);
  assertCarried(g,c);assert.ok(c.x+c.radius<=WORLD.width/2);assert.ok(g.ship.vx<0);
});
test('cargo delivery checks both zone and velocity; completing grants a bonus',()=>{
  const g=empty('debris');g.cargo=[g.cargo[0]];g.mission={...g.mission,count:1};const c=g.cargo[0];Object.assign(c,{x:DOCK.x,y:DOCK.y,vx:160,vy:0});
  stepGame(g);assert.equal(g.delivered,0);c.vx=20;stepGame(g);assert.equal(g.delivered,1);assert.equal(g.status,'complete');assert.ok(g.score>c.value);assert.ok(g.bonus>0);
  const score=g.score;advance(g,2);assert.equal(g.score,score);
});
test('a delivery detaches the recovered cargo and never scores it twice',()=>{
  const g=empty();g.ship.x=DOCK.x+70;g.ship.y=0;const c=g.cargo[0];Object.assign(c,{x:DOCK.x,y:0,vx:0,vy:0});toggleBeam(g);stepGame(g);assert.equal(g.attachedId,null);assert.equal(g.delivered,1);const score=g.score;advance(g,1);assert.equal(g.score,score);
});
test('gentle impacts are recoverable and hard impacts damage hull and knock back',()=>{
  for(const speed of [15,160]){
    const g=empty();Object.assign(g.ship,{x:600,y:600,vx:speed,vy:0});g.asteroids=[{x:635,y:600,vx:0,vy:0,radius:25,mass:7,angle:0,spin:0}];stepGame(g);
    assert.ok(g.ship.vx<speed);if(speed<30)assert.equal(g.ship.integrity,100);else assert.ok(g.ship.integrity<90);
    assert.ok(g.ship.integrity>0);
  }
});
test('asteroid impacts also affect cargo momentum and condition',()=>{
  const g=empty(),c=g.cargo[0];Object.assign(c,{x:600,y:600,vx:160,vy:0});g.asteroids=[{x:635,y:600,vx:0,vy:0,radius:25,mass:7,angle:0,spin:0}];stepGame(g);assert.ok(c.vx<160);assert.ok(c.health<100);
});
test('solar gusts have a five-second warning, push objects, then end',()=>{
  const g=empty('storm');advance(g,13.1);assert.equal(g.gust.warning,true);assert.equal(g.gust.active,false);const before={...g.ship};
  advance(g,5.2);assert.equal(g.gust.active,true);assert.equal(g.gust.warning,false);assert.ok(length(g.ship)>1);assert.ok(g.events.some(e=>e.type==='gust-warning'));
  advance(g,7);assert.equal(g.gust.active,false);assert.ok(g.nextGust>g.elapsed);assert.notEqual(g.ship.x,before.x);
});
test('timeouts and hull destruction terminate, while restart returns a fresh mission',()=>{
  const g=empty();g.elapsed=g.mission.time-.004;stepGame(g);assert.equal(g.status,'timeout');const elapsed=g.elapsed;advance(g,3);assert.equal(g.elapsed,elapsed);
  const broken=empty();broken.ship.integrity=0;stepGame(broken);assert.equal(broken.status,'destroyed');
  const fresh=createGame();assert.equal(fresh.status,'playing');assert.equal(fresh.delivered,0);assert.equal(fresh.elapsed,0);assert.equal(fresh.ship.integrity,100);
});
test('observation is a copy, so a future agent cannot edit live physics through it',()=>{
  const g=createGame(),o=observe(g);o.ship.fuel=0;o.cargo[0].x=9999;assert.equal(g.ship.fuel,g.mission.fuel);assert.notEqual(g.cargo[0].x,9999);
});

// End-to-end baseline using the same thrust/turn/pickup actions available in play.
// Uses normal turn/thrust actions, no teleporting, position edits or scripted deliveries.
export function pilot(g){
  const s=g.ship;const attached=g.cargo.find(c=>c.id===g.attachedId);
  const target=attached?{x:DOCK.x,y:DOCK.y,vx:0,vy:0}:g.cargo.filter(c=>!c.delivered).sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];
  if(!target)return {};
  if(!attached&&Math.hypot(target.x-s.x,target.y-s.y)<90)toggleBeam(g);
  const dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy),max=attached?85:115;
  const wanted=Math.min(max,d*.65),tvx=target.vx+dx/(d||1)*wanted,tvy=target.vy+dy/(d||1)*wanted;
  const ax=(tvx-s.vx)*2,ay=(tvy-s.vy)*2;
  const error=Math.atan2(Math.sin(Math.atan2(ay,ax)-s.angle),Math.cos(Math.atan2(ay,ax)-s.angle));
  return {turn:Math.max(-1,Math.min(1,error*3)),thrust:Math.abs(error)<.65?Math.min(1,Math.hypot(ax,ay)/112):0};
}
test('a normal controller can recover both introductory containers within the budget',()=>{
  const g=createGame();
  for(let i=0;i<g.mission.time/DT&&g.status==='playing';i++)stepGame(g,pilot(g),DT);
  assert.equal(g.status,'complete',JSON.stringify({delivered:g.delivered,time:g.elapsed,fuel:g.ship.fuel,ship:g.ship,cargo:g.cargo}));
  assert.equal(g.delivered,2);assert.ok(g.ship.fuel>0);assert.ok(g.ship.integrity>0);
});
test('the introductory contract is winnable with coarse keyboard-like inputs and no velocity matching',()=>{
  const g=createGame();
  while(g.status==='playing'){
    const s=g.ship,carrying=g.attachedId!==null;
    const target=carrying?DOCK:g.cargo.filter(c=>!c.delivered).sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];
    const dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy);
    if(!carrying&&d<BEAM_RANGE){toggleBeam(g);continue;}
    const wanted=Math.min(100,d*.6),ax=dx/(d||1)*wanted-s.vx,ay=dy/(d||1)*wanted-s.vy;
    const error=Math.atan2(Math.sin(Math.atan2(ay,ax)-s.angle),Math.cos(Math.atan2(ay,ax)-s.angle));
    const turn=Math.abs(error)<.09?0:Math.sign(error);
    const thrust=Math.abs(error)<.45&&Math.hypot(ax,ay)>10?1:0;
    advance(g,.12,{turn,thrust});
  }
  assert.equal(g.status,'complete',JSON.stringify({time:g.elapsed,cargo:g.delivered,fuel:g.ship.fuel}));
  assert.ok(g.elapsed<120);assert.equal(g.delivered,2);
});
