export const DT = 1 / 120;
export const WORLD = { width: 3000, height: 2200 };
export const DOCK = { x: 172, y: 0, radius: 145, speed: 120 };
export const BEAM_RANGE = 175;
export const CARGO_OFFSET = 43;
export const dockingZone = game => ({ ...DOCK, ...(game.mission.easy ? { radius: 165, speed: 200 } : {}) });
export const MISSIONS = [
  { id: 'first', name: 'First Recovery', label: '01', difficulty: 'TUTORIAL', easy: true, time: 240, fuel: 240, count: 2, asteroids: 3, wind: false, seed: 3181, description: 'A fixed introductory route. Pick up two nearby containers and fly home.', objective: 'Recover both containers', color: '#79dfd0' },
  { id: 'practice', name: 'Open Recovery', label: '02', difficulty: 'EASY', easy: true, time: 240, fuel: 240, count: 2, asteroids: 3, wind: false, seed: 1827, description: 'Nearby containers on a seeded route. Generous docking and fuel.', objective: 'Recover both containers', color: '#79dfd0' },
  { id: 'debris', name: 'Debris Field', label: '03', difficulty: 'INTERMEDIATE', time: 165, fuel: 112, count: 3, asteroids: 11, wind: false, seed: 9012, description: 'A fractured shipping lane. Three moving targets. Pick your approach.', objective: 'Recover as much cargo as possible', color: '#e5bb80' },
  { id: 'storm', name: 'Solar Storm', label: '04', difficulty: 'ADVANCED', time: 180, fuel: 105, count: 4, asteroids: 13, wind: true, seed: 7448, description: 'Heavy freight and shifting solar winds. Leave fuel for the journey home.', objective: 'Maximize your salvage score', color: '#ae9aec' },
];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const length = (v) => Math.hypot(v.vx, v.vy);
export function rng(seed) {
  return () => { let t = seed += 0x6d2b79f5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function createGame(missionId = 'first', seed) {
  const mission = MISSIONS.find(m => m.id === missionId) || MISSIONS[0];
  const random = rng(seed ?? mission.seed);
  const dock = dockingZone({ mission });
  const cargo = Array.from({ length: mission.count }, (_, i) => {
    const angles = [-0.35, 2.55, 1.02, -2.15];
    const a = angles[i] + (random() - 0.5) * 0.22;
    const distance = 590 + i * 100;
    const container = { id: i + 1, x: Math.cos(a) * distance, y: Math.sin(a) * distance, vx: (random() - 0.5) * 15, vy: (random() - 0.5) * 15, angle: random() * 6.28, spin: (random() - 0.5) * 0.3, radius: 19, mass: mission.wind ? 2 + i * 0.6 : 1.25 + i * 0.5, value: 500 + i * 150, color: ['#e9ae6b', '#9f91ea', '#7bd5bc', '#e37b92'][i], delivered: false, health: 100 };
    if (mission.id === 'first') Object.assign(container, i === 0 ? { x: 550, y: 30, vx: 1.5, vy: -0.75 } : { x: 400, y: -300, vx: -0.9, vy: 1.1 });
    if (mission.id === 'practice') {
      // Keep both recoveries outside home; a randomized route must not award
      // an automatic delivery just because a container spawned in the field.
      do {
        const angle = (i === 0 ? -0.25 : -1.9) + (random() - 0.5) * 1.2;
        const distance = 260 + random() * 180;
        container.x = 310 + Math.cos(angle) * distance;
        container.y = 75 + Math.sin(angle) * distance;
      } while (Math.hypot(container.x - dock.x, container.y - dock.y) < dock.radius + 100);
      container.vx = (random() - 0.5) * 4; container.vy = (random() - 0.5) * 4;
    }
    return container;
  });
  const asteroids = Array.from({ length: mission.asteroids }, (_, i) => {
    let x, y;
    do { x = (random() - 0.5) * 2650; y = (random() - 0.5) * 1850; }
    while (Math.hypot(x, y) < (mission.easy ? 750 : 420) || cargo.some(c => Math.hypot(c.x - x, c.y - y) < 150));
    return { id: i, x, y, vx: (random() - 0.5) * (mission.easy ? 10 : 42), vy: (random() - 0.5) * (mission.easy ? 10 : 32), angle: random() * 6.28, spin: (random() - 0.5) * 0.2, radius: 25 + random() * 29, mass: 7, shape: Array.from({ length: 10 }, () => 0.78 + random() * 0.28), shade: random() };
  });
  return {
    mission, seed: seed ?? mission.seed, elapsed: 0, status: 'playing', score: 0, delivered: 0,
    ship: { x: 310, y: 75, vx: 0, vy: 0, angle: mission.easy ? Math.atan2(cargo[0].y-75,cargo[0].x-310) : -0.48, omega: 0, radius: 16, mass: 1.8, fuel: mission.fuel, integrity: 100, thrust: 0, hitCooldown: 0 },
    cargo, asteroids, attachedId: null, events: [], nextGust: mission.wind ? 18 : Infinity,
    gust: { active: false, warning: false, x: 0, y: 0, remaining: 0, index: 0 }, fuelWarning: false, bonus: 0,
  };
}
function emit(game, type, payload = {}) { game.events.push({ type, ...payload }); }
export function nearestCargo(game) {
  const s = game.ship;
  return game.cargo.filter(c => !c.delivered).sort((a, b) => Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0] || null;
}
export function toggleBeam(game) {
  if (game.status !== 'playing') return false;
  if (game.attachedId !== null) {
    const carried = game.cargo.find(c => c.id === game.attachedId);
    if (carried) { syncCargo(game.ship, carried); carried.spin = 0; }
    game.attachedId = null; emit(game, 'release'); return true;
  }
  const c = nearestCargo(game);
  if (c && Math.hypot(c.x - game.ship.x, c.y - game.ship.y) <= BEAM_RANGE) {
    game.attachedId = c.id; syncCargo(game.ship, c);
    emit(game, 'attach', { id: c.id, x: c.x, y: c.y }); return true;
  }
  emit(game, 'range'); return false;
}
function syncCargo(ship, cargo) {
  cargo.x = ship.x - Math.cos(ship.angle) * CARGO_OFFSET;
  cargo.y = ship.y - Math.sin(ship.angle) * CARGO_OFFSET;
  cargo.vx = ship.vx; cargo.vy = ship.vy; cargo.angle = ship.angle;
}
function capSpeed(body, max) { const v = length(body); if (v > max) { body.vx *= max / v; body.vy *= max / v; } }
function integrate(body, dt, damping) {
  body.vx *= Math.exp(-damping * dt); body.vy *= Math.exp(-damping * dt);
  body.x += body.vx * dt; body.y += body.vy * dt;
  const hw = WORLD.width / 2 - body.radius, hh = WORLD.height / 2 - body.radius;
  if (Math.abs(body.x) > hw) { body.x = clamp(body.x, -hw, hw); body.vx = -Math.sign(body.x) * Math.abs(body.vx) * 0.65; }
  if (Math.abs(body.y) > hh) { body.y = clamp(body.y, -hh, hh); body.vy = -Math.sign(body.y) * Math.abs(body.vy) * 0.65; }
}
function collide(a, b, restitution = 0.55) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), overlap = a.radius + b.radius - d;
  if (overlap <= 0) return 0;
  const nx = d > 0.001 ? dx / d : 1, ny = d > 0.001 ? dy / d : 0;
  const inverseA = 1 / a.mass, inverseB = 1 / b.mass, total = inverseA + inverseB;
  a.x -= nx * overlap * inverseA / total; a.y -= ny * overlap * inverseA / total;
  b.x += nx * overlap * inverseB / total; b.y += ny * overlap * inverseB / total;
  const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (relative >= 0) return 0;
  const impulse = -(1 + restitution) * relative / total;
  a.vx -= impulse * nx * inverseA; a.vy -= impulse * ny * inverseA;
  b.vx += impulse * nx * inverseB; b.vy += impulse * ny * inverseB;
  return -relative;
}
// A hit on carried cargo pushes the entire craft, never an independent load.
function collideCargo(game, cargo, other) {
  if (cargo.id !== game.attachedId) return collide(cargo, other);
  const ship = game.ship;
  const body = { ...cargo, vx: ship.vx, vy: ship.vy, mass: ship.mass + cargo.mass };
  const impact = collide(body, other);
  ship.x += body.x - cargo.x; ship.y += body.y - cargo.y;
  ship.vx = body.vx; ship.vy = body.vy;
  syncCargo(ship, cargo);
  return impact;
}
export function finish(game, reason) {
  if (game.status !== 'playing') return;
  game.status = reason;
  if (reason === 'complete') {
    game.bonus = Math.round((game.mission.time - game.elapsed) * 3 + game.ship.fuel / game.mission.fuel * 400 + game.ship.integrity * 2);
    game.score += game.bonus;
  }
  game.ship.thrust = 0;
  emit(game, 'end', { reason });
}
export function stepGame(game, input = {}, dt = DT) {
  if (game.status !== 'playing') return;
  // Bound steps even for source-level controllers. The application uses DT.
  dt = clamp(dt, 0, 1 / 60);
  const s = game.ship;
  game.elapsed += dt;
  s.hitCooldown = Math.max(0, s.hitCooldown - dt);
  const turn = clamp(Number(input.turn) || 0, -1, 1);
  s.omega += (turn * 2.7 - s.omega) * Math.min(1, dt * 11);
  s.angle += s.omega * dt;
  s.angle = Math.atan2(Math.sin(s.angle), Math.cos(s.angle));
  const thrust = s.fuel > 0 ? clamp(Number(input.thrust) || 0, -0.55, 1) : 0;
  s.thrust = thrust;
  if (thrust) {
    // Main and weaker reverse thrust act along the nose, preserving inertia.
    const acc = thrust * 112;
    s.vx += Math.cos(s.angle) * acc * dt; s.vy += Math.sin(s.angle) * acc * dt;
    s.fuel = Math.max(0, s.fuel - Math.abs(thrust) * 1.65 * dt);
  }
  if (!game.fuelWarning && s.fuel / game.mission.fuel < 0.2) { game.fuelWarning = true; emit(game, 'fuel'); }
  const gust = game.gust;
  if (game.mission.wind) {
    if (!gust.active && game.elapsed >= game.nextGust - 5 && !gust.warning) {
      gust.warning = true;
      const a = game.seed * 0.01 + gust.index * 2.399;
      gust.x = Math.cos(a); gust.y = Math.sin(a);
      emit(game, 'gust-warning');
    }
    if (!gust.active && game.elapsed >= game.nextGust) {
      gust.active = true; gust.warning = false; gust.remaining = 7; emit(game, 'gust');
    }
    if (gust.active) {
      for (const b of [s, ...game.cargo.filter(c => !c.delivered && c.id !== game.attachedId), ...game.asteroids]) {
        b.vx += gust.x * 13 * dt; b.vy += gust.y * 13 * dt;
      }
      gust.remaining -= dt;
      if (gust.remaining <= 0) { gust.active = false; gust.index++; game.nextGust = game.elapsed + 26; emit(game, 'gust-end'); }
    }
  }
  const cargo = game.cargo.filter(c => !c.delivered);
  const attached = cargo.find(c => c.id === game.attachedId);
  capSpeed(s, game.mission.easy ? 180 : 220);
  integrate(s, dt, 0.1);
  if (attached) syncCargo(s, attached);
  for (const c of cargo) {
    if (c === attached) continue;
    capSpeed(c, 265); integrate(c,dt,0.008); c.angle += c.spin * dt;
  }
  for (const a of game.asteroids) { integrate(a,dt,0); a.angle += a.spin * dt; }
  for (const a of game.asteroids) {
    // Keep the station approach readable and avoid rocks camping in the docking bay.
    const ad = Math.hypot(a.x, a.y);
    if (ad < 275) { const nx = a.x / (ad || 1), ny = a.y / (ad || 1); a.x = nx * 276; a.y = ny * 276; const inward = a.vx*nx+a.vy*ny; if(inward<0){a.vx-=2*inward*nx;a.vy-=2*inward*ny;} }
    const impact = collide(s, a);
    if (impact > 6 && s.hitCooldown <= 0) {
      const damage = Math.max(0, (impact - 30) * 0.2);
      s.integrity = Math.max(0, s.integrity - damage); s.hitCooldown = 0.42;
      emit(game, 'collision', { x: s.x, y: s.y, force: impact, damage });
    }
    if (attached) syncCargo(s, attached);
    for (const c of cargo) {
      const ci = collideCargo(game, c, a);
      if (ci > 30) { c.health = Math.max(25, c.health - (ci-30)*0.08); emit(game, 'cargo-hit', { x:c.x,y:c.y,force:ci }); }
    }
  }
  for (const c of cargo) if (c !== attached) collide(s,c,0.25);
  if (attached) syncCargo(s, attached);
  for (let i=0;i<cargo.length;i++) for(let j=i+1;j<cargo.length;j++) {
    if (cargo[j] === attached) collideCargo(game, cargo[j], cargo[i]);
    else collideCargo(game, cargo[i], cargo[j]);
  }
  if (attached) {
    const margin = CARGO_OFFSET + attached.radius;
    const hw = WORLD.width/2-margin, hh = WORLD.height/2-margin;
    if (Math.abs(s.x)>hw) { s.x=clamp(s.x,-hw,hw); s.vx=-Math.sign(s.x)*Math.abs(s.vx)*0.65; }
    if (Math.abs(s.y)>hh) { s.y=clamp(s.y,-hh,hh); s.vy=-Math.sign(s.y)*Math.abs(s.vy)*0.65; }
    syncCargo(s, attached);
  }
  const dock = dockingZone(game);
  for (const c of cargo) {
    const inZone = Math.hypot(c.x-dock.x,c.y-dock.y)<dock.radius || (c === attached && Math.hypot(s.x-dock.x,s.y-dock.y)<dock.radius);
    if (inZone && length(c)<dock.speed) {
      c.delivered = true;
      if (game.attachedId === c.id) game.attachedId = null;
      game.delivered++;
      const points = Math.round(c.value * (0.65+0.35*c.health/100) + Math.max(0, game.mission.time-game.elapsed)*0.8 + s.fuel/game.mission.fuel*100);
      game.score += points;
      emit(game,'delivery',{id:c.id,x:c.x,y:c.y,points});
    }
  }
  if (s.integrity <= 0) finish(game,'destroyed');
  else if (game.delivered === game.mission.count) finish(game,'complete');
  else if (game.elapsed >= game.mission.time) finish(game,'timeout');
}
export function observe(game) {
  return {
    mission:game.mission.id,seed:game.seed,status:game.status,elapsed:game.elapsed,timeRemaining:Math.max(0,game.mission.time-game.elapsed),score:game.score,delivered:game.delivered,
    ship:{...game.ship},cargo:game.cargo.map(c=>({...c})),asteroids:game.asteroids.map(a=>({x:a.x,y:a.y,vx:a.vx,vy:a.vy,radius:a.radius})),
    attachedId:game.attachedId,dock:dockingZone(game),gust:{...game.gust},
  };
}
