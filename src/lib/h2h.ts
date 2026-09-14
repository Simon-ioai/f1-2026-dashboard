// Teammate head-to-head arithmetic. The only fair intra-team comparison is
// the same car, so everything here is teammate vs teammate, per race:
//
// - Qualifying gap: compared in the DEEPEST session both cars set a time
//   (Q3, else Q2, else Q1) — the sessions where both ran the same fuel/tyre
//   game. A car with no representative lap in any common session contributes
//   to the win-loss record (by classification) but never to the time gap.
// - Race record counts only races where BOTH cars were classified; a DNF is
//   reliability, not a head-to-head verdict.
// - The teammate is detected per race from the results, so mid-season seat
//   swaps (hello, Red Bull) are handled by construction.

import { median } from './odds';

/** "1:31.824" -> 91824 ms; "59.876" -> 59876 ms; null/garbage -> null. */
export function parseLapMs(time: string | null | undefined): number | null {
  if (!time) return null;
  const match = time.trim().match(/^(?:(\d+):)?(\d{1,2})\.(\d{1,3})$/);
  if (!match) return null;
  const minutes = match[1] ? Number(match[1]) : 0;
  return minutes * 60_000 + Number(match[2]) * 1000 + Number(match[3].padEnd(3, '0'));
}

export interface QualiRow {
  driverId: string;
  position: number | null;
  q1: string | null;
  q2: string | null;
  q3: string | null;
}

/**
 * Signed gap (aMs - bMs) from the deepest session both drivers have a time
 * in, or null when no common representative lap exists. Negative = a faster.
 */
export function deepestCommonGap(
  a: QualiRow,
  b: QualiRow,
): { gapMs: number; session: 'Q3' | 'Q2' | 'Q1' } | null {
  for (const session of ['q3', 'q2', 'q1'] as const) {
    const aMs = parseLapMs(a[session]);
    const bMs = parseLapMs(b[session]);
    if (aMs !== null && bMs !== null) {
      return { gapMs: aMs - bMs, session: session.toUpperCase() as 'Q3' | 'Q2' | 'Q1' };
    }
  }
  return null;
}

export interface H2HRaceInput {
  round: number;
  results: { driverId: string; position: number | null; positionText: string; team: string }[];
  qualifying: QualiRow[];
}

export interface RoundVerdict {
  round: number;
  partnerId: string;
  /** Positive = primary slower, negative = primary faster; null = no comparable lap. */
  qualiGapMs: number | null;
  qualiSession: string | null;
  qualiAheadId: string | null;
  raceAheadId: string | null; // null unless both classified
}

/**
 * Per-round verdicts for `primaryId` against whoever shared `team`'s other
 * car that weekend. Gaps are signed primary-minus-partner.
 */
export function teamRoundVerdicts(
  races: H2HRaceInput[],
  team: string,
  primaryId: string,
): RoundVerdict[] {
  const verdicts: RoundVerdict[] = [];
  for (const race of races) {
    const teamRows = race.results.filter((r) => r.team === team);
    const mine = teamRows.find((r) => r.driverId === primaryId);
    const partner = teamRows.find((r) => r.driverId !== primaryId);
    if (!mine || !partner) continue;

    const classified = (row: { positionText: string }) => /^\d+$/.test(row.positionText);
    const raceAheadId =
      classified(mine) && classified(partner)
        ? (mine.position ?? 99) < (partner.position ?? 99)
          ? primaryId
          : partner.driverId
        : null;

    const myQ = race.qualifying.find((q) => q.driverId === primaryId);
    const partnerQ = race.qualifying.find((q) => q.driverId === partner.driverId);
    let qualiGapMs: number | null = null;
    let qualiSession: string | null = null;
    let qualiAheadId: string | null = null;
    if (myQ && partnerQ) {
      qualiAheadId = (myQ.position ?? 99) < (partnerQ.position ?? 99) ? primaryId : partner.driverId;
      const gap = deepestCommonGap(myQ, partnerQ);
      if (gap) {
        qualiGapMs = gap.gapMs;
        qualiSession = gap.session;
      }
    }
    verdicts.push({
      round: race.round,
      partnerId: partner.driverId,
      qualiGapMs,
      qualiSession,
      qualiAheadId,
      raceAheadId,
    });
  }
  return verdicts;
}

export interface H2HSummary {
  qualiWins: number;
  qualiLosses: number;
  raceWins: number;
  raceLosses: number;
  /** Median signed quali gap in ms (negative = primary faster), null if no comparable laps. */
  medianGapMs: number | null;
  comparableLaps: number;
}

export function summarize(verdicts: RoundVerdict[], primaryId: string): H2HSummary {
  const gaps = verdicts.map((v) => v.qualiGapMs).filter((g): g is number => g !== null);
  return {
    qualiWins: verdicts.filter((v) => v.qualiAheadId === primaryId).length,
    qualiLosses: verdicts.filter((v) => v.qualiAheadId !== null && v.qualiAheadId !== primaryId).length,
    raceWins: verdicts.filter((v) => v.raceAheadId === primaryId).length,
    raceLosses: verdicts.filter((v) => v.raceAheadId !== null && v.raceAheadId !== primaryId).length,
    medianGapMs: gaps.length > 0 ? median(gaps) : null,
    comparableLaps: gaps.length,
  };
}
