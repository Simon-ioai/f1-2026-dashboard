import { describe, expect, it } from 'vitest';
import {
  deepestCommonGap,
  parseLapMs,
  summarize,
  teamRoundVerdicts,
  type H2HRaceInput,
  type QualiRow,
} from './h2h';

describe('parseLapMs', () => {
  it('parses minute and sub-minute laps to milliseconds', () => {
    expect(parseLapMs('1:31.824')).toBe(91824);
    expect(parseLapMs('1:11.163')).toBe(71163);
    expect(parseLapMs('59.876')).toBe(59876);
    expect(parseLapMs('2:05.5')).toBe(125500); // short fractions pad out
  });
  it('rejects missing or malformed times', () => {
    expect(parseLapMs(null)).toBeNull();
    expect(parseLapMs('')).toBeNull();
    expect(parseLapMs('DNF')).toBeNull();
  });
});

const q = (driverId: string, position: number, q1: string | null, q2: string | null, q3: string | null): QualiRow =>
  ({ driverId, position, q1, q2, q3 });

describe('deepestCommonGap', () => {
  it('compares the deepest session both drivers have a time in', () => {
    const a = q('a', 1, '1:12.0', '1:11.5', '1:11.163');
    const b = q('b', 2, '1:12.1', '1:11.7', '1:11.263');
    expect(deepestCommonGap(a, b)).toEqual({ gapMs: -100, session: 'Q3' });
  });

  it('falls back when one car has no representative lap in the deeper session', () => {
    // b crashed before setting a Q3 time: compare Q2 instead.
    const a = q('a', 1, '1:12.0', '1:11.5', '1:11.1');
    const b = q('b', 10, '1:12.2', '1:11.9', null);
    expect(deepestCommonGap(a, b)).toEqual({ gapMs: -400, session: 'Q2' });
  });

  it('returns null when no session is shared', () => {
    const a = q('a', 1, '1:12.0', null, null);
    const b = q('b', 20, null, null, null);
    expect(deepestCommonGap(a, b)).toBeNull();
  });
});

describe('teamRoundVerdicts + summarize', () => {
  const race = (
    round: number,
    partnerId: string,
    opts: {
      myPos?: number | null;
      myText?: string;
      partnerPos?: number | null;
      partnerText?: string;
      myQ3?: string | null;
      partnerQ3?: string | null;
    } = {},
  ): H2HRaceInput => ({
    round,
    results: [
      { driverId: 'me', position: opts.myPos ?? 1, positionText: opts.myText ?? String(opts.myPos ?? 1), team: 'T' },
      {
        driverId: partnerId,
        position: opts.partnerPos ?? 2,
        positionText: opts.partnerText ?? String(opts.partnerPos ?? 2),
        team: 'T',
      },
      { driverId: 'rival', position: 3, positionText: '3', team: 'Other' },
    ],
    qualifying: [
      q('me', 1, '1:12.0', '1:11.5', opts.myQ3 === undefined ? '1:11.100' : opts.myQ3),
      q(partnerId, 2, '1:12.1', '1:11.8', opts.partnerQ3 === undefined ? '1:11.250' : opts.partnerQ3),
    ],
  });

  it('detects the teammate per race, so seat swaps are handled', () => {
    const races = [race(1, 'first-partner'), race(2, 'second-partner')];
    const verdicts = teamRoundVerdicts(races, 'T', 'me');
    expect(verdicts.map((v) => v.partnerId)).toEqual(['first-partner', 'second-partner']);
  });

  it('a DNF race counts for neither driver in the race record', () => {
    const races = [
      race(1, 'p'),
      race(2, 'p', { myPos: null, myText: 'R', partnerPos: 5, partnerText: '5' }),
    ];
    const s = summarize(teamRoundVerdicts(races, 'T', 'me'), 'me');
    expect(s.raceWins).toBe(1);
    expect(s.raceLosses).toBe(0);
  });

  it('median gap is signed (negative = primary faster) and skips missing laps', () => {
    const races = [
      race(1, 'p'), // -150 ms in Q3
      race(2, 'p', { partnerQ3: null }), // falls back to Q2: -300
      race(3, 'p', { myQ3: '1:11.400', partnerQ3: '1:11.300' }), // +100
    ];
    const s = summarize(teamRoundVerdicts(races, 'T', 'me'), 'me');
    expect(s.comparableLaps).toBe(3);
    expect(s.medianGapMs).toBe(-150);
    expect(s.qualiWins).toBe(3); // record uses classification, present all rounds
  });
});
