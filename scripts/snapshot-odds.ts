// Daily odds snapshot from The Odds API (free Starter plan, 500 credits/month).
// One call — outrights market, eu region — costs 1 credit. Snapshots are
// append-only: a day file data/odds/YYYY-MM-DD.json holds every snapshot taken
// that day, and history can never be re-fetched on the free plan.
//
// Usage:
//   npx tsx scripts/snapshot-odds.ts --discover   list F1 sport keys (costs 0 credits)
//   npx tsx scripts/snapshot-odds.ts              take one snapshot (costs 1 credit)

import { readJson, writeJson, todayUtc } from './lib/io.js';
import { loadMeta, saveMeta, setWarnings } from './update-results.js';

const BASE = 'https://api.the-odds-api.com/v4';
// Stop loudly while there is still headroom, instead of failing with 401/429
// mid-season and silently losing snapshots.
const MIN_CREDITS_REMAINING = 40;

interface OddsApiOutcome {
  name: string;
  price: number;
}
interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: { key: string; outcomes: OddsApiOutcome[] }[];
}
interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  bookmakers: OddsApiBookmaker[];
}
interface OddsApiSport {
  key: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

function apiKey(): string {
  const key = process.env.ODDS_API_KEY;
  if (!key) {
    throw new Error(
      'ODDS_API_KEY is not set. Sign up free at https://the-odds-api.com (Starter plan, no card), ' +
        'then add the key to .env locally and as a GitHub repository secret. See README.',
    );
  }
  return key;
}

async function fetchWithQuota(url: string): Promise<{ body: unknown; remaining: number | null }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const remaining = res.headers.get('x-requests-remaining');
  if (!res.ok) {
    throw new Error(`The Odds API returned HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return { body: await res.json(), remaining: remaining !== null ? Number(remaining) : null };
}

async function discoverSportKey(): Promise<string> {
  const { body } = await fetchWithQuota(`${BASE}/sports/?all=true&apiKey=${apiKey()}`);
  const sports = body as OddsApiSport[];
  const candidates = sports.filter(
    (s) => /f1|formula/i.test(`${s.key} ${s.title} ${s.description}`) && s.has_outrights,
  );
  console.log('F1 outright markets found on The Odds API:');
  for (const c of candidates) console.log(`  ${c.key}  (${c.title} — ${c.description}, active=${c.active})`);
  const preferred =
    candidates.find((c) => /driver|world|championship/i.test(`${c.key} ${c.description}`) && c.active) ??
    candidates.find((c) => c.active) ??
    candidates[0];
  if (!preferred) {
    throw new Error(
      'No F1 outright market found on The Odds API. Run with --discover to inspect, ' +
        'or set ODDS_SPORT_KEY manually.',
    );
  }
  return preferred.key;
}

async function snapshot(): Promise<void> {
  const meta = loadMeta();
  const warnings: string[] = [];
  const sportKey = process.env.ODDS_SPORT_KEY || (await discoverSportKey());
  console.log(`Using sport key: ${sportKey}`);

  // one market x one region = 1 credit
  const url = `${BASE}/sports/${sportKey}/odds/?regions=eu&markets=outrights&oddsFormat=decimal&apiKey=${apiKey()}`;
  const { body, remaining } = await fetchWithQuota(url);
  const events = body as OddsApiEvent[];

  if (remaining !== null) console.log(`The Odds API credits remaining this month: ${remaining}`);

  const event = events[0];
  if (!event || event.bookmakers.length === 0) {
    throw new Error(
      `No bookmaker odds returned for ${sportKey}. The market may be suspended (e.g. during a race). ` +
        'Nothing was written; the last snapshot stands.',
    );
  }

  const day = todayUtc();
  const relPath = `data/odds/${day}.json`;
  const existing = readJson<{ date: string; snapshots: unknown[] }>(relPath) ?? {
    date: day,
    snapshots: [],
  };
  existing.snapshots.push({
    fetched_at: new Date().toISOString(),
    source: 'the-odds-api',
    sport_key: sportKey,
    credits_remaining: remaining,
    bookmakers: event.bookmakers.map((b) => ({
      key: b.key,
      title: b.title,
      last_update: b.last_update,
      outcomes: (b.markets.find((m) => m.key === 'outrights')?.outcomes ?? []).map((o) => ({
        name: o.name,
        price: o.price,
      })),
    })),
  });
  writeJson(relPath, existing);
  console.log(
    `Snapshot ${existing.snapshots.length} for ${day}: ${event.bookmakers.length} bookmakers.`,
  );

  meta.odds_updated_at = new Date().toISOString();
  if (remaining !== null && remaining < MIN_CREDITS_REMAINING) {
    warnings.push(
      `The Odds API has only ${remaining} credits left this month — snapshots will pause soon.`,
    );
  }
  setWarnings(meta, 'odds', warnings);
  saveMeta(meta);

  if (remaining !== null && remaining < MIN_CREDITS_REMAINING) {
    // Loud failure AFTER saving the snapshot: the data is safe, the job goes red
    // so the quota problem is noticed before snapshots silently stop.
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
  try {
    await snapshot();
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
