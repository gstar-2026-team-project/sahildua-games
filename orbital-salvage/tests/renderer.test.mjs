import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../src/renderer.js';
import { createGame, dockingZone, WORLD } from '../src/simulation.js';
import { layerOffset, skyPlacement } from '../src/space-background.js';
import { placeEdgeMarker } from '../src/screen-layout.js';

test('edge labels avoid the ship and map in phone and landscape layouts', () => {
  const cases=[
    {width:320,ideal:{x:122,y:254},bounds:{left:28,right:292,top:252,bottom:403},obstacles:[
      {left:115,right:205,top:249,bottom:319},{left:142,right:304,top:262,bottom:412}]},
    {width:844,ideal:{x:408,y:198},bounds:{left:36,right:808,top:198,bottom:305},obstacles:[
      {left:377,right:467,top:160,bottom:230},{left:666,right:828,top:225,bottom:374}]},
  ];
  for(const c of cases){
    const {box}=placeEdgeMarker(c.ideal,c.bounds,c.obstacles,72,c.width);
    for(const obstacle of c.obstacles)assert.ok(box.right<=obstacle.left||box.left>=obstacle.right||box.bottom<=obstacle.top||box.top>=obstacle.bottom);
    assert.ok(box.left>=0&&box.right<=c.width);
  }
});

test('sky continues panning near sector edges and nearer layers travel farther', () => {
  const start={x:WORLD.width/2-200,y:WORLD.height/2-200},end={x:start.x+150,y:start.y+150};
  const farStart=skyPlacement(start,0,390,844,1672,941),farEnd=skyPlacement(end,0,390,844,1672,941);
  const nearStart=layerOffset(start,0,.85),nearEnd=layerOffset(end,0,.85);
  assert.ok(farEnd.x<farStart.x && farEnd.y<farStart.y,'far sky must not clamp mid-flight');
  assert.ok(Math.abs(nearEnd.x-nearStart.x)>Math.abs(farEnd.x-farStart.x)*3,'dust must give a stronger motion cue');
  const idle=layerOffset(start,10,.85,13);
  assert.ok(Math.hypot(idle.x-nearStart.x,idle.y-nearStart.y)>100,'nearby particles must visibly drift when controls are idle');
});

test('painted sky covers every viewport at sector extremes without exposing an image edge', () => {
  for(const [width,height] of [[1440,1000],[390,844],[844,390],[320,568]]){
    for(const x of [-WORLD.width/2-80,WORLD.width/2+80])for(const y of [-WORLD.height/2-65,WORLD.height/2+65]){
      for(const time of [0,35,105]){
        const sky=skyPlacement({x,y},time,width,height,1672,941);
        assert.ok(sky.x<=0 && sky.y<=0 && sky.x+sky.width>=width && sky.y+sky.height>=height);
      }
    }
  }
});

function recordingContext() {
  const text = [], ellipses = [];
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({ fillText: value => text.push(value), ellipse: (...args) => ellipses.push(args),
    createRadialGradient: () => gradient, createLinearGradient: () => gradient },
  { get: (target, key) => target[key] ?? (() => {}) });
  return { ctx, text, ellipses };
}

test('dock hint does not tell a counter-moving ship to accelerate with S', () => {
  const game = createGame('debris'), cargo = game.cargo[0], { ctx, text } = recordingContext();
  Object.assign(game.ship, { x: 172, y: 0, angle: 0, vx: -150, vy: 0 });
  Object.assign(cargo, { x: 129, y: 0, vx: -150, vy: 0 });game.attachedId = cargo.id;
  Renderer.prototype.cargo(ctx, cargo, game, 0, false);
  assert.ok(text.includes('Slow down · below 120 m/s'));
  assert.ok(!text.some(value => value.includes('S · Brake')));
});

test('radar recovery field uses the physical docking center and radius', () => {
  const game = createGame('debris'), { ctx, ellipses } = recordingContext(), dock = dockingZone(game);
  Renderer.prototype.drawRadar.call({ rctx: ctx, radar: { clientWidth: 232, clientHeight: 172 }, ratio: 1,
    camera: { x: 0, y: 0, zoom: 1 }, width: 1440, height: 1000 }, game, 0);
  assert.equal(ellipses.length, 1);
  const expected = [116 + dock.x * 232 / WORLD.width, 86 + dock.y * 172 / WORLD.height,
    dock.radius * 232 / WORLD.width, dock.radius * 172 / WORLD.height];
  expected.forEach((value, i) => assert.ok(Math.abs(ellipses[0][i] - value) < 1e-8));
});
