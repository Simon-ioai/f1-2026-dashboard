// Build data/derived/timeline.json — the single file the dashboard reads for
// module 1. Combines every odds day-file (using the last snapshot of each day)
// with the race calendar and winners for annotations. Derived data is always
// rebuilt from committed snapshots, never fetched.

import { aggregateBooks, normalizeShares, type BookmakerOdds } from '../src/lib/odds.js';
import { matchDriver, TRACKED_IDS, FIELD } from '../src/lib/drivers.js';
import {
  canStillWin,
  earliestClinch,
  firstClinchedRound,
  firstEliminationRound,
  hasClinched,
  maxPointsAvailable,
  type DriverPoints,
  type RemainingRace,
  type RoundPoints,
} from '../src/lib/clinch.js';
import { buildFormSeries } from '../src/lib/form.js';
import { summarize, teamRoundVerdicts, type H2HRaceInput } from '../src/lib/h2h.js';
import { listDir, readJson, writeJson } from './lib/io.js';
import { loadMeta, saveMeta } from './update-results.js';

interface DayFile {
  date: string;
  snapshots: {
    fetched_at: string;
    source: string;
    /** bookmaker-shaped snapshots (dormant The Odds API path) */
    bookmakers?: { key: string; title: string; last_update: string; outcomes: { name: string; price: number }[] }[];
    /** probability-shaped snapshots (Polymarket live + history) */
    outcomes?: { name: string; p: number; bid: number | null; ask: number | null }[];
  }[];
}

type ById = Record<string, { median: number; min: number; max: number; books: number }>;

/** Aggregate one probability-shaped snapshot: normalise the full field, pool untracked drivers. */
function aggregateShares(outcomes: NonNullable<DayFile['snapshots'][number]['outcomes']>): ById {
  const normalized = normalizeShares(
    outcomes.map((o) => ({ name: o.name, p: o.p, lo: o.bid ?? undefined, hi: o.ask ?? undefined })),
  );
  const byId: ById = {};
  let field = { p: 0, lo: 0, hi: 0 };
  for (const [name, v] of normalized) {
    const id = matchDriver(name);
    if (id === null) {
      field = { p: field.p + v.p, lo: field.lo + v.lo, hi: field.hi + v.hi };
    } else {
      byId[id] = { median: v.p, min: v.lo, max: v.hi, books: 1 };
    }
  }
  byId[FIELD.id] = { median: field.p, min: field.lo, max: field.hi, books: 1 };
  return byId;
}

interface ScheduleFile {
  races: {
    round: number;
    name: string;
    circuit: string;
    locality: string;
    country: string;
    date: string;
    hasSprint: boolean;
  }[];
}

interface SeasonFile {
  races: {
    round: number;
    name: string;
    date: string;
    results: { position: number | null; driverId: string; code: string | null; name: string; team: string }[];
  }[];
}

export function buildDerived(): void {
  const dayFiles = listDir('data/odds').filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  const points = [];
  for (const file of dayFiles) {
    const day = readJson<DayFile>(`data/odds/${file}`);
    if (!day || day.snapshots.length === 0) continue;
    const latest = day.snapshots[day.snapshots.length - 1];

    let byId: ById = {};
    let sourceCount = 0;
    if (latest.outcomes && latest.outcomes.length > 0) {
      byId = aggregateShares(latest.outcomes);
      sourceCount = 1;
    } else if (latest.bookmakers && latest.bookmakers.length > 0) {
      const books: BookmakerOdds[] = latest.bookmakers.map((b) => ({
        key: b.key,
        title: b.title,
        lastUpdate: b.last_update,
        outcomes: b.outcomes,
      }));
      const aggregated = aggregateBooks(books, matchDriver, FIELD.id);
      for (const id of [...TRACKED_IDS, FIELD.id]) {
        const agg = aggregated.get(id);
        if (agg) byId[id] = agg;
      }
      sourceCount = books.length;
    } else {
      continue;
    }

    points.push({
      date: day.date,
      fetched_at: latest.fetched_at,
      source: latest.source,
      bookmakers: sourceCount,
      byId,
    });
  }
  points.sort((a, b) => a.date.localeCompare(b.date));

  const schedule = readJson<ScheduleFile>('data/results/schedule.json');
  const season = readJson<SeasonFile>('data/results/season.json');
  const races = (schedule?.races ?? []).map((r) => {
    const result = season?.races.find((s) => s.round === r.round);
    const winner = result?.results.find((res) => res.position === 1) ?? null;
    return {
      round: r.round,
      name: r.name,
      circuit: r.circuit,
      locality: r.locality,
      country: r.country,
      date: r.date,
      hasSprint: r.hasSprint,
      winner: winner
        ? { driverId: winner.driverId, code: winner.code, name: winner.name, team: winner.team }
        : null,
    };
  });

  writeJson('data/derived/timeline.json', {
    generated_at: new Date().toISOString(),
    snapshot_days: points.length,
    points,
    races,
  });

  buildClinch();
  buildH2H();
  buildForm();

  const meta = loadMeta();
  meta.derived_updated_at = new Date().toISOString();
  saveMeta(meta);
}

interface SeasonWithPoints {
  races: {
    round: number;
    results: { driverId: string; points: number; position: number | null }[];
    sprintResults: { driverId: string; points: number }[];
  }[];
}
interface StandingsForClinch {
  round: number;
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

/** data/derived/form.json — rolling 3-race form per tracked driver. */
function buildForm(): void {
  const season = readJson<SeasonForH2H>('data/results/season.json');
  const schedule = readJson<ScheduleFile>('data/results/schedule.json');
  const standings = readJson<StandingsForClinch>('data/results/standings.json');
  if (!season || !schedule || !standings) return;

  const locality = new Map(schedule.races.map((r) => [r.round, r.locality]));
  const completed = season.races.filter((r) => r.results.length > 0);
  const info = new Map(standings.standings.map((s) => [s.driverId, s]));

  const drivers = TRACKED_IDS.map((driverId) => {
    const rounds = completed
      .map((race) => {
        const result = race.results.find((r) => r.driverId === driverId);
        if (!result) return null; // did not take part that weekend
        const sprint = race.sprintResults.find((r) => r.driverId === driverId);
        const quali = race.qualifying.find((q) => q.driverId === driverId);
        return {
          round: race.round,
          points: result.points + (sprint?.points ?? 0),
          qualiPos: quali?.position ?? null,
        };
      })
      .filter((r) => r !== null);
    const series = buildFormSeries(rounds);
    return {
      driverId,
      code: info.get(driverId)?.code ?? null,
      name: info.get(driverId)?.name ?? driverId,
      baselinePoints: series.baselinePoints,
      baselineQuali: series.baselineQuali,
      pointsSd: series.pointsSd,
      rounds: series.points.map((p) => ({ ...p, locality: locality.get(p.round) ?? `R${p.round}` })),
    };
  });

  writeJson('data/derived/form.json', {
    generated_at: new Date().toISOString(),
    based_on_round: Math.max(0, ...completed.map((r) => r.round)),
    window: 3,
    note:
      'Rolling 3-weekend averages (race + sprint points; qualifying position). A weekend is marked when the rolling points average is more than one standard deviation from the season baseline.',
    drivers,
  });
}

const H2H_TEAMS = ['Mercedes', 'Ferrari', 'McLaren', 'Red Bull'];

interface SeasonForH2H {
  races: {
    round: number;
    name: string;
    results: {
      driverId: string;
      position: number | null;
      positionText: string;
      team: string;
      points: number;
    }[];
    sprintResults: { driverId: string; points: number }[];
    qualifying: {
      driverId: string;
      position: number | null;
      q1: string | null;
      q2: string | null;
      q3: string | null;
    }[];
  }[];
}

/** data/derived/h2h.json — teammate head-to-heads for the four front teams. */
function buildH2H(): void {
  const season = readJson<SeasonForH2H>('data/results/season.json');
  const schedule = readJson<ScheduleFile>('data/results/schedule.json');
  const standings = readJson<StandingsForClinch>('data/results/standings.json');
  if (!season || !schedule || !standings) return;

  const locality = new Map(schedule.races.map((r) => [r.round, r.locality]));
  const completed = season.races.filter((r) => r.results.length > 0);
  const h2hRaces: H2HRaceInput[] = completed;

  const teams = H2H_TEAMS.map((team) => {
    const teamDrivers = standings.standings.filter((s) => s.team === team);
    if (teamDrivers.length < 2) return null;
    // Primary = the team's best-placed driver in the championship.
    const [primary, ...others] = teamDrivers;
    const verdicts = teamRoundVerdicts(h2hRaces, team, primary.driverId);
    const overall = summarize(verdicts, primary.driverId);
    const info = new Map(standings.standings.map((s) => [s.driverId, s]));

    // Points per driver in this team's car across the season (race + sprint).
    const partners = others.map((p) => {
      const own = verdicts.filter((v) => v.partnerId === p.driverId);
      return {
        driverId: p.driverId,
        code: p.code,
        name: p.name,
        points: p.points,
        rounds: own.length,
        ...summarize(own, primary.driverId), // record from primary's perspective
      };
    });

    return {
      team,
      primary: {
        driverId: primary.driverId,
        code: primary.code,
        name: primary.name,
        points: primary.points,
      },
      partners,
      overall,
      trend: verdicts.map((v) => ({
        round: v.round,
        locality: locality.get(v.round) ?? `R${v.round}`,
        gapMs: v.qualiGapMs,
        session: v.qualiSession,
        partnerId: v.partnerId,
        partnerCode: info.get(v.partnerId)?.code ?? null,
      })),
    };
  }).filter((t) => t !== null);

  writeJson('data/derived/h2h.json', {
    generated_at: new Date().toISOString(),
    based_on_round: Math.max(0, ...completed.map((r) => r.round)),
    note:
      'Gaps compare the deepest qualifying session both cars set a time in; race record counts only races where both cars were classified.',
    teams,
  });
}

/** data/derived/clinch.json — title permutations from current standings. */
function buildClinch(): void {
  const season = readJson<SeasonWithPoints>('data/results/season.json');
  const schedule = readJson<ScheduleFile>('data/results/schedule.json');
  const standings = readJson<StandingsForClinch>('data/results/standings.json');
  if (!season || !schedule || !standings) return;

  const fullCalendar: (RemainingRace & { locality: string })[] = schedule.races.map((r) => ({
    round: r.round,
    name: r.name,
    date: r.date,
    hasSprint: r.hasSprint,
    locality: r.locality,
  }));
  const completedRounds: RoundPoints[] = season.races
    .filter((r) => r.results.length > 0)
    .map((r) => {
      const pointsByDriver: Record<string, number> = {};
      for (const row of [...r.results, ...r.sprintResults]) {
        pointsByDriver[row.driverId] = (pointsByDriver[row.driverId] ?? 0) + row.points;
      }
      return { round: r.round, pointsByDriver };
    });
  const lastRound = Math.max(0, ...completedRounds.map((r) => r.round));
  const remaining = fullCalendar.filter((r) => r.round > lastRound);
  const byRound = new Map(fullCalendar.map((r) => [r.round, r]));

  const all: DriverPoints[] = standings.standings.map((s) => ({
    driverId: s.driverId,
    name: s.name,
    points: s.points,
  }));

  const drivers = standings.standings.map((s) => {
    const me: DriverPoints = { driverId: s.driverId, name: s.name, points: s.points };
    const rivals = all.filter((d) => d.driverId !== s.driverId);
    const clinched = hasClinched(me, rivals, remaining);
    const alive = clinched || canStillWin(me, rivals, remaining);
    const scenario = alive && !clinched ? earliestClinch(me, rivals, remaining) : null;
    const clinchRace = scenario?.earliestRound ? byRound.get(scenario.earliestRound) : null;
    const eliminatedRound = alive ? null : firstEliminationRound(s.driverId, completedRounds, fullCalendar);
    const clinchedRound = clinched
      ? firstClinchedRound(s.driverId, completedRounds, fullCalendar)
      : null;
    const chiefRival = scenario?.chiefRivalId
      ? standings.standings.find((d) => d.driverId === scenario.chiefRivalId)
      : null;
    return {
      driverId: s.driverId,
      code: s.code,
      name: s.name,
      team: s.team,
      position: s.position,
      points: s.points,
      status: clinched ? 'clinched' : alive ? 'alive' : 'eliminated',
      clinch:
        scenario?.earliestRound && clinchRace
          ? {
              round: clinchRace.round,
              raceName: clinchRace.name,
              locality: clinchRace.locality,
              date: clinchRace.date,
              gapNeeded: scenario.gapNeeded,
              chiefRivalId: scenario.chiefRivalId,
              chiefRivalName: chiefRival?.name ?? null,
            }
          : null,
      clinchedAt: clinchedRound ? { round: clinchedRound, raceName: byRound.get(clinchedRound)?.name ?? null } : null,
      eliminatedAt:
        eliminatedRound !== null
          ? {
              round: eliminatedRound,
              raceName: byRound.get(eliminatedRound)?.name ?? null,
              date: byRound.get(eliminatedRound)?.date ?? null,
            }
          : null,
    };
  });

  writeJson('data/derived/clinch.json', {
    generated_at: new Date().toISOString(),
    based_on_round: lastRound,
    remaining_races: remaining.length,
    remaining_sprints: remaining.filter((r) => r.hasSprint).length,
    points_available: maxPointsAvailable(remaining),
    drivers,
  });
}

const isMain = process.argv[1]?.endsWith('build-derived.ts');
if (isMain) buildDerived();
