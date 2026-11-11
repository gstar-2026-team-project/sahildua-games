import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { runEpisode } from '../src/evaluation.js';

const { values } = parseArgs({ options: {
  mission: { type: 'string', default: 'practice' },
  seeds: { type: 'string', default: '1,2,3' },
  'latency-ms': { type: 'string', default: '500' },
  'interval-ms': { type: 'string', default: '120' },
  out: { type: 'string', default: 'test-results/evaluation.json' },
} });
const seeds = values.seeds.split(',').map(s => s.trim());
if (seeds.some(s => !s || !Number.isInteger(Number(s)))) throw new Error('--seeds must be comma-separated integers');
const runs = [];
for (const seed of seeds.map(Number)) {
  for (const mode of ['paused', 'latency']) {
    const run = await runEpisode({ mission: values.mission, seed, mode,
      latencyMs: Number(values['latency-ms']), intervalMs: Number(values['interval-ms']) });
    runs.push(run);
    console.log(`${run.clock.padEnd(17)} seed=${seed} ${run.status.padEnd(8)} cargo=${run.delivered}/${run.initial.cargo.length} time=${run.elapsed.toFixed(2)}s score=${run.score}`);
  }
}
const output = resolve(values.out);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ policy: 'statePilot (scripted diagnostic, not an LLM result)', runs }, null, 2));
console.log(`Decision timestamps, held actions and outcomes: ${output}`);
