// One-off season backfill of the odds timeline from Polymarket's daily price
// history (free, keyless — one request per driver market). Creates one day
// file per past date. APPEND-ONLY: existing day files are never touched, so
// live snapshots always win over backfilled history and re-running is safe.

import { listDir, readJson, sleep, todayUtc, writeJson } from './lib/io.js';
import { EVENT_SLUG, fetchDailyHistory, fetchTitleMarkets } from './lib/polymarket.js';
import { buildDerived } from './build-derived.js';

const markets = await fetchTitleMarkets();
const withTokens = markets.filter((m) => m.tokenId !== null);
console.log(`Backfilling daily history for ${withTokens.length} driver markets…`);

// date -> driver name -> probability
const byDate = new Map<string, Map<string, number>>();
const perDriver = new Map<string, Map<string, number>>();
for (const market of withTokens) {
  const history = await fetchDailyHistory(market.tokenId!);
  perDriver.set(market.name, history);
  for (const date of history.keys()) {
    if (!byDate.has(date)) byDate.set(date, new Map());
  }
  console.log(`  ${market.name}: ${history.size} days`);
  await sleep(300);
}

// Quiet days have no trade print for some drivers; carry the last traded
// price forward so every date normalises over the same full field.
const allDates = [...byDate.keys()].sort();
for (const [name, history] of perDriver) {
  let last: number | null = null;
  for (const date of allDates) {
    const p = history.get(date);
    if (p !== undefined) last = p;
    if (last !== null) byDate.get(date)!.set(name, last);
  }
}

const existing = new Set(listDir('data/odds'));
const today = todayUtc();
let written = 0;
let skipped = 0;
for (const [date, drivers] of [...byDate.entries()].sort()) {
  if (date >= today) continue; // today belongs to the live snapshot job
  const fileName = `${date}.json`;
  if (existing.has(fileName) && readJson(`data/odds/${fileName}`) !== null) {
    skipped++;
    continue;
  }
  writeJson(`data/odds/${fileName}`, {
    date,
    snapshots: [
      {
        fetched_at: `${date}T23:59:00.000Z`,
        source: 'polymarket-history',
        event_slug: EVENT_SLUG,
        outcomes: [...drivers.entries()].map(([name, p]) => ({ name, p, bid: null, ask: null })),
      },
    ],
  });
  written++;
}

console.log(`Backfill complete: ${written} day files written, ${skipped} existing days left untouched.`);
buildDerived();
