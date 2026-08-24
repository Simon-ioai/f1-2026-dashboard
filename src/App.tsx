import { useEffect, useState } from 'react';
import Leaderboard from './components/Leaderboard';
import MoverCallout from './components/MoverCallout';
import TimelineChart from './components/TimelineChart';
import { loadDashboardData, type DashboardData } from './lib/data';

function ago(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 60) return `${mins} min ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / (24 * 60))} days ago`;
}

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    loadDashboardData().then(setData);
  }, []);

  if (!data) {
    return (
      <div className="shell">
        <div className="empty">
          <h3>Loading…</h3>
        </div>
      </div>
    );
  }

  const { timeline, standings, meta } = data;
  const hasOdds = (timeline?.points.length ?? 0) > 0;

  return (
    <div className="shell">
      <header className="masthead">
        <h1>
          Title Race <span className="accent">2026</span>
        </h1>
        <span className="season-tag">Formula 1 · Championship Dashboard</span>
      </header>

      <div className="statusbar num">
        <span>Odds updated: {ago(meta?.odds_updated_at)}</span>
        <span>Results updated: {ago(meta?.results_updated_at)}</span>
        {(meta?.warnings ?? []).map((w, i) => (
          <span className="badge-warn" key={i} title={w.at}>
            ⚠ {w.message}
          </span>
        ))}
        {data.fetchErrors.length > 0 && (
          <span className="badge-warn">⚠ Some data files failed to load</span>
        )}
      </div>

      <Leaderboard timeline={timeline} standings={standings} />

      <section className="panel" style={{ marginTop: 18 }} aria-label="Title odds timeline">
        <h2 className="panel-title">Title odds timeline</h2>
        <p className="panel-sub">
          Implied championship-win probability from bookmaker outright markets, snapshotted daily.
        </p>
        {hasOdds && timeline ? (
          <>
            <TimelineChart timeline={timeline} />
            <MoverCallout timeline={timeline} />
          </>
        ) : (
          <div className="empty">
            <h3>Waiting for the first odds snapshot</h3>
            <p>
              Historical odds can’t be backfilled on the free plan, so this chart starts the day
              the first snapshot is taken — from then on it grows one point per day,
              automatically.
            </p>
            <p>
              To start capturing: add your free The Odds API key (see the README), then run{' '}
              <code>npm run snapshot:odds</code> or trigger the <em>Snapshot odds</em> workflow on
              GitHub.
            </p>
          </div>
        )}
      </section>

      <footer className="footer">
        Data: race results, standings and schedule from{' '}
        <a href="https://jolpi.ca" target="_blank" rel="noreferrer">
          Jolpica-F1
        </a>{' '}
        (OpenF1 fallback) · winner odds from{' '}
        <a href="https://the-odds-api.com" target="_blank" rel="noreferrer">
          The Odds API
        </a>
        , vig removed by normalising over the whole field. Probabilities are the market’s view,
        not a prediction. Unofficial fan project — not associated with Formula 1.
      </footer>
    </div>
  );
}
