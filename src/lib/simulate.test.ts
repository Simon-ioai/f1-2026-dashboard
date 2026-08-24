import { describe, expect, it } from 'vitest';
import {
  buildModels,
  classifyResult,
  histogram,
  mulberry32,
  samplePace,
  simulate,
  type SeasonRaceInput,
  type StandingInput,
} from './simulate';

describe('mulberry32', () => {
  it('is deterministic for a given seed and in [0,1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(mulberry32(43)()).not.toBe(seqA[0]);
  });
});

describe('classifyResult', () => {
  it('parses classified positions and flags retirements', () => {
    expect(classifyResult('1')).toBe(1);
    expect(classifyResult('15')).toBe(15);
    expect(classifyResult('R')).toBe('DNF');
    expect(classifyResult('D')).toBe('DNF');
    expect(classifyResult('W')).toBe('DNF');
  });
});

const standings = (rows: [string, number, number][]): StandingInput[] =>
  rows.map(([driverId, points, wins]) => ({
    driverId,
    name: driverId,
    team: 'T',
    code: null,
    points,
    wins,
  }));

describe('buildModels', () => {
  const races: SeasonRaceInput[] = [
    { round: 1, results: [{ driverId: 'a', positionText: '1' }, { driverId: 'b', positionText: 'R' }] },
    { round: 2, results: [{ driverId: 'a', positionText: '2' }, { driverId: 'b', positionText: '1' }] },
  ];

  it('derives the DNF rate from actual retirements with recency weighting', () => {
    // Window 1: round 2 gets weight 2, round 1 weight 1.
    const models = buildModels(races, standings([['a', 40, 1], ['b', 25, 1]]), 1, 2);
    const b = models.find((m) => m.driverId === 'b')!;
    // b: DNF in round 1 (weight 1), finished round 2 (weight 2) -> 1/3
    expect(b.dnfRate).toBeCloseTo(1 / 3, 10);
    const a = models.find((m) => m.driverId === 'a')!;
    expect(a.dnfRate).toBe(0);
    // a's samples: pos 1 (weight 1), pos 2 (weight 2)
    expect(a.finishSamples).toEqual([
      { pos: 1, weight: 1 },
      { pos: 2, weight: 2 },
    ]);
  });

  it('sends a driver with zero finishes to the back of the sampled field', () => {
    const models = buildModels(
      [{ round: 1, results: [{ driverId: 'x', positionText: 'R' }] }],
      standings([['x', 0, 0]]),
    );
    const pace = samplePace(models[0], mulberry32(1));
    expect(pace).toBeGreaterThanOrEqual(20);
  });
});

describe('simulate', () => {
  const oneRace = [{ round: 13, hasSprint: false }];

  it('a dominant leader with no DNF risk wins virtually always', () => {
    const races: SeasonRaceInput[] = [
      { round: 1, results: [{ driverId: 'lead', positionText: '1' }, { driverId: 'rival', positionText: '2' }] },
    ];
    const models = buildModels(races, standings([['lead', 100, 1], ['rival', 20, 0]]));
    const { result } = simulate(models, oneRace, { iterations: 2000, seed: 7 });
    const lead = result.drivers.find((d) => d.driverId === 'lead')!;
    expect(lead.titleProb).toBe(1); // 80-point lead, 25 available
    expect(lead.p5).toBeGreaterThanOrEqual(100);
  });

  it('two statistically identical drivers split the title about evenly', () => {
    // Both always finish; each has beaten the other once from identical samples.
    const races: SeasonRaceInput[] = [
      { round: 1, results: [{ driverId: 'a', positionText: '1' }, { driverId: 'b', positionText: '2' }] },
      { round: 2, results: [{ driverId: 'a', positionText: '2' }, { driverId: 'b', positionText: '1' }] },
    ];
    const models = buildModels(races, standings([['a', 43, 1], ['b', 43, 1]]), 5, 1);
    const { result } = simulate(models, [{ round: 13, hasSprint: true }], {
      iterations: 6000,
      seed: 11,
    });
    const a = result.drivers.find((d) => d.driverId === 'a')!;
    expect(a.titleProb).toBeGreaterThan(0.44);
    expect(a.titleProb).toBeLessThan(0.56);
  });

  it('title probabilities sum to 1 and results are seed-reproducible', () => {
    const races: SeasonRaceInput[] = [
      {
        round: 1,
        results: [
          { driverId: 'a', positionText: '1' },
          { driverId: 'b', positionText: '2' },
          { driverId: 'c', positionText: 'R' },
        ],
      },
    ];
    const models = buildModels(races, standings([['a', 25, 1], ['b', 18, 0], ['c', 0, 0]]));
    const run1 = simulate(models, oneRace, { iterations: 1000, seed: 3 });
    const run2 = simulate(models, oneRace, { iterations: 1000, seed: 3 });
    expect(run1.result.drivers).toEqual(run2.result.drivers);
    const total = run1.result.drivers.reduce((s, d) => s + d.titleProb, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe('histogram', () => {
  it('bins values with clamping at the edges', () => {
    const h = histogram([100, 104, 105, 119, 121], 10, 100, 121);
    expect(h.binStart).toBe(100);
    // bins: [100,110) [110,120) [120,130)
    expect(h.counts).toEqual([3, 1, 1]);
    expect(h.counts.reduce((a, b) => a + b, 0)).toBe(5);
  });
});
