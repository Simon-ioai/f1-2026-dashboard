// Polymarket — the odds source. The 2026 F1 Drivers' Champion event is one
// binary market per driver ("Will X be the 2026 F1 Drivers' Champion?"); the
// YES mid-price is the market-implied title probability, and bid/ask give the
// uncertainty band. The public Gamma/CLOB APIs are free and keyless, and CLOB
// serves daily price history back to the market's opening (Dec 2025) — which
// is how the season gets backfilled.

import { fetchJson, sleep } from './io.js';

const GAMMA = 'https://gamma-api.polymarket.com';
const CLOB = 'https://clob.polymarket.com';

export const EVENT_SLUG = '2026-f1-drivers-champion';

interface GammaMarket {
  question: string;
  active: boolean;
  closed: boolean;
  /** JSON-encoded ["yesPrice", "noPrice"] */
  outcomePrices?: string;
  bestBid?: number;
  bestAsk?: number;
  /** JSON-encoded [yesTokenId, noTokenId] */
  clobTokenIds?: string;
}

interface GammaEvent {
  title: string;
  slug: string;
  active: boolean;
  markets: GammaMarket[];
}

export interface TitleMarket {
  /** Driver name extracted from the question ("Kimi Antonelli"). */
  name: string;
  /** YES mid-price = implied probability, 0..1. */
  p: number;
  bid: number | null;
  ask: number | null;
  /** CLOB token id of the YES side, for price history. */
  tokenId: string | null;
}

function driverName(question: string): string {
  const m = question.match(/^Will (.+?) be the /i);
  return m ? m[1] : question;
}

export async function fetchTitleMarkets(): Promise<TitleMarket[]> {
  const events = await fetchJson<GammaEvent[]>(`${GAMMA}/events?slug=${EVENT_SLUG}`);
  const event = events[0];
  if (!event) throw new Error(`Polymarket event not found: ${EVENT_SLUG}`);
  const markets: TitleMarket[] = [];
  for (const m of event.markets) {
    if (m.closed && !event.active) continue;
    let p: number | null = null;
    try {
      const prices = JSON.parse(m.outcomePrices ?? '[]') as string[];
      if (prices.length > 0) p = Number(prices[0]);
    } catch {
      // fall through to bid/ask mid
    }
    const bid = typeof m.bestBid === 'number' ? m.bestBid : null;
    const ask = typeof m.bestAsk === 'number' ? m.bestAsk : null;
    if (p === null || !Number.isFinite(p)) {
      if (bid !== null && ask !== null) p = (bid + ask) / 2;
      else continue;
    }
    // Placeholder markets ("Driver A".."Driver I") carry no order book: bid 0,
    // ask 1, mid reported as 0.5. Including them would wreck the field
    // normalisation, so require a real (non-degenerate) book.
    const degenerate = (bid ?? 0) <= 0.001 && (ask ?? 1) >= 0.999;
    if (degenerate) continue;
    let tokenId: string | null = null;
    try {
      const ids = JSON.parse(m.clobTokenIds ?? '[]') as string[];
      tokenId = ids[0] ?? null;
    } catch {
      tokenId = null;
    }
    markets.push({ name: driverName(m.question), p, bid, ask, tokenId });
  }
  if (markets.length === 0) {
    throw new Error(`Polymarket event ${EVENT_SLUG} returned no priced markets.`);
  }
  return markets;
}

interface HistoryResponse {
  history: { t: number; p: number }[];
}

/** Daily closing prices for one market token: date (UTC) -> probability. */
export async function fetchDailyHistory(tokenId: string): Promise<Map<string, number>> {
  const res = await fetchJson<HistoryResponse>(
    `${CLOB}/prices-history?market=${tokenId}&interval=max&fidelity=1440`,
  );
  const byDate = new Map<string, number>();
  for (const point of res.history) {
    // one point per day at fidelity=1440; keep the last seen per UTC date
    const date = new Date(point.t * 1000).toISOString().slice(0, 10);
    byDate.set(date, point.p);
  }
  return byDate;
}

export { sleep };
