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

    // Jolpica can lag a freshly finished Grand Prix by hours. If the schedule
    // says a race happened and OpenF1 already has the classification, patch
    // that one race in (marked provisional); the next successful Jolpica run
    // rewrites season.json wholesale and replaces it with canonical data.
    warnings.push(...(await patchLatestRaceFromOpenF1()));
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

interface ScheduleJson {
  races: { round: number; name: string; date: string; time: string | null; hasSprint: boolean }[];
}
interface SeasonJson {
  season: number;
  fetched_at: string;
  source: string;
  races: {
    round: number;
    name: string;
    date: string;
    source?: string;
    results: CompactRow[];
    sprintResults: CompactRow[];
    qualifying: unknown[];
  }[];
}
interface StandingsJson {
  season: number;
  round: number;
  fetched_at: string;
  provisional?: boolean;
  standings: {
    position: number | null;
    driverId: string;
    code: string | null;
    name: string;
    team: string;
    points: number;
    wins: number;
  }[];
}
type CompactRow = ReturnType<typeof compactResult>;

async function patchLatestRaceFromOpenF1(): Promise<string[]> {
  const schedule = readJson<ScheduleJson>('data/results/schedule.json');
  const season = readJson<SeasonJson>('data/results/season.json');
  const standings = readJson<StandingsJson>('data/results/standings.json');
  if (!schedule || !season || !standings) return [];

  const now = Date.now();
  const TWO_HOURS = 2 * 3600 * 1000;
  const completed = new Set(
    season.races.filter((r) => r.results.length > 0).map((r) => r.round),
  );
  // Most recent race that started >2h ago but has no Jolpica result yet.
  const missing = [...schedule.races]
    .filter((r) => {
      const start = Date.parse(`${r.date}T${r.time ?? '12:00:00Z'}`);
      return start + TWO_HOURS < now && !completed.has(r.round);
    })
    .sort((a, b) => b.round - a.round)[0];
  if (!missing) return [];

  let fallback;
  try {
    fallback = await getLatestSessionResult(season.season, 'Race');
  } catch (err) {
    return [`Round ${missing.round} not on Jolpica yet; OpenF1 also failed (${String(err).slice(0, 120)}).`];
  }
  // Only patch if OpenF1's latest race is actually this round's date.
  if (!fallback || fallback.dateStart.slice(0, 10) !== missing.date) {
    return [`Round ${missing.round} (${missing.name}) has no published result yet on any source.`];
  }

  const byCode = new Map(standings.standings.map((s) => [s.code, s]));
  const rows: CompactRow[] = [];
  for (const r of fallback.results) {
    const known = byCode.get(r.code);
    if (!known) continue; // driver not in the championship table
    rows.push({
      position: r.position,
      positionText: r.position !== null && r.status === 'Finished' ? String(r.position) : 'R',
      driverId: known.driverId,
      code: known.code,
      name: known.name,
      team: known.team,
      grid: null,
      points: r.points,
      status: r.status,
    });
  }
  if (rows.length === 0) return [`OpenF1 result for round ${missing.round} matched no known drivers.`];

  const entry = season.races.find((r) => r.round === missing.round);
  const patchedRace = {
    round: missing.round,
    name: missing.name,
    date: missing.date,
    source: 'openf1-provisional',
    results: rows,
    sprintResults: entry?.sprintResults ?? [],
    qualifying: entry?.qualifying ?? [],
  };
  if (entry) Object.assign(entry, patchedRace);
  else season.races.push(patchedRace);
  season.races.sort((a, b) => a.round - b.round);
  writeJson('data/results/season.json', season);

  // Roll the patched points into the standings.
  for (const s of standings.standings) {
    const row = rows.find((r) => r.driverId === s.driverId);
    if (!row) continue;
    s.points += row.points;
    if (row.position === 1) s.wins += 1;
  }
  standings.standings.sort((a, b) => b.points - a.points || b.wins - a.wins);
  standings.standings.forEach((s, i) => (s.position = i + 1));
  standings.round = missing.round;
  standings.provisional = true;
  writeJson('data/results/standings.json', standings);

  console.log(`Patched round ${missing.round} (${missing.name}) from OpenF1: ${rows.length} classified.`);
  return [
    `${missing.name} result is provisional (from OpenF1, points derived from positions) until Jolpica publishes it.`,
  ];
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
