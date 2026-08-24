// Refresh schedule, results, sprints, qualifying, and standings from Jolpica.
// On total Jolpica failure, keep the last committed snapshot, record a visible
// warning in data/derived/meta.json, and try OpenF1 for the latest race so the
// newest result is not missing.

import {
  getSchedule,
  getResults,
  getSprints,
  getQualifying,
  getDriverStandings,
} from './lib/jolpica.js';
import { getLatestSessionResult } from './lib/openf1.js';
import { readJson, writeJson } from './lib/io.js';

const SEASON = 2026;

export interface MetaWarning {
  source: string;
  message: string;
  at: string;
}

export interface Meta {
  results_updated_at: string | null;
  odds_updated_at: string | null;
  derived_updated_at: string | null;
  warnings: MetaWarning[];
}

export function loadMeta(): Meta {
  return (
    readJson<Meta>('data/derived/meta.json') ?? {
      results_updated_at: null,
      odds_updated_at: null,
      derived_updated_at: null,
      warnings: [],
    }
  );
}

export function saveMeta(meta: Meta): void {
  writeJson('data/derived/meta.json', meta);
}

/** Replace this source's previous warnings (stale warnings must not linger). */
export function setWarnings(meta: Meta, source: string, messages: string[]): void {
  meta.warnings = meta.warnings.filter((w) => w.source !== source);
  const at = new Date().toISOString();
  for (const message of messages) meta.warnings.push({ source, message, at });
}

export async function updateResults(): Promise<void> {
  const meta = loadMeta();
  const warnings: string[] = [];

  try {
    console.log('Fetching schedule, results, sprints, qualifying, standings from Jolpica…');
    const [schedule, results, sprints, qualifying, standings] = await Promise.all([
      getSchedule(SEASON),
      getResults(SEASON),
      getSprints(SEASON),
      getQualifying(SEASON),
      getDriverStandings(SEASON),
    ]);

    if (schedule.length === 0) throw new Error('Jolpica returned an empty schedule');

    writeJson('data/results/schedule.json', {
      season: SEASON,
      fetched_at: new Date().toISOString(),
      races: schedule.map((r) => ({
        round: Number(r.round),
        name: r.raceName,
        circuitId: r.Circuit.circuitId,
        circuit: r.Circuit.circuitName,
        locality: r.Circuit.Location.locality,
        country: r.Circuit.Location.country,
        date: r.date,
        time: r.time ?? null,
        hasSprint: Boolean(r.Sprint),
        sprintDate: r.Sprint?.date ?? null,
      })),
    });

    writeJson('data/results/season.json', {
      season: SEASON,
      fetched_at: new Date().toISOString(),
      source: 'jolpica',
      races: results.map((r) => ({
        round: Number(r.round),
        name: r.raceName,
        date: r.date,
        results: (r.Results ?? []).map(compactResult),
        sprintResults:
          (sprints.find((s) => s.round === r.round)?.SprintResults ?? []).map(compactResult),
        qualifying: (qualifying.find((q) => q.round === r.round)?.QualifyingResults ?? []).map(
          (q) => ({
            position: Number(q.position),
            driverId: q.Driver.driverId,
            code: q.Driver.code ?? null,
            q1: q.Q1 ?? null,
            q2: q.Q2 ?? null,
            q3: q.Q3 ?? null,
          }),
        ),
      })),
    });

    if (standings) {
      writeJson('data/results/standings.json', {
        season: SEASON,
        round: Number(standings.round),
        fetched_at: new Date().toISOString(),
        standings: standings.DriverStandings.map((s) => ({
          position: Number(s.positionText) || null,
          driverId: s.Driver.driverId,
          code: s.Driver.code ?? null,
          name: `${s.Driver.givenName} ${s.Driver.familyName}`,
          team: s.Constructors[s.Constructors.length - 1]?.name ?? 'Unknown',
          points: Number(s.points),
          wins: Number(s.wins),
        })),
      });
    } else {
      warnings.push('Jolpica returned no driver standings; keeping the previous snapshot.');
    }

    meta.results_updated_at = new Date().toISOString();
    console.log(`OK: ${results.length} races with results, standings round ${standings?.round}.`);
  } catch (err) {
    console.error(`Jolpica update failed: ${String(err)}`);
    warnings.push(
      `Results update failed (${new Date().toISOString().slice(0, 16)} UTC): Jolpica unreachable. Showing last saved data.`,
    );
    try {
      const fallback = await getLatestSessionResult(SEASON, 'Race');
      if (fallback) {
        writeJson('data/results/openf1-latest-race.json', {
          fetched_at: new Date().toISOString(),
          note: 'OpenF1 fallback: latest race only; points derived from position.',
          ...fallback,
        });
        warnings.push(
          `Latest race (${fallback.location}) patched from OpenF1; standings may lag until Jolpica recovers.`,
        );
      }
    } catch (fallbackErr) {
      console.error(`OpenF1 fallback also failed: ${String(fallbackErr)}`);
      warnings.push('OpenF1 fallback also failed; results are stale until a source recovers.');
    }
  }

  setWarnings(meta, 'results', warnings);
  saveMeta(meta);
  // Never exit non-zero here: stale-but-labelled data is the designed degradation.
}

function compactResult(r: {
  position: string;
  positionText: string;
  points: string;
  grid?: string;
  status?: string;
  Driver: { driverId: string; code?: string; givenName: string; familyName: string };
  Constructor: { constructorId: string; name: string };
}) {
  return {
    position: Number(r.position) || null,
    positionText: r.positionText,
    driverId: r.Driver.driverId,
    code: r.Driver.code ?? null,
    name: `${r.Driver.givenName} ${r.Driver.familyName}`,
    team: r.Constructor.name,
    grid: r.grid !== undefined ? Number(r.grid) : null,
    points: Number(r.points),
    status: r.status ?? null,
  };
}

const isMain = process.argv[1]?.endsWith('update-results.ts');
if (isMain) {
  updateResults().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
