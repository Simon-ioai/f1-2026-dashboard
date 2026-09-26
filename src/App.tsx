import { useEffect, useState } from 'react';
import AboutPanel from './components/AboutPanel';
import ClinchPanel from './components/ClinchPanel';
import FormPanel from './components/FormPanel';
import H2HPanel from './components/H2HPanel';
import Leaderboard from './components/Leaderboard';
import MoverCallout from './components/MoverCallout';
import Simulator from './components/Simulator';
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

  const { timeline, standings, simulations, clinch, h2h, form, meta } = data;
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
        {(() => {
          // Self-diagnosed staleness: the Sep 2026 outage showed the pipeline
          // can look healthy while the deployed data quietly ages.
          const updated = meta?.odds_updated_at;
          const ageDays = updated ? (Date.now() - Date.parse(updated)) / 86_400_000 : null;
          return ageDays !== null && ageDays > 2.5 ? (
            <span className="badge-warn">
              ⚠ Odds data is {Math.floor(ageDays)} days old — the daily update may be stuck
            </span>
          ) : null;
        })()}
      </div>

      <AboutPanel />

      <Leaderboard timeline={timeline} standings={standings} />

      <section className="panel" style={{ marginTop: 18 }} aria-label="Title odds timeline">
        <h2 className="panel-title">Title odds timeline</h2>
        <p className="panel-sub">
          Implied championship-win probability from Polymarket's title market, tracked daily since
          December 2025.
        </p>
        {hasOdds && timeline ? (
          <>
            <TimelineChart timeline={timeline} />
            <MoverCallout timeline={timeline} />
          </>
        ) : (
          <div className="empty">
            <h3>No odds data yet</h3>
            <p>
              Run <code>npm run backfill:odds-history</code> once to pull the season so far from
              Polymarket, then <code>npm run snapshot:odds</code> (or the <em>Snapshot odds</em>{' '}
              workflow on GitHub) keeps it growing daily.
            </p>
          </div>
        )}
      </section>

      {clinch && <ClinchPanel clinch={clinch} />}

      {h2h && <H2HPanel h2h={h2h} />}

      {simulations && <Simulator simulations={simulations} timeline={timeline} />}

      {form && <FormPanel form={form} />}

      <footer className="footer">
        Data: race results, standings and schedule from{' '}
        <a href="https://jolpi.ca" target="_blank" rel="noreferrer">
          Jolpica-F1
        </a>{' '}
        (OpenF1 fallback) · title probabilities from{' '}
        <a href="https://polymarket.com/event/2026-f1-drivers-champion" target="_blank" rel="noreferrer">
          Polymarket
        </a>
        's championship market, normalised over the whole field. Probabilities are the market's
        view, not a prediction, and not betting advice. Unofficial fan project — not associated
        with Formula 1.
      </footer>
    </div>
  );
}
