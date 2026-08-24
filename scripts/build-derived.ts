// Build data/derived/timeline.json — the single file the dashboard reads for
// module 1. Combines every odds day-file (using the last snapshot of each day)
// with the race calendar and winners for annotations. Derived data is always
// rebuilt from committed snapshots, never fetched.

import { aggregateBooks, type BookmakerOdds } from '../src/lib/odds.js';
import { matchDriver, TRACKED_IDS, FIELD } from '../src/lib/drivers.js';
import { listDir, readJson, writeJson } from './lib/io.js';
import { loadMeta, saveMeta } from './update-results.js';

interface DayFile {
  date: string;
  snapshots: {
    fetched_at: string;
    source: string;
    bookmakers: { key: string; title: string; last_update: string; outcomes: { name: string; price: number }[] }[];
  }[];
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
    const books: BookmakerOdds[] = latest.bookmakers.map((b) => ({
      key: b.key,
      title: b.title,
      lastUpdate: b.last_update,
      outcomes: b.outcomes,
    }));
    const aggregated = aggregateBooks(books, matchDriver, FIELD.id);
    const byId: Record<string, { median: number; min: number; max: number; books: number }> = {};
    for (const id of [...TRACKED_IDS, FIELD.id]) {
      const agg = aggregated.get(id);
      if (agg) byId[id] = agg;
    }
    points.push({
      date: day.date,
      fetched_at: latest.fetched_at,
      bookmakers: books.length,
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

  const meta = loadMeta();
  meta.derived_updated_at = new Date().toISOString();
  saveMeta(meta);
}

const isMain = process.argv[1]?.endsWith('build-derived.ts');
if (isMain) buildDerived();
