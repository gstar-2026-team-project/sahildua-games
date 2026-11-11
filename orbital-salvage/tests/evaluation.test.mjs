import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runEpisode } from '../src/evaluation.js';
import { DT } from '../src/simulation.js';

test('latency is charged to the old held action before the new action arrives', async () => {
  const actions = [{ thrust: 1 }, {}];
  const run = await runEpisode({ mode: 'latency', latencyMs: 1000, intervalMs: 100,
    maxDecisions: 2, decide: () => actions.shift() });
  assert.ok(Math.abs(run.decisions[0].actionElapsed - 1) < DT);
  assert.ok(Math.abs(run.decisions[1].actionElapsed - 2.1) < DT);
  assert.deepEqual(run.decisions[1].previousAction, { turn: 0, thrust: 1 });
  // Only the first 0.1 seconds and the second inference second use thrust.
  assert.ok(Math.abs(run.fuel - (240 - 1.1 * 1.65)) < 1e-8);
});

test('paused and zero-latency runs reproduce the same trajectory and outcome', async () => {
  const paused = await runEpisode({ seed: 42, mode: 'paused', latencyMs: 500 });
  const live = await runEpisode({ seed: 42, mode: 'latency', latencyMs: 0 });
  assert.equal(paused.status, 'complete');
  assert.deepEqual(paused.initial, live.initial);
  assert.deepEqual(paused.final, live.final);
  assert.deepEqual(paused.events, live.events);
  assert.equal(paused.decisions[0].chargedLatencyMs, 0);
});

test('an asynchronous controller can use measured latency without editing live state', async () => {
  let wall = 50;
  const run = await runEpisode({ mode: 'latency', intervalMs: 100, maxDecisions: 1, now: () => wall,
    decide: async observation => { observation.ship.fuel = 0; wall += 250; return { thrust: 1 }; } });
  assert.equal(run.decisions[0].observationWallMs, 50);
  assert.equal(run.decisions[0].actionArrivalWallMs, 300);
  assert.equal(run.decisions[0].chargedLatencyMs, 250);
  assert.ok(Math.abs(run.elapsed - 0.35) < DT);
  assert.ok(run.fuel > 239);
});

test('actions arriving after the deadline are logged but cannot affect the game', async () => {
  const run = await runEpisode({ mode: 'latency', latencyMs: 241000, decide: () => ({ thrust: 1, tractor: true }) });
  assert.equal(run.status, 'timeout');
  assert.equal(run.decisions.length, 1);
  assert.equal(run.decisions[0].applied, false);
  assert.equal(run.fuel, 240);
  assert.equal(run.events.at(-1).type, 'end');
});
