import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../src/renderer.js';
import { createGame, dockingZone, WORLD } from '../src/simulation.js';

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
