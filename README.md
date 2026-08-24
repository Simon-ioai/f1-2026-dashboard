# F1 2026 · Title Race Dashboard

A self-updating dashboard for the 2026 Formula 1 drivers' championship: what
the market thinks each driver's title chances are, tracked daily across the
whole season, plus real results and standings. Everything runs on free
services — no server, no database, no paid plans, **and no API keys**. The
"database" is plain JSON files committed to this repository by two scheduled
jobs.

**Where the probabilities come from — and why.** The original plan was
bookmaker odds via The Odds API (with OddsPapi as backup). Both were verified
against live keys in August 2026 and **neither carries any Formula 1 market on
their free tiers** — that was a hard wall. The working source is
[Polymarket](https://polymarket.com/event/2026-f1-drivers-champion)'s F1
Drivers' Champion market: a single deep prediction market (hundreds of
millions of dollars traded on this exact question) with a free, keyless public
API — and full daily price history back to December 2025, which bookmaker APIs
would not have provided at any price. The trade-off: it is one marketplace's
price, not a spread of bookmakers, so the uncertainty band on the chart is the
market's bid–ask spread rather than a bookmaker min–max. The bookmaker code
path still exists, dormant, in case a free source ever appears (see
`.env.example`).

---

## Running it on your computer

You need [Node.js](https://nodejs.org) (version 20 or newer — the free LTS
download is fine). Then, in a terminal, from this folder:

```
npm install                     # one time: downloads dependencies
npm run backfill                # one time: results, standings, schedule
npm run backfill:odds-history   # one time: the season's odds history from Polymarket
npm run dev                     # starts the dashboard at http://localhost:5173
```

Open http://localhost:5173 in your browser. That's it — no accounts, no keys.

## Publishing to GitHub Pages

1. Create a GitHub repository and push this folder to it (branch `main`).
2. In the repository: **Settings → Pages → Build and deployment → Source**,
   choose **GitHub Actions**.

Every push — including the automated data commits — rebuilds and redeploys the
site. No secrets are required.

## The two scheduled jobs (and why there are two)

| Job | When | What it does |
| --- | --- | --- |
| **Snapshot odds** | Daily, 12:00 UTC, all season | One keyless call to Polymarket, appends today's driver prices (with bid/ask) to `/data/odds/`, commits. Daily cadence keeps the curve smooth. |
| **Rebuild dashboard** | Mondays 05:00 *Copenhagen time*, only after a race weekend | Refreshes results, standings and schedule, rebuilds derived data, commits. |

Both have a **Run workflow** button under the Actions tab for manual runs.

Two quirks the rebuild job handles for you:

- **Danish clock change.** Denmark switches CEST→CET on 25 Oct 2026,
  mid-season. The workflow is scheduled at both 03:00 and 04:00 UTC and exits
  unless it is actually 05:00 in Copenhagen — so it runs exactly once per
  Monday all season.
- **Saturday races and Sprints.** Azerbaijan and Las Vegas race on Saturday, so
  "was there a race?" is answered from the schedule data — did a Grand Prix
  finish in the last 72 hours? — never from a hardcoded list of Sundays.

## If something breaks

The dashboard **never invents data**. If a source fails, it keeps showing the
last saved data with a visible "updated … ago" timestamp and an amber warning
badge explaining what went wrong.

- **A job shows a red ✗ on the Actions tab:** open it and read the last lines
  of the log — the scripts fail with plain-English messages. Fix the cause (or
  just wait, if an API was down), then press **Run workflow** to re-run.
- **Jolpica (results) is down:** the job automatically falls back to OpenF1 for
  the latest race and shows a warning until Jolpica recovers. Nothing to do.
- **Polymarket returns nothing:** the snapshot job fails loudly and the last
  good snapshot stands; the day's file simply gets filled by the next
  successful run. Missed days appear as small gaps, never as fake points.
- **Want to re-run backfills:** both backfill commands are safe to re-run.
  Results are re-fetched from scratch; odds history only writes days that
  don't already have a file (live snapshots always win over history).

## Rate limits and quotas

- **Polymarket public API: free, keyless.** One event query per snapshot, and
  one history query per driver market during the one-off backfill (~22 calls,
  spaced 300 ms apart). Far below any published limit.
- **Jolpica-F1: free, no key**, rate-limited per IP. The update job makes a
  handful of paginated calls once a week; the scripts pause 300 ms between
  pages.
- **OpenF1: free, no key.** Only called as a fallback when Jolpica fails.
- **The Odds API (dormant path only): 500 credits/month**; one outrights call
  in one region costs 1 credit, and the script fails loudly when fewer than 40
  credits remain.

## What's in the folders

```
src/            the dashboard app (React + TypeScript + Recharts)
src/lib/        the maths: probability normalisation, clinch arithmetic (unit-tested)
scripts/        the jobs: snapshot-odds, update-results, build-derived, backfills
data/odds/      one JSON file per day of market prices — append-only, precious
data/results/   season results, standings, schedule (rebuildable any time)
data/derived/   files computed from the above (never fetched, always rebuilt)
.github/        the three workflows: two data jobs + the Pages deploy
```

## The probability maths, in one paragraph

Polymarket quotes each driver as a YES price between 0 and 1 — already an
implied probability. Summed over every driver the prices drift slightly off
100% (spreads, stale quotes), so the dashboard normalises the full field to
sum to exactly 100%, pooling everyone outside the tracked six into the grey
"Field" line — the same vig-removal philosophy that would apply to bookmaker
odds, where a decimal price of 4.0 implies 1/4 = 25% and the bookmaker's
overround is divided out. Placeholder markets with no real order book (bid 0 /
ask 1) are excluded before normalising. The band around each line is the
bid–ask spread, scaled by the same normalisation. This is the market's
collective opinion, not a prediction, and not betting advice.

Run the tests any time with `npm test`.

---

*Unofficial fan project. Not affiliated with Formula 1, the FIA, any team, or
Polymarket. No F1 or team logos or licensed fonts are used.*
