// Teammate head-to-head per the handoff: a track strip where two top-down
// cars in the team colour sit spaced by the real median qualifying gap at
// 230 km/h (one track tick = one car length of 5.63 m).

import Face from './Face';
import { driverView, lastName } from '../lib/driverInfo';
import type { H2HFile } from '../lib/data';

const CAR = 96; // rendered car length in px
const SPEED = 230 / 3.6; // m/s
const CARLEN = 5.63; // metres

const TEAM_COLOR: Record<string, string> = {
  Mercedes: 'var(--ant)',
  Ferrari: 'var(--lec)',
  McLaren: 'var(--nor)',
  'Red Bull': 'var(--ver)',
};

/** The pure-CSS top-down car from the design (56x20, scaled 1.7x). */
function TopDownCar({ color }: { color: string }) {
  const wheel = (style: React.CSSProperties) => (
    <div style={{ position: 'absolute', borderRadius: 2, background: 'var(--wheel)', ...style }} />
  );
  return (
    <div style={{ width: CAR, height: 40, display: 'flex', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: 56, height: 20, transform: 'scale(1.7)', transformOrigin: 'left center' }}>
        <div style={{ position: 'absolute', left: 0, top: 2, width: 5, height: 16, borderRadius: 1, background: color }} />
        {wheel({ left: 7, top: 0, width: 11, height: 5 })}
        {wheel({ left: 7, bottom: 0, width: 11, height: 5 })}
        <div
          style={{
            position: 'absolute',
            left: 4,
            top: 6,
            width: 48,
            height: 8,
            background: color,
            clipPath: 'polygon(0 0, 52% 0, 100% 38%, 100% 62%, 52% 100%, 0 100%)',
          }}
        />
        <div style={{ position: 'absolute', left: 13, top: 4, width: 18, height: 12, borderRadius: 4, background: color }} />
        {wheel({ left: 22, top: 8, width: 8, height: 4 })}
        {wheel({ left: 39, top: 1, width: 9, height: 4 })}
        {wheel({ left: 39, bottom: 1, width: 9, height: 4 })}
        <div style={{ position: 'absolute', left: 51, top: 2, width: 4, height: 16, borderRadius: 1, background: color }} />
      </div>
    </div>
  );
}

export default function H2HPanel({ h2h }: { h2h: H2HFile }) {
  return (
    <section className="panel" aria-label="Teammate head-to-head">
      <div className="panel-head">
        <h2 className="panel-title">Teammate head-to-head</h2>
        <p className="panel-sub">
          The only equal machinery on the grid. Qualifying gaps compare the deepest session both
          cars set a time in; race record counts only races where both were classified. Cars are
          drawn to scale and spaced by the median gap at 230 km/h — each track tick is one car
          length.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 500px), 1fr))', gap: 14 }}>
        {h2h.teams.map((t) => {
          const teamColor = TEAM_COLOR[t.team] ?? 'var(--field)';
          const A = driverView(t.primary.driverId, t.primary.code);
          const partners = t.partners.map((p) => ({ p, view: driverView(p.driverId, p.code) }));
          const B = partners[0];
          const gap = t.overall.medianGapMs;
          const gapS = gap === null ? null : Math.abs(gap) / 1000;
          const metres = gapS === null ? null : gapS * SPEED;
          const offPx = metres === null ? 0 : Math.max(0, Math.round((metres / CARLEN) * CAR));
          const primaryLeads = (gap ?? 0) <= 0;
          const aheadView = primaryLeads ? A : B.view;
          const behindView = primaryLeads ? B.view : A;
          const aheadName = primaryLeads ? lastName(t.primary.name) : partners.map((x) => lastName(x.p.name)).join(' / ');
          const labelRight = offPx > 60 ? 26 + offPx / 2 : 26 + CAR + 70;
          const totalPts = t.primary.points + t.partners.reduce((s, p) => s + p.points, 0);
          const maxAbs = Math.max(0.45, ...t.trend.map((x) => (x.gapMs === null ? 0 : Math.abs(x.gapMs) / 1000)));
          return (
            <div key={t.team} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  {t.team}
                </span>
                <span style={{ fontSize: 17, fontWeight: 700 }}>
                  <span style={{ color: A.color }}>{lastName(t.primary.name)}</span>{' '}
                  <span style={{ fontWeight: 400, fontSize: 14, color: 'var(--muted)' }}>vs</span>{' '}
                  <span style={{ color: B.view.color }}>{partners.map((x) => lastName(x.p.name)).join(' / ')}</span>
                </span>
              </div>

              {gap !== null && (
                <div className="hscroll">
                <div
                  style={{
                    position: 'relative',
                    height: 112,
                    minWidth: Math.min(460, 26 + offPx + CAR + 60),
                    borderRadius: 12,
                    backgroundColor: 'var(--sunk)',
                    backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 95px, var(--line2) 95px 96px)',
                    backgroundPosition: 'right 26px top 0',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      right: 26,
                      width: 10,
                      background: 'repeating-linear-gradient(0deg, var(--ink) 0 5px, var(--panel) 5px 10px)',
                      backgroundSize: '5px 10px',
                      opacity: 0.5,
                    }}
                  />
                  <div style={{ position: 'absolute', top: 56, right: 26, width: offPx, borderTop: '1px solid var(--ink)', opacity: 0.45 }} />
                  <div
                    className="num"
                    style={{
                      position: 'absolute',
                      top: 47,
                      right: labelRight,
                      transform: 'translateX(50%)',
                      fontSize: 12,
                      fontWeight: 700,
                      background: 'var(--sunk)',
                      padding: '0 5px',
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {metres !== null && (metres < 1 ? `${(metres * 100).toFixed(0)} cm` : `${metres.toFixed(1)} m`)}
                  </div>
                  {[
                    { view: aheadView, top: 8, right: 26 },
                    { view: behindView, top: 64, right: 26 + offPx },
                  ].map((car, i) => (
                    <div key={i} style={{ position: 'absolute', top: car.top, right: car.right, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Face d={car.view} size={30} ringBg="var(--sunk)" />
                      <TopDownCar color={teamColor} />
                    </div>
                  ))}
                </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="big-num" style={{ fontSize: 30, lineHeight: 1.1 }}>
                    {t.overall.qualiWins}–{t.overall.qualiLosses}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--muted)' }}>Qualifying</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="big-num" style={{ fontSize: 30, lineHeight: 1.1 }}>
                    {t.overall.raceWins}–{t.overall.raceLosses}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--muted)' }}>Race (both classified)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="big-num" style={{ fontSize: 30, lineHeight: 1.1 }}>
                    {gapS === null ? '—' : `${gapS.toFixed(3)}s`}
                  </span>
                  <span style={{ fontSize: 14, lineHeight: 1.35, color: 'var(--muted)' }}>
                    {gap === null ? 'No comparable laps' : `Median quali gap · ${aheadName} ahead (${t.overall.comparableLaps} laps)`}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
                  <div style={{ width: `${((t.primary.points / totalPts) * 100).toFixed(1)}%`, background: A.color }} />
                  {partners.map((x) => (
                    <div key={x.p.driverId} style={{ flex: x.p.points, background: x.view.color, opacity: 0.55 }} />
                  ))}
                </div>
                <span className="num" style={{ fontSize: 14, color: 'var(--muted)' }}>
                  {t.primary.points} · {t.partners.map((p) => p.points).join(' · ')} pts
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ position: 'relative', height: 64, display: 'flex', gap: 4 }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, top: 32, borderTop: '1px solid var(--line2)' }} />
                  {t.trend.map((x) => {
                    if (x.gapMs === null) {
                      return <div key={x.round} title={`${x.locality} — no comparable lap`} style={{ position: 'relative', flex: 1 }} />;
                    }
                    const primaryFaster = x.gapMs < 0;
                    const partnerView = partners.find((p) => p.p.driverId === x.partnerId)?.view ?? B.view;
                    const h = Math.max(2, Math.round(Math.min(1, Math.abs(x.gapMs) / 1000 / maxAbs) * 30));
                    return (
                      <div key={x.round} title={`${x.locality}: ${(Math.abs(x.gapMs) / 1000).toFixed(3)}s (${x.session})`} style={{ position: 'relative', flex: 1 }}>
                        <div
                          style={{
                            position: 'absolute',
                            left: '15%',
                            right: '15%',
                            top: primaryFaster ? 32 : 32 - h,
                            height: h,
                            borderRadius: 2,
                            background: primaryFaster ? A.color : partnerView.color,
                            opacity: primaryFaster ? 1 : 0.75,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <span style={{ fontSize: 14, lineHeight: 1.4, color: 'var(--muted)' }}>
                  Qualifying gap per round — bars below the line: {lastName(t.primary.name)} faster
                  {t.partners.length > 1 &&
                    ` · ${t.partners.map((p) => `vs ${lastName(p.name)}: ${p.rounds} rounds`).join(', ')}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
