// Run the Monte Carlo title simulation from committed season data and write
// data/derived/simulations.json. Seeded from the standings round, so the file
// only changes when the underlying results change. Runs in the Monday rebuild
// job after a race weekend (odds snapshots don't affect it).

import { buildModels, histogram, simulate } from '../src/lib/simulate.js';
import { TRACKED_IDS } from '../src/lib/drivers.js';
import { readJson, writeJson } from './lib/io.js';
import { loadMeta, saveMeta } from './update-results.js';

const ITERATIONS = 20_000;
const RECENT_WINDOW = 5;
const RECENT_WEIGHT = 2;

interface SeasonFile {
  races: { round: number; results: { driverId: string; positionText: string }[] }[];
}
interface ScheduleFile {
  races: { round: number; name: string; date: string; hasSprint: boolean }[];
}
interface StandingsFile {
  round: number;
  standings: {
    driverId: string;
    name: string;
    team: string;
    code: string | null;
    points: number;
    wins: number;
  }[];
}

const season = readJson<SeasonFile>('data/results/season.json');
const schedule = readJson<ScheduleFile>('data/results/schedule.json');
const standings = readJson<StandingsFile>('data/results/standings.json');
if (!season || !schedule || !standings) {
  throw new Error('Season data missing — run `npm run backfill` first.');
}

const completedRounds = new Set(
  season.races.filter((r) => r.results.length > 0).map((r) => r.round),
);
const remaining = schedule.races
  .filter((r) => !completedRounds.has(r.round))
  .map((r) => ({ round: r.round, hasSprint: r.hasSprint }));

const models = buildModels(season.races, standings.standings, RECENT_WINDOW, RECENT_WEIGHT);
console.log(
  `Simulating ${remaining.length} remaining races (${remaining.filter((r) => r.hasSprint).length} sprints) ` +
    `x ${ITERATIONS} iterations for ${models.length} drivers…`,
);

const seed = 2026_00 + standings.round; // reproducible per data state
const { result, finalPoints } = simulate(models, remaining, { iterations: ITERATIONS, seed });

// Density histograms for the tracked drivers over a common axis.
let min = Infinity;
let max = -Infinity;
for (const id of TRACKED_IDS) {
  for (const v of finalPoints.get(id) ?? []) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
}
const BIN_WIDTH = 10;
const histograms: Record<string, { binStart: number; binWidth: number; counts: number[] }> = {};
for (const id of TRACKED_IDS) {
  const values = finalPoints.get(id);
  if (values) histograms[id] = histogram(values, BIN_WIDTH, min, max);
}

const top = [...result.drivers].sort((a, b) => b.titleProb - a.titleProb).slice(0, 6);
for (const d of top) {
  console.log(
    `  ${(d.code ?? d.driverId).padEnd(4)} ${(d.titleProb * 100).toFixed(1).padStart(5)}%  ` +
      `points p5-p95: ${d.p5}-${d.p95}  (DNF rate ${(d.dnfRate * 100).toFixed(0)}%)`,
  );
}

writeJson('data/derived/simulations.json', {
  generated_at: new Date().toISOString(),
  method: {
    iterations: ITERATIONS,
    seed,
    recent_window: RECENT_WINDOW,
    recent_weight: RECENT_WEIGHT,
    based_on_rounds: standings.round,
    remaining_races: remaining.length,
    remaining_sprints: remaining.filter((r) => r.hasSprint).length,
    notes:
      'Empirical finishing distributions from this season only; DNF rates from actual retirements; ' +
      'sprints ranked from the same distributions without a DNF draw; title ties broken by season wins then randomly.',
  },
  drivers: result.drivers,
  histograms,
});

const meta = loadMeta();
meta.derived_updated_at = new Date().toISOString();
saveMeta(meta);
