import { describe, expect, it } from 'vitest';
import { buildFormSeries, mean, populationSd, rollingMean, type FormRoundInput } from './form';

const round = (n: number, points: number, qualiPos: number | null = n): FormRoundInput => ({
  round: n,
  points,
  qualiPos,
});

describe('rollingMean', () => {
  it('averages the trailing window, shorter at the start', () => {
    expect(rollingMean([10, 20, 30, 40], 3)).toEqual([10, 15, 20, 30]);
  });
  it('skips nulls inside the window and yields null when the window is empty', () => {
    expect(rollingMean([null, 10, null, 20], 3)).toEqual([null, 10, 10, 15]);
    expect(rollingMean([null, null], 3)).toEqual([null, null]);
  });
});

describe('populationSd', () => {
  it('computes population standard deviation', () => {
    expect(populationSd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 10);
    expect(populationSd([5, 5, 5])).toBe(0);
  });
});

describe('buildFormSeries', () => {
  it('computes baselines, rolling averages, and quali handling', () => {
    const series = buildFormSeries([
      round(1, 25, 1),
      round(2, 18, 2),
      round(3, 25, null), // wet chaos: no representative quali
      round(4, 0, 4),
    ]);
    expect(series.baselinePoints).toBeCloseTo(17, 10);
    // quali baseline ignores the null session
    expect(series.baselineQuali).toBeCloseTo((1 + 2 + 4) / 3, 10);
    expect(series.points[3].pointsAvg).toBeCloseTo((18 + 25 + 0) / 3, 10);
    // quali rolling at round 3 averages the two known sessions in window
    expect(series.points[2].qualiAvg).toBeCloseTo(1.5, 10);
  });

  it('flags a form break only from round 3 and only beyond one sd', () => {
    // Steady 10s, then a collapse to zero.
    const series = buildFormSeries([
      round(1, 10),
      round(2, 10),
      round(3, 10),
      round(4, 10),
      round(5, 0),
      round(6, 0),
      round(7, 0),
    ]);
    // baseline 40/7 ≈ 5.71, sd ≈ 4.88; rolling at R7 = 0 -> |0-5.71| > 4.88 -> flag
    expect(series.points[6].diverged).toBe(true);
    // rolling at R4 = 10 -> |10-5.71| = 4.29 < sd -> no flag
    expect(series.points[3].diverged).toBe(false);
    // early rounds never flag, whatever the numbers
    expect(series.points[0].diverged).toBe(false);
    expect(series.points[1].diverged).toBe(false);
  });

  it('a perfectly consistent season never flags (sd = 0)', () => {
    const series = buildFormSeries([round(1, 18), round(2, 18), round(3, 18)]);
    expect(series.points.every((p) => !p.diverged)).toBe(true);
  });

  it('mean throws on empty input', () => {
    expect(() => mean([])).toThrow();
  });
});
