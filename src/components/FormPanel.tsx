// Form index per the handoff: face + Δ pill header, two custom SVG
// sparklines (points avg 2.2px, quali avg 1.6px at 70%) with a dashed
// season-baseline line, break-out dots kept from the real data.

import Face from './Face';
import { driverView } from '../lib/driverInfo';
import { TRACKED_DRIVERS } from '../lib/drivers';
import type { FormFile } from '../lib/data';

const DRIVER = new Map(TRACKED_DRIVERS.map((d) => [d.id, d]));
const W = 200;
const CH = 40;

function sparkPath(values: number[], invert = false): { d: string; yFor: (v: number) => number } {
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const span = mx - mn || 1;
  const yFor = (v: number) => {
    const frac = (v - mn) / span;
    return CH - (invert ? 1 - frac : frac) * (CH - 4);
  };
  const d = values
    .map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * W).toFixed(1)},${yFor(v).toFixed(1)}`)
    .join('');
  return { d, yFor };
}

export default function FormPanel({ form }: { form: FormFile }) {
  return (
    <section className="panel" aria-label="Form index">
      <div className="panel-head">
        <h2 className="panel-title">Form index</h2>
        <p className="panel-sub">
          Rolling 3-weekend averages — who is actually trending, independent of the championship
          gap. Dashed line: season baseline. Marked dots: weekends where a driver's form broke
          away from their normal range.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
        {form.drivers.map((d) => {
          const driver = DRIVER.get(d.driverId);
          const view = driverView(d.driverId, d.code);
          const rounds = d.rounds;
          if (rounds.length < 2) return null;
          const latest = rounds[rounds.length - 1];
          const trend = latest.pointsAvg - d.baselinePoints;

          const pv = rounds.map((r) => r.pointsAvg);
          const points = sparkPath(pv);
          const qualiVals = rounds.map((r) => r.qualiAvg).filter((q): q is number => q !== null);
          const quali = qualiVals.length > 1 ? sparkPath(qualiVals, true) : null;
          const qualiBaseline = d.baselineQuali;

          const charts = [
            {
              label: 'Points per weekend (3-race avg)',
              d: points.d,
              base: points.yFor(Math.max(Math.min(d.baselinePoints, Math.max(...pv)), Math.min(...pv))),
              w: 2.2,
              op: 1,
              dots: rounds
                .map((r, i) => ({ r, i }))
                .filter(({ r }) => r.diverged)
                .map(({ r, i }) => ({
                  x: (i / (rounds.length - 1)) * W,
                  y: points.yFor(r.pointsAvg),
                  title: `${r.locality}: form break (3-race avg ${r.pointsAvg.toFixed(1)} vs baseline ${d.baselinePoints.toFixed(1)})`,
                })),
            },
            quali && qualiBaseline !== null
              ? {
                  label: 'Qualifying position (3-race avg, up = better)',
                  d: quali.d,
                  base: quali.yFor(Math.max(Math.min(qualiBaseline, Math.max(...qualiVals)), Math.min(...qualiVals))),
                  w: 1.6,
                  op: 0.7,
                  dots: [] as { x: number; y: number; title: string }[],
                }
              : null,
          ].filter((c): c is NonNullable<typeof c> => c !== null);

          return (
            <div key={d.driverId} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Face d={view} size={40} ring ringBg="var(--panel2)" title={d.name} />
                <span style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>{driver?.lastName ?? d.name}</span>
                <span
                  className="num"
                  style={{
                    padding: '2px 10px',
                    borderRadius: 999,
                    fontSize: 15,
                    fontWeight: 700,
                    color: trend > 1 ? 'var(--up)' : trend < -1 ? 'var(--down)' : 'var(--muted)',
                    background: 'var(--sunk)',
                  }}
                  title="Current 3-race points average vs season baseline"
                >
                  {trend > 1 ? '▲ ' : trend < -1 ? '▼ ' : '• '}
                  {Math.abs(trend).toFixed(1)}
                </span>
              </div>
              {charts.map((g) => (
                <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{g.label}</span>
                  <svg viewBox={`0 0 ${W} ${CH + 4}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                    <line x1="0" x2={W} y1={g.base} y2={g.base} stroke="var(--line2)" strokeDasharray="4 4" />
                    <path d={g.d} fill="none" stroke={view.color} strokeWidth={g.w} opacity={g.op} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                    {g.dots.map((dot, i) => (
                      <g key={i}>
                        <circle cx={dot.x} cy={dot.y} r={6} fill={view.color} opacity={0.25}>
                          <title>{dot.title}</title>
                        </circle>
                        <circle cx={dot.x} cy={dot.y} r={2.8} fill={view.color}>
                          <title>{dot.title}</title>
                        </circle>
                      </g>
                    ))}
                  </svg>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
