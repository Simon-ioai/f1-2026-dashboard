import { useState } from 'react';

export default function AboutPanel() {
  const [open, setOpen] = useState(false);
  return (
    <section style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 20, boxShadow: 'var(--shadow)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          padding: '18px 26px',
          fontSize: 17,
          fontWeight: 700,
        }}
      >
        New here? What this dashboard is and how it works
        <span style={{ fontSize: 12, color: 'var(--muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: '0 26px 22px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 16, lineHeight: 1.55, color: 'var(--muted)', maxWidth: 860 }}>
          <p style={{ margin: 0 }}>
            This page tracks the <b style={{ color: 'var(--ink)' }}>2026 Formula 1 drivers' championship</b> — not just the
            points, but how the title fight is trending. It updates itself: fresh betting-market
            numbers every day, and full race results every Monday morning after a Grand Prix.
            Nothing here is typed in by hand, and nothing is ever made up — if a data source is
            down, the page shows its last good data with an amber warning instead of guessing.
          </p>
          <p style={{ margin: 0 }}>
            <b style={{ color: 'var(--ink)' }}>The gap</b> places every driver still mathematically alive on one points
            axis — the hatched zone can no longer catch the leader. <b style={{ color: 'var(--ink)' }}>Title probability</b>{' '}
            is each contender's chance according to real people betting real money on{' '}
            <a href="https://polymarket.com/event/2026-f1-drivers-champion" target="_blank" rel="noreferrer">
              Polymarket
            </a>{' '}
            — the ring around each face fills to their chance, and the{' '}
            <b style={{ color: 'var(--ink)' }}>timeline</b> shows the same numbers across the whole season (flags are race
            weekends; click a driver to isolate their line).
          </p>
          <p style={{ margin: 0 }}>
            <b style={{ color: 'var(--ink)' }}>Clinch scenarios</b> is the pure arithmetic of the title;{' '}
            <b style={{ color: 'var(--ink)' }}>Teammate head-to-head</b> compares the only two drivers in equal machinery,
            with the cars spaced by their real median qualifying gap;{' '}
            <b style={{ color: 'var(--ink)' }}>Simulator vs market</b> plays the rest of the season out 20,000 times and
            shows where the toy model disagrees with the market; the{' '}
            <b style={{ color: 'var(--ink)' }}>Form index</b> shows who is hot or cold right now.
          </p>
          <p style={{ margin: 0 }}>
            Market probabilities are opinions with money behind them, not facts about the future
            — and "mathematically alive" can mean needing to win every remaining race. None of
            this is betting advice.
          </p>
        </div>
      )}
    </section>
  );
}
