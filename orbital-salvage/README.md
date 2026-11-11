# Orbital Salvage

**A little ship. A lot of momentum. Bring the scattered pieces home.**

A polished, top-down Canvas game with drifting cargo, simple rigid pickup,
moving asteroids, solar-wind disturbances, a colorful illustrated space backdrop,
synthesized audio, and four replayable contracts. The simulation always advances
while a mission is playing, including when no controls are held.

## Run locally

Requires **Node 22+**. There are no npm dependencies or installation steps.

```sh
npm run dev
```

Open **http://127.0.0.1:5173**. Set `PORT=8080` to select another port. Keep the
page focused: changing tabs or losing window focus automatically pauses for
human play. Resume with the button, P, or Escape.

For agent evaluation, open **http://127.0.0.1:5173/?evaluation=1**. This mode
keeps the clock running across focus/visibility changes and disables pause and
the in-flight manual. Held agent controls persist while the page is hidden.
Evaluation results do not change human personal records.

Foreground artwork is generated in Canvas: a detailed tug, rotating station,
illuminated cargo, textured asteroids, engine trails and pickup/delivery effects.
The locally bundled illustrated nebula backdrop was made with the built-in image
generation tool; its prompt is recorded in `assets/art-direction.md`. No live
image service is used. Fonts are included locally with their SIL Open Font
License notices. Audio is synthesized with Web Audio and starts muted;
use the speaker button or M to enable it. Personal records and mute preferences
are stored locally, with graceful fallback when browser storage is unavailable.

## Controls

| Input | Action |
| --- | --- |
| W / Up | Main thruster |
| S / Down | Weaker reverse thruster |
| A / Left, D / Right | Rotate |
| Space | Pick up the nearest cargo within 175 m, or drop the current cargo |
| P / Escape | Pause or resume |
| R | Restart the current contract |
| H | Flight manual |
| M | Mute or unmute |

Touch controls appear on narrow screens. Desktop keyboard play is the primary
experience. The manual explains interception, braking, and delivery.

**Flying:** rotating changes heading, not velocity. Coast to save fuel. S applies
weaker reverse thrust along the nose; face against your drift and use W to brake. Cargo drifts while free, but pickup immediately locks it
behind the ship. It shares the ship's position, heading, and velocity through
turns and collisions; it cannot swing, tug at the ship, or break loose. Ship
handling stays the same with a load. Dropped cargo inherits the ship's drift.

**Docking:** fly the ship or its carried container into the cyan home circle.
Unloading is automatic; you do not need to release cargo. First Recovery accepts
the ship at its full speed in a generous 165 m zone, as does Open Recovery. Later missions use a 145 m
zone and ask you to brake below 120 m/s. The station has a clear approach.

During flight, the interface shows compact cargo/time/fuel/hull readings,
speed and docking-speed readiness, a sector map including the actual recovery
field, and a short pickup-or-return prompt. Detailed help is available
on demand with H or the question-mark button.

## Contracts and scoring

| Contract | Cargo | Limit | Conditions |
| --- | --- | --- | --- |
| First Recovery | 2 | 4:00 | Fixed tutorial route; slowly drifting cargo; three distant asteroids; generous fuel |
| Open Recovery | 2 | 4:00 | Seeded nearby routes; the tutorial's generous docking, fuel and distant asteroids |
| Debris Field | 3 | 2:45 | More debris, tighter fuel budget |
| Solar Storm | 4 | 3:00 | Heavy cargo and periodic directional gusts |

Open Recovery chooses a new seed on each launch during human play. The result
screen includes the route seed. To replay a particular route, call
`window.orbitalSalvage.reset('practice', 42)`. Explicit seeds reproduce all initial
conditions. Evaluation mode uses a fixed default seed unless one is supplied.
First Recovery stays fixed across seeds for learning the controls.

Solar wind is announced five seconds before a seven-second gust. Future gusts
follow deterministically; they affect the tug, cargo, and asteroids. Unrecovered
cargo remains in the bounded sector rather than disappearing off the map.

Each delivery awards its cargo value adjusted for condition, plus time and fuel
bonuses. Recovering every container ends the mission immediately and adds a
completion bonus for remaining time, fuel, and hull integrity. Timeout retains
earned credits. Minor collisions cause knockback; harder impacts damage the
hull or cargo. Zero hull integrity ends the run. Empty fuel disables thrust but
does not stop drifting, steering, tractor use, or a possible coasting recovery.

## Structure

```text
src/simulation.js   Dependency-free deterministic physics, missions, scoring
src/renderer.js     Canvas scene, camera, trails, particles, minimap
src/art.js          Procedural ship, station, cargo, asteroid and docking artwork
src/main.js         Real-time loop, keyboard/touch input, HUD, menus, records
src/evaluation.js   Paused/latency-injection episodes and exact-state diagnostic pilot
src/audio.js        Optional synthesized sound effects
assets/            Illustrated space backdrop and its art direction
assets/fonts/      Local fonts and license notices
scripts/           Static development server and build copier
tests/             Simulation tests and real-browser smoke tests
```

Physics runs at a fixed **120 Hz**. Slow frames retain all elapsed simulation
time; only visual effects cap their frame delta. Input changes and observations
first catch up the simulation using the previous held controls, to within one
physics tick. Evaluation mode also runs a background timer. Browsers can throttle
or suspend background work; on the next timer, frame, observation or action, the
game catches up before accepting new controls. For reproducible training and
evaluation independent of browser scheduling, use the headless runner below.
Visual particles and sound do not affect the deterministic simulation. The
world is 3,000 × 2,200 units; sector edges softly reflect objects. The flight
model is arcade Newtonian motion, not gravitational orbital mechanics.

## Optional agent controller

There is no LLM integration or training framework. A small browser seam enables
later controllers without changing the simulation:

```js
window.orbitalSalvage.reset('first', 3181);
window.orbitalSalvage.observe();
window.orbitalSalvage.act({ turn: 0.3, thrust: 0.5 });
window.orbitalSalvage.act({ turn: 0, thrust: 0, tractor: true });
window.orbitalSalvage.pause();
window.orbitalSalvage.resume();
```

`turn` ranges from −1 to 1. `thrust` ranges from −0.55 to 1; negative values
apply weaker reverse thrust along the ship’s heading. Controls remain
held until the next `act()` call; omitted axes become zero. `tractor` is a
one-shot toggle on each call, so send it once per intended attach/release.
Keyboard or touch movement takes control back from the agent.

`observe()` returns copied ship/cargo/asteroid state, the docking field, clock,
score, screen, and gust state. This is privileged state access: benchmark it
separately from screenshot-only play. The controller has no clock-stepping
operation; the world runs in real time. For headless deterministic evaluation,
import `createGame`, `stepGame`, `toggleBeam`, `observe`, and `DT` directly from
`src/simulation.js`. The unit tests include a physical-control baseline.

## Small evaluation runner

Run the same seeded routes with paused inference and injected latency:

```sh
npm run evaluate -- --mission practice --seeds 1,2,3 --latency-ms 500 --interval-ms 120
```

This runs a **scripted exact-state diagnostic pilot**, not an LLM or human.
It uses discrete turn/thrust controls, the same seeds and observation fields
for each pair, and identical 120 Hz physics. The JSON report at
`test-results/evaluation.json` includes initial/final states, outcome, score,
observation/action wall timestamps, measured versus charged latency, previous
held controls, incoming actions, their application times and simulation events.
Use `--out path.json` to keep multiple reports. Injected latency is simulated
without waiting; the report labels it as latency injection rather than wall-clock
play. Paused mode excludes inference time but still advances each action's
`--interval-ms` hold duration.

For an asynchronous controller, import `runEpisode` from `src/evaluation.js`
and pass `decide: async observation => action`. With `mode: 'latency'` and no
`latencyMs`, measured inference time is charged to the previous held action
before applying the returned action. With `mode: 'paused'`, inference time is
free. Actions arriving after termination are logged and discarded. The runner
uses privileged state; compare pixel/keyboard agents in a separate lane. This
runner is intended for serial decisions; it does not implement concurrent
streaming observations or overlapping model requests.

### Human playtest before model comparisons

Human difficulty has not yet been established. Give several players one
unscored First Recovery attempt to learn the controls, then Open Recovery on
the same explicit seeds, viewport and keyboard interface. Record success,
delivered cargo, score, mission time, retries, pause/manual use, and feedback
about steering and docking. Use the result screen's seed to reproduce failures;
do not compare paused human attempts with uninterrupted live agents. Freeze the
evaluated seeds and settings before collecting comparative results.

## Verification

```sh
npm test
npm run build
```

The simulation suite covers determinism, ten seconds without input, thrust,
inertia, counter-thrust braking, fuel exhaustion, pickup range/release, rigid carrying
through turns/collisions/boundaries, docking, solar wind, scoring, all end states,
and completing First Recovery with coarse keyboard-like actions and no velocity
matching.

For real-browser checks, start the development server and a temporary Chrome
debugger in separate terminals. On macOS:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --no-first-run --remote-debugging-port=9223 \
  --user-data-dir=/tmp/orbital-salvage-test-profile
```

Then run:

```sh
npm run test:browser
```

On other platforms, launch the installed Chrome/Chromium binary with the same
flags. `GAME_URL` and `CHROME_DEBUG_URL` can override the test endpoints.
The smoke test opens and closes its own page, records screenshots under ignored
`test-results/`, checks ten real seconds of idle evolution, and uses a test-only
animation clock to verify a full recovery through the production loop and
controls. It also covers manual/mute, pause/restart, solar wind, timeout, and
desktop/tablet/phone layouts. It does not install a browser or any package.

## Static deployment

```sh
npm run build
npm run preview
```

`dist/` is the complete deployable game, including fonts. Asset paths are
relative, so it works beneath a GitHub Pages repository subpath. Serve it over
HTTP rather than opening `index.html` with `file://` (JavaScript modules require
a web origin).

- **GitHub Pages:** publish the contents of `dist/` as the Pages artifact.
- **Vercel:** set the project root to `orbital-salvage`, build command to
  `npm run build`, and output directory to `dist`. A configuration is included.
- **Any static host:** upload `dist/`; no server routes or environment variables
  are needed.

`.openai/hosting.json` records the optional private Sites deployment identity.
It is not required to run the game or deploy it to another host.
