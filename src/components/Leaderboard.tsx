import Face from './Face';
import { driverView } from '../lib/driverInfo';
import { TRACKED_DRIVERS } from '../lib/drivers';
import type { StandingsFile, Timeline, TimelinePoint } from '../lib/data';

const DAY = 86_400_000;
const C = 2 * Math.PI * 33; // ring circumference (r=33 in a 72 viewBox)

function latestAndWeekAgo(points: TimelinePoint[]): [TimelinePoint | null, TimelinePoint | null] {
  if (points.length === 0) return [null, null];
  const latest = points[points.length - 1];
  const target = Date.parse(latest.date) - 7 * DAY;
  const earlier = points.filter((p) => Date.parse(p.date) <= target);
  return [latest, earlier.length > 0 ? earlier[earlier.length - 1] : null];
}

function Ring({ pct, color, size, inset, face }: { pct: number; color: string; size: number; inset: number; face: React.ReactNode }) {
  const dash = `${Math.max(1.5, (C * pct) / 100).toFixed(1)} ${C.toFixed(1)}`;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg viewBox="0 0 72 72" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle cx="36" cy="36" r="33" fill="none" stroke="var(--sunk)" strokeWidth="3.5" />
        <circle cx="36" cy="36" r="33" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={dash} />
      </svg>
      <div style={{ position: 'absolute', inset, borderRadius: '50%', overflow: 'hidden', display: 'grid' }}>{face}</div>
    </div>
  );
}

export default function Leaderboard({
  timeline,
  standings,
}: {
  timeline: Timeline | null;
  standings: StandingsFile | null;
}) {
  const [latest, weekAgo] = latestAndWeekAgo(timeline?.points ?? []);

  const cards = latest
    ? TRACKED_DRIVERS.map((driver) => {
        const now = latest.byId[driver.id];
        const prev = weekAgo?.byId[driver.id];
        return {
          driver,
          view: driverView(driver.id, driver.code),
          value: now ? now.median * 100 : null,
          delta: now && prev ? (now.median - prev.median) * 100 : null,
        };
      }).sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
    : null;

  if (!cards) {
    if (!standings) return null;
  }

  return (
    <section className="panel" aria-label="Title probability">
      <div className="panel-head">
        <h2 className="panel-title">Title probability</h2>
        <p className="panel-sub num">
          {cards
            ? `Market-implied (Polymarket), normalised · ${latest!.date}${weekAgo ? ' · Δ vs 7 days' : ''} · the ring fills to each driver's chance`
            : `Championship standings after round ${standings!.round} — title probabilities appear once odds data loads`}
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {(cards ?? []).map((c, i) => {
          const big = i === 0;
          const size = big ? 120 : 64;
          const inset = big ? 9 : 6;
          const chg = c.delta;
          const chgLabel =
            chg === null ? '' : (chg > 0.05 ? '▲ ' : '▼ ') + Math.abs(chg).toFixed(1);
          const chgColor =
            chg === null || Math.abs(chg) <= 0.05 ? 'var(--muted)' : chg > 0 ? 'var(--up)' : 'var(--down)';
          return (
            <div
              key={c.driver.id}
              className="card"
              style={{
                gridColumn: big ? 'span 2' : 'auto',
                padding: 18,
                display: 'flex',
                flexDirection: big ? 'row' : 'column',
                alignItems: big ? 'center' : 'flex-start',
                gap: 18,
              }}
            >
              <Ring
                pct={c.value ?? 0}
                color={c.view.color}
                size={size}
                inset={inset}
                face={<Face d={c.view} size={size - inset * 2} title={`${c.driver.firstName} ${c.driver.lastName}`} />}
              />
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '.1em', color: 'var(--muted)' }}>P{i + 1}</span>
                  <span className="num" style={{ fontSize: 15, fontWeight: 700, color: chgColor }}>{chgLabel}</span>
                </div>
                <div className="big-num" style={{ fontSize: big ? 68 : 40, lineHeight: 1.25 }}>
                  {c.value !== null ? c.value.toFixed(1) : '—'}
                  <span style={{ fontSize: '.42em', fontWeight: 600 }}>%</span>
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2, marginTop: 4 }}>
                  {c.driver.firstName} {c.driver.lastName}
                </div>
                <div style={{ fontSize: 15, color: 'var(--muted)' }}>{c.driver.team}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
