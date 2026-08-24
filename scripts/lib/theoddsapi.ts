// The Odds API — DORMANT bookmaker-odds path. As of Aug 2026 The Odds API
// lists no Formula 1 markets on any plan we could see (verified against a live
// key: 176 sports, zero motorsport), so Polymarket is the primary source. This
// module is kept so that if F1 outrights ever appear here, running
// `npm run snapshot:odds -- --source=theoddsapi` (with ODDS_API_KEY set)
// resumes bookmaker snapshots without any new code.

const BASE = 'https://api.the-odds-api.com/v4';

export interface OddsApiOutcome {
  name: string;
  price: number;
}
export interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: { key: string; outcomes: OddsApiOutcome[] }[];
}
interface OddsApiEvent {
  id: string;
  sport_key: string;
  bookmakers: OddsApiBookmaker[];
}
interface OddsApiSport {
  key: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

export function oddsApiKey(): string {
  const key = process.env.ODDS_API_KEY;
  if (!key) {
    throw new Error(
      'ODDS_API_KEY is not set. Sign up free at https://the-odds-api.com, then add the key to .env. See README.',
    );
  }
  return key;
}

export async function fetchWithQuota(
  url: string,
): Promise<{ body: unknown; remaining: number | null }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const remaining = res.headers.get('x-requests-remaining');
  if (!res.ok) {
    throw new Error(`The Odds API returned HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return { body: await res.json(), remaining: remaining !== null ? Number(remaining) : null };
}

export async function discoverSportKey(): Promise<string> {
  const { body } = await fetchWithQuota(`${BASE}/sports/?all=true&apiKey=${oddsApiKey()}`);
  const sports = body as OddsApiSport[];
  const candidates = sports.filter(
    (s) => /f1|formula/i.test(`${s.key} ${s.title} ${s.description}`) && s.has_outrights,
  );
  console.log('F1 outright markets found on The Odds API:');
  for (const c of candidates)
    console.log(`  ${c.key}  (${c.title} — ${c.description}, active=${c.active})`);
  const preferred =
    candidates.find((c) => /driver|world|championship/i.test(`${c.key} ${c.description}`) && c.active) ??
    candidates.find((c) => c.active) ??
    candidates[0];
  if (!preferred) {
    throw new Error(
      'No F1 outright market on The Odds API (this has been the case since Aug 2026). ' +
        'Polymarket is the working source: npm run snapshot:odds',
    );
  }
  return preferred.key;
}

/** One outrights snapshot (1 credit). Returns bookmakers + credits remaining. */
export async function fetchBookmakerOutrights(): Promise<{
  sportKey: string;
  bookmakers: { key: string; title: string; last_update: string; outcomes: OddsApiOutcome[] }[];
  remaining: number | null;
}> {
  const sportKey = process.env.ODDS_SPORT_KEY || (await discoverSportKey());
  const url = `${BASE}/sports/${sportKey}/odds/?regions=eu&markets=outrights&oddsFormat=decimal&apiKey=${oddsApiKey()}`;
  const { body, remaining } = await fetchWithQuota(url);
  const events = body as OddsApiEvent[];
  const event = events[0];
  if (!event || event.bookmakers.length === 0) {
    throw new Error(`No bookmaker odds returned for ${sportKey}.`);
  }
  return {
    sportKey,
    remaining,
    bookmakers: event.bookmakers.map((b) => ({
      key: b.key,
      title: b.title,
      last_update: b.last_update,
      outcomes: (b.markets.find((m) => m.key === 'outrights')?.outcomes ?? []).map((o) => ({
        name: o.name,
        price: o.price,
      })),
    })),
  };
}
