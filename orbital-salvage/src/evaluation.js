import { BEAM_RANGE, DT, MISSIONS, clamp, createGame, observe, stepGame, toggleBeam } from './simulation.js';

// Diagnostic baseline: exact state in, the same discrete turn/thrust axes as keys out.
// Its score is not a human or screenshot-agent baseline.
export function statePilot(state) {
  const ship = state.ship;
  const carrying = state.attachedId !== null;
  const target = carrying ? state.dock : state.cargo.filter(c => !c.delivered)
    .sort((a, b) => Math.hypot(a.x - ship.x, a.y - ship.y) - Math.hypot(b.x - ship.x, b.y - ship.y))[0];
  if (!target) return {};
  const dx = target.x - ship.x, dy = target.y - ship.y, distance = Math.hypot(dx, dy);
  const wanted = Math.min(100, distance * 0.6);
  const ax = dx / (distance || 1) * wanted - ship.vx;
  const ay = dy / (distance || 1) * wanted - ship.vy;
  const error = Math.atan2(Math.sin(Math.atan2(ay, ax) - ship.angle), Math.cos(Math.atan2(ay, ax) - ship.angle));
  return {
    turn: Math.abs(error) < 0.09 ? 0 : Math.sign(error),
    thrust: Math.abs(error) < 0.45 && Math.hypot(ax, ay) > 10 ? 1 : 0,
    tractor: !carrying && distance < BEAM_RANGE,
  };
}

// Latency injection applies inference time to the OLD held action before the new
// action lands. Paused mode charges no inference time. Both use identical ticks.
export async function runEpisode({
  mission = 'practice', seed, mode = 'paused', decide = statePilot,
  intervalMs = 120, latencyMs, maxDecisions = 10000, now = () => performance.now(),
} = {}) {
  if (!MISSIONS.some(m => m.id === mission)) throw new Error(`Unknown mission: ${mission}`);
  if (!['paused', 'latency'].includes(mode)) throw new Error(`Unknown clock mode: ${mode}`);
  if (!Number.isFinite(intervalMs) || intervalMs < DT * 1000) throw new Error('intervalMs must be at least one physics tick');
  if (latencyMs !== undefined && (!Number.isFinite(latencyMs) || latencyMs < 0)) throw new Error('latencyMs must be finite and nonnegative');
  if (!Number.isInteger(maxDecisions) || maxDecisions < 1) throw new Error('maxDecisions must be a positive integer');
  if (seed !== undefined && !Number.isFinite(seed)) throw new Error('seed must be finite');
  const game = createGame(mission, seed);
  const initial = observe(game), decisions = [], events = [];
  let held = { turn: 0, thrust: 0 }, accumulated = 0;
  const collectEvents = () => {
    for (const event of game.events) events.push({ ...event, elapsed: game.elapsed });
    game.events.length = 0;
  };
  function advance(milliseconds) {
    accumulated += milliseconds / 1000;
    while (accumulated + 1e-10 >= DT && game.status === 'playing') {
      stepGame(game, held, DT);
      accumulated = Math.max(0, accumulated - DT);
      collectEvents();
    }
  }
  while (game.status === 'playing' && decisions.length < maxDecisions) {
    const observation = observe(game), observationElapsed = game.elapsed, observationWallMs = now();
    // Controller ownership ends at this call's return; copy and normalize its action.
    const requested = await decide(observation);
    const actionArrivalWallMs = now();
    const measuredLatencyMs = Math.max(0, actionArrivalWallMs - observationWallMs);
    const chargedLatencyMs = mode === 'latency' ? latencyMs ?? measuredLatencyMs : 0;
    const action = {
      turn: clamp(Number(requested?.turn) || 0, -1, 1),
      thrust: clamp(Number(requested?.thrust) || 0, -0.55, 1),
      tractor: Boolean(requested?.tractor),
    };
    const previousAction = { ...held };
    advance(chargedLatencyMs);
    const actionElapsed = game.elapsed, applied = game.status === 'playing';
    if (applied) {
      held = { turn: action.turn, thrust: action.thrust };
      if (action.tractor) { toggleBeam(game); collectEvents(); }
      advance(intervalMs);
    }
    decisions.push({ observationElapsed, observationWallMs, actionArrivalWallMs,
      measuredLatencyMs, chargedLatencyMs, previousAction, action, applied, actionElapsed, afterElapsed: game.elapsed });
  }
  return {
    mission, seed: game.seed, clock: mode === 'latency' ? 'latency-injection' : 'paused',
    interface: 'privileged-state / turn-thrust-tractor', intervalMs,
    latency: latencyMs === undefined ? 'measured' : { injectedMs: latencyMs },
    status: game.status === 'playing' ? 'decision-limit' : game.status,
    score: game.score, delivered: game.delivered, elapsed: game.elapsed,
    fuel: game.ship.fuel, hull: game.ship.integrity, initial, final: observe(game), decisions, events,
  };
}
