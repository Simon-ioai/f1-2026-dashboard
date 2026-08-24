// Daily odds snapshot. Primary source: Polymarket's 2026 F1 Drivers' Champion
// event — free, keyless, one YES-price per driver plus bid/ask. Snapshots are
// append-only: a day file data/odds/YYYY-MM-DD.json holds every snapshot taken
// that day.
//
// Usage:
//   npx tsx scripts/snapshot-odds.ts                       Polymarket snapshot
//   npx tsx scripts/snapshot-odds.ts --source=theoddsapi   dormant bookmaker path
//   npx tsx scripts/snapshot-odds.ts --discover            list The Odds API F1 markets

import { readJson, writeJson, todayUtc } from './lib/io.js';
import { EVENT_SLUG, fetchTitleMarkets } from './lib/polymarket.js';
import { discoverSportKey, fetchBookmakerOutrights } from './lib/theoddsapi.js';
import { loadMeta, saveMeta, setWarnings } from './update-results.js';

// Loud-failure threshold for the dormant The Odds API path (500 credits/month).
const MIN_CREDITS_REMAINING = 40;

interface DayFile {
  date: string;
  snapshots: unknown[];
}

function appendSnapshot(snapshot: Record<string, unknown>): { relPath: string; count: number } {
  const day = todayUtc();
  const relPath = `data/odds/${day}.json`;
  const existing = readJson<DayFile>(relPath) ?? { date: day, snapshots: [] };
  existing.snapshots.push(snapshot);
  writeJson(relPath, existing);
  return { relPath, count: existing.snapshots.length };
}

async function snapshotPolymarket(): Promise<void> {
  const markets = await fetchTitleMarkets();
  const { count } = appendSnapshot({
    fetched_at: new Date().toISOString(),
    source: 'polymarket',
    event_slug: EVENT_SLUG,
    outcomes: markets.map((m) => ({ name: m.name, p: m.p, bid: m.bid, ask: m.ask })),
  });
  console.log(`Snapshot ${count} for ${todayUtc()}: ${markets.length} Polymarket driver markets.`);

  const meta = loadMeta();
  meta.odds_updated_at = new Date().toISOString();
  setWarnings(meta, 'odds', []);
  saveMeta(meta);
}

async function snapshotTheOddsApi(): Promise<void> {
  const { sportKey, bookmakers, remaining } = await fetchBookmakerOutrights();
  if (remaining !== null) console.log(`The Odds API credits remaining: ${remaining}`);
  const { count } = appendSnapshot({
    fetched_at: new Date().toISOString(),
    source: 'the-odds-api',
    sport_key: sportKey,
    credits_remaining: remaining,
    bookmakers,
  });
  console.log(`Snapshot ${count} for ${todayUtc()}: ${bookmakers.length} bookmakers.`);

  const meta = loadMeta();
  meta.odds_updated_at = new Date().toISOString();
  const warnings: string[] = [];
  if (remaining !== null && remaining < MIN_CREDITS_REMAINING) {
    warnings.push(`The Odds API has only ${remaining} credits left this month.`);
  }
  setWarnings(meta, 'odds', warnings);
  saveMeta(meta);

  if (remaining !== null && remaining < MIN_CREDITS_REMAINING) {
    throw new Error(
      `Quota guard: only ${remaining}/500 monthly credits remain (threshold ${MIN_CREDITS_REMAINING}). ` +
        'Snapshot succeeded, but investigate usage before the quota runs out.',
    );
  }
}

async function main(): Promise<void> {
  if (process.argv.includes('--discover')) {
    await discoverSportKey();
    return;
  }
  const sourceArg = process.argv.find((a) => a.startsWith('--source='))?.split('=')[1] ?? 'polymarket';
  try {
    if (sourceArg === 'theoddsapi') await snapshotTheOddsApi();
    else await snapshotPolymarket();
  } catch (err) {
    // Record the failure where the dashboard can show it, then fail the job.
    const meta = loadMeta();
    setWarnings(meta, 'odds', [
      `Odds snapshot failed (${new Date().toISOString().slice(0, 16)} UTC): ${String(
        err instanceof Error ? err.message : err,
      ).slice(0, 300)}`,
    ]);
    saveMeta(meta);
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
