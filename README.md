# F1 2026 · Title Race Dashboard

A self-updating dashboard for the 2026 Formula 1 drivers' championship: who the
bookmakers think will win the title, tracked every single day, plus real results
and standings. Everything runs on free services — no server, no database, no
paid plans. The "database" is plain JSON files committed to this repository by
two scheduled jobs.

**The one honest limitation:** bookmaker odds history is a paid product, so the
odds timeline **starts on the day your first snapshot is taken** and grows one
point per day from there. The season before that day is not "missing data" —
it simply cannot be bought back on a free plan. Results and standings, by
contrast, are fully backfilled from the first race.

---

## Running it on your computer

You need [Node.js](https://nodejs.org) (version 20 or newer — the free LTS
download is fine). Then, in a terminal, from this folder:

```
npm install          # one time: downloads the project's dependencies
npm run backfill     # one time: fetches the season so far (results, standings, schedule)
npm run dev          # starts the dashboard at http://localhost:5173
```

Open http://localhost:5173 in your browser. That's it.

## Adding your odds API key

Championship odds come from [The Odds API](https://the-odds-api.com). The free
**Starter** plan (500 credits/month, no card required) is plenty — see the
quota maths below.

1. Go to https://the-odds-api.com, click **Get API Key**, choose the free plan,
   confirm your email, and copy the key.
2. **Locally:** copy `.env.example` to a new file called `.env` and paste the
   key after `ODDS_API_KEY=`.
3. **On GitHub** (so the daily job can use it): open your repository →
   **Settings → Secrets and variables → Actions → New repository secret**.
   Name it exactly `ODDS_API_KEY`, paste the key, save.

Then take your first snapshot:

```
npm run snapshot:odds
```

From that day on, the GitHub job takes one automatically every day at 12:00 UTC.

> Optional: `npm run odds:discover` lists the F1 markets your key can see
> (it costs 0 credits). The snapshot auto-detects the championship-winner
> market, but if you ever need to pin it, set `ODDS_SPORT_KEY` in `.env` and as
> a repository **variable** (not secret) on GitHub.

## Publishing to GitHub Pages

1. Create a GitHub repository and push this folder to it (branch `main`).
2. In the repository: **Settings → Pages → Build and deployment → Source**,
   choose **GitHub Actions**.
3. Add the `ODDS_API_KEY` secret (see above).

Every push — including the automated data commits — rebuilds and redeploys the
site. The two data jobs also appear under the **Actions** tab, where you can
run either one by hand with the **Run workflow** button.

## The two scheduled jobs (and why there are two)

| Job | When | What it does |
| --- | --- | --- |
| **Snapshot odds** | Daily, 12:00 UTC, all season | One API call (1 credit), appends today's bookmaker odds to `/data/odds/`, commits. Daily cadence is the whole point — a weekly curve would be jagged and near-useless. |
| **Rebuild dashboard** | Mondays 05:00 *Copenhagen time*, only after a race weekend | Refreshes results, standings and schedule, rebuilds derived data, commits. |

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
  of the log — the scripts fail with plain-English messages (missing key, quota
  low, API down). Fix the cause, then press **Run workflow** to re-run it.
- **"Quota guard" error:** the snapshot still succeeded; the job fails loudly
  when fewer than 40 of your 500 monthly credits remain so you find out
  *before* snapshots stop. Usually it means something else is using your key.
- **Jolpica (results) is down:** the job automatically falls back to OpenF1 for
  the latest race and shows a warning until Jolpica recovers. Nothing to do.
- **Want to re-run everything locally:** `npm run backfill` is always safe — it
  re-fetches results from scratch. It never touches the odds files.

## Quota maths (free-tier headroom)

- **The Odds API, Starter plan: 500 credits/month.** Cost per call is
  `markets × regions`; this project requests **one market (outrights) in one
  region (eu)** = **1 credit per snapshot**. Daily snapshots ≈ 30–31
  credits/month — about 6% of the allowance. Even snapshotting twice daily
  during race weeks stays under 70/month. The job logs
  `x-requests-remaining` on every run and fails loudly below 40.
- **Jolpica-F1: free, no key**, rate-limited per IP. The update job makes a
  handful of paginated calls once a week (plus your manual backfills) —
  nowhere near the limits. The scripts pause 300 ms between pages anyway.
- **OpenF1: free, no key.** Only called as a fallback when Jolpica fails.

## What's in the folders

```
src/            the dashboard app (React + TypeScript + Recharts)
src/lib/        the maths: odds normalisation, clinch arithmetic (unit-tested)
scripts/        the jobs: snapshot-odds, update-results, build-derived, backfill
data/odds/      one JSON file per day of bookmaker odds — append-only, precious
data/results/   season results, standings, schedule (rebuildable any time)
data/derived/   files computed from the above (never fetched, always rebuilt)
.github/        the three workflows: two data jobs + the Pages deploy
```

## The odds maths, in one paragraph

A decimal price of 4.0 implies a raw probability of 1/4 = 25%. Summed over the
whole field a bookmaker's raw probabilities exceed 100% — that surplus is their
margin (the *overround* or *vig*). Dividing each raw probability by that sum
removes the margin, so the field sums to exactly 100%. The chart plots, per
driver, the **median** of that vig-free probability across all bookmakers in
the snapshot, with a band from the lowest to the highest bookmaker. Drivers
outside the tracked six are pooled into the grey "Field" line. This is the
market's collective opinion, not a prediction of the future.

Run the tests any time with `npm test`.

---

*Unofficial fan project. Not affiliated with Formula 1, the FIA, or any team.
No F1 or team logos or licensed fonts are used. Odds are informational — this
site is not betting advice.*
