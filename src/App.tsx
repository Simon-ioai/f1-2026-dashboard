import { useEffect, useState } from 'react';
import AboutPanel from './components/AboutPanel';
import ClinchPanel from './components/ClinchPanel';
import FormPanel from './components/FormPanel';
import H2HPanel from './components/H2HPanel';
import Header from './components/Header';
import Leaderboard from './components/Leaderboard';
import Simulator from './components/Simulator';
import Timeline from './components/Timeline';
import { loadDashboardData, type DashboardData } from './lib/data';

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    loadDashboardData().then(setData);
  }, []);

  if (!data) {
    return (
      <div className="shell">
        <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
      </div>
    );
  }

  const { timeline, standings, simulations, clinch, h2h, form, meta } = data;
  const hasOdds = (timeline?.points.length ?? 0) > 0;

  // Self-diagnosed staleness: the pipeline can look healthy while the
  // deployed data quietly ages.
  const oddsAge = meta?.odds_updated_at ? (Date.now() - Date.parse(meta.odds_updated_at)) / 86_400_000 : null;
  const staleBadge =
    oddsAge !== null && oddsAge > 2.5
      ? `Odds data is ${Math.floor(oddsAge)} days old — the daily update may be stuck`
      : null;

  return (
    <div className="shell">
      <Header meta={meta} clinch={clinch} timeline={timeline} staleBadge={staleBadge} />

      <AboutPanel />

      <Leaderboard timeline={timeline} standings={standings} />

      {hasOdds && timeline ? (
        <Timeline timeline={timeline} />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Title odds timeline</h2>
          </div>
          <p className="panel-sub">
            No odds data yet — run <code>npm run backfill:odds-history</code> once, then{' '}
            <code>npm run snapshot:odds</code> keeps it growing daily.
          </p>
        </section>
      )}

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
        's championship market, normalised over the whole field. Driver portraits from Wikimedia
        Commons, used under their CC licences. Probabilities are the market's view, not a
        prediction, and not betting advice. Unofficial fan project — not associated with Formula
        1.
      </footer>
    </div>
  );
}
