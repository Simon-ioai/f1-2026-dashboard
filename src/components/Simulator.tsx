// Simulator vs market per the handoff: each row is a 0-100% track with the
// model value as a face and the market value as an outlined ring; below, the
// simulated final points as a ridgeline on one shared axis, drawn from the
// real Monte Carlo histograms.

import Face from './Face';
import { driverView, lastName } from '../lib/driverInfo';
import { TRACKED_DRIVERS } from '../lib/drivers';
import type { SimulationsFile, Timeline } from '../lib/data';

const MATERIAL_GAP_PP = 3;
const R0 = 180;
const R1 = 540;
const rx = (v: number) => ((v - R0) / (R1 - R0)) * 1000;

export default function Simulator({
  simulations,
  timeline,
}: {
  simulations: SimulationsFile;
  timeline: Timeline | null;
}) {
  const latest = timeline?.points[timeline.points.length - 1] ?? null;
  const byId = new Map(simulations.drivers.map((d) => [d.driverId, d]));
  const method = simulations.method;

  const rows = TRACKED_DRIVERS.map((driver) => {
    const sim = byId.get(driver.id);
    if (!sim) return null;
    const market = latest?.byId[driver.id] ? latest.byId[driver.id].median * 100 : null;
    const model = sim.titleProb * 100;
    return { driver, view: driverView(driver.id, driver.code), sim, model, market };
  })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.model - a.model);

  const ridges = rows.map((r) => {
    const hist = simulations.histograms[r.driver.id];
    let line = '';
    if (hist) {
      const maxCount = Math.max(...hist.counts, 1);
      const pts = hist.counts.map((c, i) => {
        const v = hist.binStart + i * hist.binWidth + hist.binWidth / 2;
        return `${(60 - (c / maxCount) * 58).toFixed(1)}|${rx(v).toFixed(1)}`;
      });
      line = pts.map((p, i) => {
        const [py, px] = p.split('|');
        return `${i ? 'L' : 'M'}${px},${py}`;
      }).join('');
    }
    return {
      ...r,
      line,
      area: line ? `${line}L1000,60L0,60Z` : '',
      now: rx(r.sim.currentPoints) / 10,
      range: `${r.sim.p5}–${r.sim.p95}`,
    };
  });

  return (
    <section className="panel" aria-label="Monte Carlo simulator">
      <div className="panel-head">
        <h2 className="panel-title">Simulator vs market</h2>
        <p className="panel-sub num">
          {method.iterations.toLocaleString('en-GB')} season simulations from real finishing form
          (rounds 1–{method.based_on_rounds}, last {method.recent_window} weighted{' '}
          {method.recent_weight}×, DNF rates from actual retirements) · {method.remaining_races}{' '}
          races left
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((r) => {
          const diff = r.market === null ? null : r.model - r.market;
          const big = diff !== null && Math.abs(diff) >= MATERIAL_GAP_PP;
          const pillColor = big ? (diff! > 0 ? 'var(--up)' : 'var(--down)') : 'var(--muted)';
          return (
            <div
              key={r.driver.id}
              className="sim-row"
              style={{ display: 'grid', gridTemplateColumns: '130px minmax(0,1fr) 150px 120px', alignItems: 'center', gap: 16, minHeight: 44 }}
            >
              <span style={{ fontSize: 16, fontWeight: 700 }}>{r.driver.lastName}</span>
              <div style={{ position: 'relative', height: 36, margin: '0 16px' }}>
                <div style={{ position: 'absolute', left: -16, right: -16, top: 15, height: 6, borderRadius: 3, background: 'var(--sunk)' }} />
                {r.market !== null && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 17,
                      height: 2,
                      left: `${Math.min(r.model, r.market)}%`,
                      width: `${Math.abs(r.model - r.market)}%`,
                      background: r.view.color,
                    }}
                  />
                )}
                {r.market !== null && (
                  <div
                    title={`Market (Polymarket): ${r.market.toFixed(1)}%`}
                    style={{
                      position: 'absolute',
                      left: `${r.market}%`,
                      top: 18,
                      width: 16,
                      height: 16,
                      margin: '-8px 0 0 -8px',
                      borderRadius: '50%',
                      border: `2.5px solid ${r.view.color}`,
                      background: 'var(--panel)',
                    }}
                  />
                )}
                <div
                  title={`Model: ${r.model.toFixed(1)}%`}
                  style={{ position: 'absolute', left: `${r.model}%`, top: 18, margin: '-15px 0 0 -15px', borderRadius: '50%', boxShadow: '0 0 0 2px var(--panel)' }}
                >
                  <Face d={r.view} size={30} />
                </div>
              </div>
              <span className="num" style={{ fontSize: 16, textAlign: 'right', whiteSpace: 'nowrap' }}>
                <strong>{r.model.toFixed(1)}%</strong>{' '}
                <span style={{ color: 'var(--muted)' }}>vs {r.market === null ? '—' : r.market.toFixed(1) + '%'}</span>
              </span>
              <span
                className="num"
                style={{
                  justifySelf: 'end',
                  padding: '3px 12px',
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  color: pillColor,
                  border: `1px solid ${big ? pillColor : 'var(--line)'}`,
                }}
              >
                {big ? `model ${diff! > 0 ? '+' : '−'}${Math.abs(diff!).toFixed(1)} pp` : '≈ market'}
              </span>
            </div>
          );
        })}
      </div>

      <div className="help-note">
        Face = this model, outlined ring = Polymarket. Where the model is materially more bullish
        than the market, the market usually knows something the finishing statistics don't —
        reliability risk, upgrades, momentum. Trust the gap as a conversation starter, not an
        edge.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
        <div className="panel-head" style={{ paddingTop: 14 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase' }}>
            Simulated final points
          </h3>
          <p className="panel-sub">
            One shared axis, so the overlaps show who is really in reach. Tick marks each
            driver's current total.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr)', gap: '0 16px' }}>
          {ridges.map((r) => (
            <div key={r.driver.id} style={{ display: 'contents' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 46, alignSelf: 'end' }}>
                <Face d={r.view} size={30} title={`${r.driver.firstName} ${r.driver.lastName}`} />
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{r.driver.lastName}</span>
                  <span className="num" style={{ fontSize: 12, color: 'var(--muted)' }}>{r.range} pts</span>
                </div>
              </div>
              <div style={{ position: 'relative', height: 46 }}>
                <div style={{ position: 'absolute', left: `${r.now}%`, bottom: 0, height: 14, borderLeft: '2px solid var(--ink)', opacity: 0.5 }} />
                <svg viewBox="0 0 1000 60" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: 60, overflow: 'visible' }}>
                  {r.area && <path d={r.area} fill={r.view.color} opacity="0.22" />}
                  {r.line && <path d={r.line} fill="none" stroke={r.view.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />}
                  <line x1="0" x2="1000" y1="60" y2="60" stroke="var(--line2)" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
            </div>
          ))}
          <div />
          <div style={{ position: 'relative', height: 22, marginTop: 6 }}>
            {[200, 250, 300, 350, 400, 450, 500].map((v) => (
              <span key={v} className="num" style={{ position: 'absolute', left: `${rx(v) / 10}%`, transform: 'translateX(-50%)', fontSize: 12, color: 'var(--muted)' }}>
                {v}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="warn-box">
        <span className="bar" />
        <span>
          A toy model, honestly labelled: it resamples {method.based_on_rounds} rounds of
          finishing positions and knows nothing about car upgrades, track characteristics,
          weather, driver market moves or team orders. With this small a sample, treat the
          probabilities as rough — the betting market's number is the better forecast.
        </span>
      </div>
    </section>
  );
}

export { lastName };
