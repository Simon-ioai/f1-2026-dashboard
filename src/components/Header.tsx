import Face from './Face';
import { driverView } from '../lib/driverInfo';
import { flagFor } from '../lib/flags';
import type { ClinchFile, Meta, Timeline } from '../lib/data';

function ago(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 60) return `${mins} min ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / (24 * 60))} days ago`;
}

/** Lane geometry from the handoff: above/below short stems, then tall ones. */
const LANES = [
  { top: 42, dir: 'column' as const, stem: 14 },
  { top: 127, dir: 'column-reverse' as const, stem: 14 },
  { top: 2, dir: 'column' as const, stem: 54 },
  { top: 127, dir: 'column-reverse' as const, stem: 54 },
];
const AXIS_MAX = 300;

export default function Header({
  meta,
  clinch,
  timeline,
  staleBadge,
}: {
  meta: Meta | null;
  clinch: ClinchFile | null;
  timeline: Timeline | null;
  staleBadge: string | null;
}) {
  // Next race: first calendar entry without a result, not in the past.
  const now = Date.now();
  const next = timeline?.races.find(
    (r) => !r.winner && Date.parse(r.date) > now - 36 * 3600 * 1000,
  );
  const nextFlag = next ? flagFor(next.country) : null;
  const nextIsClose = next && Date.parse(next.date) - now < 5 * 86_400_000;

  // Gap strip: every mathematically alive driver on a 0-300 pts axis.
  const alive = (clinch?.drivers ?? []).filter((d) => d.status !== 'eliminated');
  const leader = alive[0];
  const outPct =
    clinch && leader ? Math.max(0, ((leader.points - clinch.points_available) / AXIS_MAX) * 100) : 0;
  const lanes: number[][] = [[], [], [], []];
  const strip = alive.map((d) => {
    const pct = (d.points / AXIS_MAX) * 100;
    let lane = lanes.findIndex((l) => !l.length || Math.abs(l[l.length - 1] - pct) >= 7.5);
    if (lane < 0) lane = 0;
    lanes[lane].push(pct);
    return { d, view: driverView(d.driverId, d.code), pct, ...LANES[lane] };
  });

  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div className="masthead" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px 18px' }}>
        <h1>
          TITLE RACE <span style={{ fontWeight: 300 }}>2026</span>
        </h1>
        <div className="eyebrow">Formula 1 · Championship dashboard</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <div className="pill num">
          <span className="live-dot" />
          Odds updated: {ago(meta?.odds_updated_at)}
        </div>
        <div className="pill num">Results updated: {ago(meta?.results_updated_at)}</div>
        {next && (
          <div className="pill next">
            {nextFlag && <img className="pill-flag" src={nextFlag} alt="" />}
            Next: {next.locality} · {nextIsClose ? 'this weekend' : new Date(next.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </div>
        )}
        {(meta?.warnings ?? []).map((w, i) => (
          <span className="badge-warn" key={i} title={w.at}>
            ⚠ {w.message}
          </span>
        ))}
        {staleBadge && <span className="badge-warn">⚠ {staleBadge}</span>}
      </div>

      {clinch && alive.length > 0 && leader && (
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 20,
            boxShadow: 'var(--shadow)',
            padding: '22px 26px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              The gap · championship points
            </div>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>
              Hatched: can no longer catch {leader.name.split(' ').slice(-1)[0]}, with{' '}
              {clinch.points_available} points left
            </div>
          </div>
          <div className="hscroll">
          <div style={{ position: 'relative', height: 250, margin: '0 18px', minWidth: 540 }}>
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 22,
                left: 0,
                width: `${outPct.toFixed(2)}%`,
                background: 'repeating-linear-gradient(135deg, var(--hatch) 0 6px, transparent 6px 12px)',
                borderRight: '1px dashed var(--line2)',
              }}
            />
            <div style={{ position: 'absolute', left: -18, right: -18, top: 121, height: 6, borderRadius: 3, background: 'var(--sunk)' }} />
            {[0, 50, 100, 150, 200, 250, 300].map((v) => (
              <div
                key={v}
                className="num"
                style={{ position: 'absolute', bottom: 0, left: `${(v / AXIS_MAX) * 100}%`, transform: 'translateX(-50%)', fontSize: 12, color: 'var(--muted)' }}
              >
                {v}
              </div>
            ))}
            {strip.map((m) => (
              <div
                key={m.d.driverId}
                style={{
                  position: 'absolute',
                  left: `${m.pct}%`,
                  top: m.top,
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: m.dir,
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Face d={m.view} size={36} ring title={m.d.name} />
                <div className="num" style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', lineHeight: '14px' }}>
                  {m.view.code} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>{m.d.points}</span>
                </div>
                <div style={{ width: 2, height: m.stem, background: m.view.color, opacity: 0.55 }} />
              </div>
            ))}
          </div>
          </div>
        </div>
      )}
    </header>
  );
}
