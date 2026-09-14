// Form index: rolling 3-race averages of weekend points (race + sprint) and
// qualifying position, per driver — trend, independent of the championship
// gap. A weekend is flagged as a form break when the rolling points average
// sits more than one standard deviation (of the driver's own single-weekend
// points) away from their season baseline; flags start at round 3, once the
// window is actually three races deep.

export const FORM_WINDOW = 3;

export interface FormRoundInput {
  round: number;
  /** Points scored that weekend: race + sprint. */
  points: number;
  /** Final qualifying classification, null if no representative session. */
  qualiPos: number | null;
}

export interface FormPoint {
  round: number;
  points: number;
  qualiPos: number | null;
  /** Rolling mean over the last up-to-3 weekends (including this one). */
  pointsAvg: number;
  qualiAvg: number | null;
  /** True when the rolling points average broke from the season baseline. */
  diverged: boolean;
}

export interface FormSeries {
  baselinePoints: number;
  baselineQuali: number | null;
  /** Population std-dev of single-weekend points. */
  pointsSd: number;
  points: FormPoint[];
}

export function mean(values: number[]): number {
  if (values.length === 0) throw new Error('mean of empty array');
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function populationSd(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length);
}

/** Rolling mean of the last `window` non-null values ending at each index. */
export function rollingMean(values: (number | null)[], window: number): (number | null)[] {
  return values.map((_, i) => {
    const slice = values
      .slice(Math.max(0, i - window + 1), i + 1)
      .filter((v): v is number => v !== null);
    return slice.length > 0 ? mean(slice) : null;
  });
}

export function buildFormSeries(rounds: FormRoundInput[]): FormSeries {
  const sorted = [...rounds].sort((a, b) => a.round - b.round);
  const pointValues = sorted.map((r) => r.points);
  const qualiValues = sorted.map((r) => r.qualiPos);
  const baselinePoints = pointValues.length > 0 ? mean(pointValues) : 0;
  const knownQuali = qualiValues.filter((q): q is number => q !== null);
  const baselineQuali = knownQuali.length > 0 ? mean(knownQuali) : null;
  const pointsSd = populationSd(pointValues);

  const pointsRolling = rollingMean(pointValues, FORM_WINDOW);
  const qualiRolling = rollingMean(qualiValues, FORM_WINDOW);

  return {
    baselinePoints,
    baselineQuali,
    pointsSd,
    points: sorted.map((r, i) => ({
      round: r.round,
      points: r.points,
      qualiPos: r.qualiPos,
      pointsAvg: pointsRolling[i] ?? 0,
      qualiAvg: qualiRolling[i],
      diverged:
        i >= FORM_WINDOW - 1 &&
        pointsSd > 0 &&
        Math.abs((pointsRolling[i] ?? 0) - baselinePoints) > pointsSd,
    })),
  };
}
