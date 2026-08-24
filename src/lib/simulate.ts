// Monte Carlo title simulation. A deliberately simple, honest model:
//
// - Each driver's race pace is an empirical distribution of their ACTUAL
//   finishing positions this season, with the last `recentWindow` races
//   weighted `recentWeight`x (recent form matters more).
// - DNF probability per driver comes from their real retirements this season
//   (same recency weighting), never from an assumed constant.
// - Per simulated race, every non-DNF driver samples a "pace number" from
//   their distribution (with jitter to break ties) and the field is ranked by
//   it; points follow the ranking. Sprints rank the same way for sprint
//   points (no DNF draw — sprints are short; a simplification, stated in the UI).
// - Ties for the title are broken by season wins so far, then randomly —
//   a simplification of the full FIA countback.
//
// The RNG is seeded so the same inputs always produce the same output file.

export const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];

/** Deterministic 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Numeric classified position, or 'DNF' for R/D/W/N/E classifications. */
export function classifyResult(positionText: string): number | 'DNF' {
  const pos = Number(positionText);
  return Number.isFinite(pos) && pos >= 1 ? pos : 'DNF';
}

export interface SeasonRaceInput {
  round: number;
  results: { driverId: string; positionText: string }[];
}

export interface StandingInput {
  driverId: string;
  name: string;
  team: string;
  code: string | null;
  points: number;
  wins: number;
}

export interface DriverModel {
  driverId: string;
  name: string;
  team: string;
  code: string | null;
  currentPoints: number;
  wins: number;
  dnfRate: number;
  /** Weighted empirical finishing positions (finished races only). */
  finishSamples: { pos: number; weight: number }[];
  totalFinishWeight: number;
}

/**
 * Build per-driver empirical models from real season results.
 * Races within `recentWindow` of the latest round get `recentWeight`x weight.
 */
export function buildModels(
  races: SeasonRaceInput[],
  standings: StandingInput[],
  recentWindow = 5,
  recentWeight = 2,
): DriverModel[] {
  const completed = races.filter((r) => r.results.length > 0);
  const lastRound = Math.max(0, ...completed.map((r) => r.round));
  const models: DriverModel[] = [];
  for (const s of standings) {
    const finishSamples: { pos: number; weight: number }[] = [];
    let dnfWeight = 0;
    let raceWeight = 0;
    for (const race of completed) {
      const entry = race.results.find((r) => r.driverId === s.driverId);
      if (!entry) continue; // did not enter this race
      const weight = race.round > lastRound - recentWindow ? recentWeight : 1;
      raceWeight += weight;
      const outcome = classifyResult(entry.positionText);
      if (outcome === 'DNF') dnfWeight += weight;
      else finishSamples.push({ pos: outcome, weight });
    }
    models.push({
      driverId: s.driverId,
      name: s.name,
      team: s.team,
      code: s.code,
      currentPoints: s.points,
      wins: s.wins,
      dnfRate: raceWeight > 0 ? dnfWeight / raceWeight : 0,
      finishSamples,
      totalFinishWeight: finishSamples.reduce((sum, f) => sum + f.weight, 0),
    });
  }
  return models;
}

/** Weighted draw from the driver's finishing distribution, with tie-break jitter. */
export function samplePace(model: DriverModel, rng: () => number): number {
  if (model.finishSamples.length === 0) return 20 + rng(); // never finished: back of field
  let target = rng() * model.totalFinishWeight;
  for (const sample of model.finishSamples) {
    target -= sample.weight;
    if (target <= 0) return sample.pos + (rng() - 0.5);
  }
  return model.finishSamples[model.finishSamples.length - 1].pos + (rng() - 0.5);
}

export interface RemainingRaceInput {
  round: number;
  hasSprint: boolean;
}

export interface SimulationResult {
  iterations: number;
  seed: number;
  drivers: {
    driverId: string;
    name: string;
    team: string;
    code: string | null;
    currentPoints: number;
    dnfRate: number;
    titleProb: number;
    mean: number;
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  }[];
}

function percentile(sorted: number[], q: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[idx];
}

export function simulate(
  models: DriverModel[],
  remaining: RemainingRaceInput[],
  opts: { iterations: number; seed: number },
): { result: SimulationResult; finalPoints: Map<string, number[]> } {
  const rng = mulberry32(opts.seed);
  const n = models.length;
  const titleCount = new Array<number>(n).fill(0);
  const finalPoints = new Map<string, number[]>(models.map((m) => [m.driverId, []]));

  for (let it = 0; it < opts.iterations; it++) {
    const totals = models.map((m) => m.currentPoints);
    for (const race of remaining) {
      // Grand Prix: DNF draw, then rank surviving cars by sampled pace.
      const order: { i: number; pace: number }[] = [];
      for (let i = 0; i < n; i++) {
        if (rng() < models[i].dnfRate) continue;
        order.push({ i, pace: samplePace(models[i], rng) });
      }
      order.sort((a, b) => a.pace - b.pace);
      for (let rank = 0; rank < order.length && rank < RACE_POINTS.length; rank++) {
        totals[order[rank].i] += RACE_POINTS[rank];
      }
      if (race.hasSprint) {
        const sprintOrder = models.map((m, i) => ({ i, pace: samplePace(m, rng) }));
        sprintOrder.sort((a, b) => a.pace - b.pace);
        const sprintScorers = Math.min(SPRINT_POINTS.length, sprintOrder.length);
        for (let rank = 0; rank < sprintScorers; rank++) {
          totals[sprintOrder[rank].i] += SPRINT_POINTS[rank];
        }
      }
    }
    // Champion: highest points; ties broken by current season wins, then randomly.
    let best = 0;
    for (let i = 1; i < n; i++) {
      if (
        totals[i] > totals[best] ||
        (totals[i] === totals[best] &&
          (models[i].wins > models[best].wins ||
            (models[i].wins === models[best].wins && rng() < 0.5)))
      ) {
        best = i;
      }
    }
    titleCount[best]++;
    for (let i = 0; i < n; i++) finalPoints.get(models[i].driverId)!.push(totals[i]);
  }

  const drivers = models.map((m, i) => {
    const sorted = [...finalPoints.get(m.driverId)!].sort((a, b) => a - b);
    return {
      driverId: m.driverId,
      name: m.name,
      team: m.team,
      code: m.code,
      currentPoints: m.currentPoints,
      dnfRate: m.dnfRate,
      titleProb: titleCount[i] / opts.iterations,
      mean: sorted.reduce((s, v) => s + v, 0) / sorted.length,
      p5: percentile(sorted, 0.05),
      p25: percentile(sorted, 0.25),
      p50: percentile(sorted, 0.5),
      p75: percentile(sorted, 0.75),
      p95: percentile(sorted, 0.95),
    };
  });

  return {
    result: { iterations: opts.iterations, seed: opts.seed, drivers },
    finalPoints,
  };
}

/** Fixed-width histogram of an array of point totals. */
export function histogram(
  values: number[],
  binWidth: number,
  min: number,
  max: number,
): { binStart: number; binWidth: number; counts: number[] } {
  const start = Math.floor(min / binWidth) * binWidth;
  const bins = Math.max(1, Math.ceil((max - start + 1) / binWidth));
  const counts = new Array<number>(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - start) / binWidth)));
    counts[idx]++;
  }
  return { binStart: start, binWidth, counts };
}
