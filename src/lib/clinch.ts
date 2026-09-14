// Clinch / elimination arithmetic from current standings and the remaining
// calendar, Sprints included. 2026 scoring: race 25-18-15-12-10-8-6-4-2-1,
// sprint 8-7-6-5-4-3-2-1, no fastest-lap point.
//
// Conservative tie rule: equal points are settled by a wins countback, which
// this model does not simulate — so a driver only counts as clinched or a
// rival as eliminated when they are STRICTLY ahead / behind in every scenario.

export const MAX_RACE_POINTS = 25;
export const MAX_SPRINT_POINTS = 8;

export interface RemainingRace {
  round: number;
  name: string;
  date: string;
  hasSprint: boolean;
}

export interface DriverPoints {
  driverId: string;
  name: string;
  points: number;
}

/** Maximum points still available across the given races (race + sprint). */
export function maxPointsAvailable(races: RemainingRace[]): number {
  return races.reduce(
    (sum, r) => sum + MAX_RACE_POINTS + (r.hasSprint ? MAX_SPRINT_POINTS : 0),
    0,
  );
}

/** Maximum points available in one weekend. */
export function weekendMax(race: RemainingRace): number {
  return MAX_RACE_POINTS + (race.hasSprint ? MAX_SPRINT_POINTS : 0);
}

/**
 * Is `driver` already champion regardless of every remaining result?
 * True when every rival, taking maximum points in all remaining races,
 * still ends strictly below the driver's current total.
 */
export function hasClinched(
  driver: DriverPoints,
  rivals: DriverPoints[],
  remaining: RemainingRace[],
): boolean {
  const available = maxPointsAvailable(remaining);
  return rivals.every((rival) => rival.points + available < driver.points);
}

/**
 * Can `driver` still mathematically win the title? Conservative on ties, like
 * every function here: reaching a points tie counts as alive, because the
 * countback that would settle it is not modelled.
 */
export function canStillWin(
  driver: DriverPoints,
  rivals: DriverPoints[],
  remaining: RemainingRace[],
): boolean {
  const available = maxPointsAvailable(remaining);
  // Best case: driver maxes everything, every rival scores nothing more.
  return rivals.every((rival) => driver.points + available >= rival.points);
}

export interface RoundPoints {
  round: number;
  /** Combined race + sprint points scored by each driver in this round. */
  pointsByDriver: Record<string, number>;
}

/**
 * Replay the season round by round and return the round after which the
 * driver could no longer win the title (some rival's points already exceeded
 * the driver's maximum possible total), or null if still alive.
 * `schedule` is the FULL season calendar, used for what remained after each round.
 */
export function firstEliminationRound(
  driverId: string,
  completedRounds: RoundPoints[],
  schedule: RemainingRace[],
): number | null {
  const cumulative = new Map<string, number>();
  const sorted = [...completedRounds].sort((a, b) => a.round - b.round);
  for (const rp of sorted) {
    for (const [id, pts] of Object.entries(rp.pointsByDriver)) {
      cumulative.set(id, (cumulative.get(id) ?? 0) + pts);
    }
    const available = maxPointsAvailable(schedule.filter((r) => r.round > rp.round));
    const mine = cumulative.get(driverId) ?? 0;
    for (const [id, pts] of cumulative) {
      if (id !== driverId && mine + available < pts) return rp.round;
    }
  }
  return null;
}

/**
 * Replay the season and return the round after which the driver was already
 * champion (every rival's maximum possible total strictly below the driver's
 * points), or null if the title is not yet sealed.
 */
export function firstClinchedRound(
  driverId: string,
  completedRounds: RoundPoints[],
  schedule: RemainingRace[],
): number | null {
  const cumulative = new Map<string, number>();
  const sorted = [...completedRounds].sort((a, b) => a.round - b.round);
  for (const rp of sorted) {
    for (const [id, pts] of Object.entries(rp.pointsByDriver)) {
      cumulative.set(id, (cumulative.get(id) ?? 0) + pts);
    }
    const available = maxPointsAvailable(schedule.filter((r) => r.round > rp.round));
    const mine = cumulative.get(driverId) ?? 0;
    let sealed = true;
    for (const [id, pts] of cumulative) {
      if (id !== driverId && pts + available >= mine) {
        sealed = false;
        break;
      }
    }
    if (sealed) return rp.round;
  }
  return null;
}

export interface ClinchScenario {
  driverId: string;
  /** Round at which the driver could clinch at the earliest, or null if impossible this season. */
  earliestRound: number | null;
  earliestRaceName: string | null;
  /**
   * Points by which the driver must outscore their closest rival across the
   * weekends up to AND including the clinch race, in the best case.
   */
  gapNeeded: number | null;
  chiefRivalId: string | null;
}

/**
 * Earliest race at which `driver` can mathematically clinch: assume the driver
 * maxes every weekend up to round R and every rival scores zero; the title is
 * clinched after R when each rival's current points plus everything still
 * available after R is strictly below the driver's total.
 */
export function earliestClinch(
  driver: DriverPoints,
  rivals: DriverPoints[],
  remaining: RemainingRace[],
): ClinchScenario {
  const sorted = [...remaining].sort((a, b) => a.round - b.round);
  let gained = 0;
  for (let i = 0; i < sorted.length; i++) {
    gained += weekendMax(sorted[i]);
    const after = sorted.slice(i + 1);
    const availableAfter = maxPointsAvailable(after);
    const projected: DriverPoints = { ...driver, points: driver.points + gained };
    if (rivals.every((r) => r.points + availableAfter < projected.points)) {
      // Chief rival = the one hardest to shake off at this round.
      const chief = rivals.reduce((a, b) =>
        b.points + availableAfter > a.points + availableAfter ? b : a,
      );
      // In the best case the driver needs to beat the chief rival's potential:
      // outscore them by enough that current gap + margin > what remains after R.
      const currentLead = driver.points - chief.points;
      const gapNeeded = availableAfter - currentLead + 1;
      return {
        driverId: driver.driverId,
        earliestRound: sorted[i].round,
        earliestRaceName: sorted[i].name,
        gapNeeded: Math.max(gapNeeded, 0),
        chiefRivalId: chief.driverId,
      };
    }
  }
  return {
    driverId: driver.driverId,
    earliestRound: null,
    earliestRaceName: null,
    gapNeeded: null,
    chiefRivalId: null,
  };
}
