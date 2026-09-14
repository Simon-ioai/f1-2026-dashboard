import { describe, expect, it } from 'vitest';
import {
  canStillWin,
  earliestClinch,
  firstClinchedRound,
  firstEliminationRound,
  hasClinched,
  maxPointsAvailable,
  weekendMax,
  type DriverPoints,
  type RemainingRace,
  type RoundPoints,
} from './clinch';

const race = (round: number, hasSprint = false): RemainingRace => ({
  round,
  name: `Race ${round}`,
  date: `2026-10-${String(round).padStart(2, '0')}`,
  hasSprint,
});

const d = (driverId: string, points: number): DriverPoints => ({
  driverId,
  name: driverId,
  points,
});

describe('maxPointsAvailable', () => {
  it('counts 25 per race plus 8 per sprint', () => {
    expect(maxPointsAvailable([race(1), race(2)])).toBe(50);
    expect(maxPointsAvailable([race(1, true), race(2)])).toBe(58);
    expect(maxPointsAvailable([])).toBe(0);
    expect(weekendMax(race(1, true))).toBe(33);
  });
});

describe('hasClinched', () => {
  it('clinched only when every rival falls strictly short even maxing out', () => {
    // 2 races left (50 pts available). Lead of 51 clinches, 50 does not (tie
    // goes to countback, which we treat conservatively as not clinched).
    expect(hasClinched(d('a', 300), [d('b', 249)], [race(1), race(2)])).toBe(true);
    expect(hasClinched(d('a', 300), [d('b', 250)], [race(1), race(2)])).toBe(false);
  });

  it('with no races left the higher score has clinched', () => {
    expect(hasClinched(d('a', 300), [d('b', 299)], [])).toBe(true);
    expect(hasClinched(d('a', 300), [d('b', 300)], [])).toBe(false);
  });
});

describe('canStillWin', () => {
  it('alive while max remaining can reach every rival; ties count as alive', () => {
    // 58 available (one sprint weekend + one race): 112 + 58 = 170
    const remaining = [race(1, true), race(2)];
    expect(canStillWin(d('ver', 112), [d('ant', 169)], remaining)).toBe(true);
    // exact tie possible -> countback territory -> conservatively alive
    expect(canStillWin(d('ver', 112), [d('ant', 170)], remaining)).toBe(true);
    expect(canStillWin(d('ver', 112), [d('ant', 171)], remaining)).toBe(false);
  });
});

describe('earliestClinch', () => {
  it('finds the first round where max-self vs zero-rivals settles it', () => {
    // Leader 100, rival 40. Races 1..3, no sprints (25 each).
    // After R1: leader 125, rival max 40+50=90 -> 90 < 125, clinched at R1.
    const result = earliestClinch(d('a', 100), [d('b', 40)], [race(1), race(2), race(3)]);
    expect(result.earliestRound).toBe(1);
    expect(result.chiefRivalId).toBe('b');
  });

  it('needs a later round when the rival is closer', () => {
    // Leader 100, rival 90, three plain races.
    // R1: 125 vs 90+50=140 -> no. R2: 150 vs 90+25=115 -> yes.
    const result = earliestClinch(d('a', 100), [d('b', 90)], [race(1), race(2), race(3)]);
    expect(result.earliestRound).toBe(2);
    // gap needed: available after R2 (25) minus current lead (10) plus 1 = 16
    expect(result.gapNeeded).toBe(16);
  });

  it('sprints shift the arithmetic', () => {
    // Same but race 3 is a sprint weekend: after R2 there are 33 pts left.
    // R2: 150 vs 90+33=123 -> clinched at R2, gap = 33-10+1 = 24.
    const result = earliestClinch(d('a', 100), [d('b', 90)], [race(1), race(2), race(3, true)]);
    expect(result.earliestRound).toBe(2);
    expect(result.gapNeeded).toBe(24);
  });

  it('returns null when the title cannot be clinched this season', () => {
    const result = earliestClinch(d('b', 90), [d('a', 100)], [race(1)]);
    // b maxes to 115 but a could also score; clinching means STRICT cover:
    // after R1 nothing remains, 100 < 115 -> actually clinched if a scores 0.
    expect(result.earliestRound).toBe(1);
    const never = earliestClinch(d('c', 10), [d('a', 100)], [race(1), race(2)]);
    // c maxes to 60, a already has 100 -> impossible.
    expect(never.earliestRound).toBeNull();
    expect(never.gapNeeded).toBeNull();
  });

  it('replays elimination and clinch rounds from per-round points', () => {
    // 4-race season, no sprints, 25 max per round.
    const schedule = [race(1), race(2), race(3), race(4)];
    const rounds: RoundPoints[] = [
      { round: 1, pointsByDriver: { a: 25, b: 18, c: 0 } },
      { round: 2, pointsByDriver: { a: 25, b: 18, c: 0 } },
      { round: 3, pointsByDriver: { a: 25, b: 18, c: 0 } },
    ];
    // After R2: c has 0, a has 50, 50 points remain -> c max 50 = 50, tie
    // possible, conservatively alive. After R3: c max 0+25=25 < a's 75 -> out.
    // (After R2 c could at best tie; strict rule keeps them alive.)
    expect(firstEliminationRound('c', rounds, schedule)).toBe(3);
    // b after R3: 54 + 25 = 79 > a's 75 -> still alive.
    expect(firstEliminationRound('b', rounds, schedule)).toBeNull();
    // a after R3: b's max 54+25=79 >= 75 -> not sealed yet.
    expect(firstClinchedRound('a', rounds, schedule)).toBeNull();
    // One more dominant round seals it: a=100, b max 72+0... schedule has 4
    // rounds; after R4 nothing remains and 100 > 72.
    const sealed = [...rounds, { round: 4, pointsByDriver: { a: 25, b: 18, c: 0 } }];
    expect(firstClinchedRound('a', sealed, schedule)).toBe(4);
    // Sprints count toward what remained: add a sprint to round 4 and after
    // R3 there are 33 left, c's max 0+33 still < 75 -> elimination unchanged.
    const sprintSchedule = [race(1), race(2), race(3), race(4, true)];
    expect(firstEliminationRound('c', rounds, sprintSchedule)).toBe(3);
  });

  it('uses the strongest rival, not the closest by points alone', () => {
    const result = earliestClinch(
      d('a', 200),
      [d('b', 150), d('c', 149)],
      [race(1), race(2)],
    );
    expect(result.chiefRivalId).toBe('b');
  });
});
