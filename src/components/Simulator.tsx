import { Area, AreaChart, ResponsiveContainer, XAxis } from 'recharts';
import { TRACKED_DRIVERS } from '../lib/drivers';
import type { SimulationsFile, Timeline } from '../lib/data';

/** Gap (in percentage points) at which model vs market is worth flagging. */
const MATERIAL_GAP_PP = 3;

interface Row {
  driver: (typeof TRACKED_DRIVERS)[number];
  model: number; // 0..100
  market: number | null; // 0..100
  gap: number | null; // model - market, pp
  p5: number;
  p50: number;
  p95: number;
}

function DensityCell({
  row,
  histogram,
}: {
  row: Row;
  histogram: { binStart: number; binWidth: number; counts: number[] } | undefined;
}) {
  if (!histogram) return null;
  const data = histogram.counts.map((count, i) => ({
    points: histogram.binStart + i * histogram.binWidth + histogram.binWidth / 2,
    count,
  }));
  return (
    <div className="density-cell">
      <div className="density-head">
        <span className="density-name">
          <span className="dot" style={{ background: row.driver.color }} />
          {row.driver.lastName}
        </span>
        <span className="density-range num">
          {row.p5}–{row.p95} pts
        </span>
      </div>
      <ResponsiveContainer width="100%" height={64}>
        <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
          <XAxis
            dataKey="points"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={{ fill: '#6d717b', fontSize: 10 }}
            tickCount={3}
            stroke="#26262e"
            height={16}
          />
          <Area
            dataKey="count"
            stroke={row.driver.color}
            strokeWidth={1.5}
            fill={row.driver.color}
            fillOpacity={0.22}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Simulator({
  simulations,
  timeline,
}: {
  simulations: SimulationsFile;
  timeline: Timeline | null;
}) {
  const latest = timeline?.points[timeline.points.length - 1] ?? null;
  const byId = new Map(simulations.drivers.map((d) => [d.driverId, d]));

  const rows: Row[] = TRACKED_DRIVERS.map((driver) => {
    const sim = byId.get(driver.id);
    if (!sim) return null;
    const market = latest?.byId[driver.id] ? latest.byId[driver.id].median * 100 : null;
    const model = sim.titleProb * 100;
    return {
      driver,
      model,
      market,
      gap: market !== null ? model - market : null,
      p5: sim.p5,
      p50: sim.p50,
      p95: sim.p95,
    };
  })
    .filter((r): r is Row => r !== null)
    .sort((a, b) => b.model - a.model);

  const scaleMax = Math.max(...rows.map((r) => Math.max(r.model, r.market ?? 0)), 1);
  const pct = (v: number) => `${(v / scaleMax) * 100}%`;
  const method = simulations.method;

  return (
    <section className="panel" style={{ marginTop: 18 }} aria-label="Monte Carlo simulator">
      <h2 className="panel-title">Simulator vs market</h2>
      <p className="panel-sub num">
        {method.iterations.toLocaleString('en-GB')} season simulations from real finishing form
        (rounds 1–{method.based_on_rounds}, last {method.recent_window} weighted{' '}
        {method.recent_weight}×, DNF rates from actual retirements) · {method.remaining_races}{' '}
        races left
      </p>

      <div className="dumbbells">
        {rows.map((row) => (
          <div className="db-row" key={row.driver.id}>
            <span className="db-name">{row.driver.lastName}</span>
            <div className="db-track">
              {row.market !== null && (
                <span
                  className="db-connector"
                  style={{
                    left: pct(Math.min(row.model, row.market)),
                    width: `calc(${pct(Math.abs(row.model - row.market))})`,
                  }}
                />
              )}
              {row.market !== null && (
                <span
                  className="db-dot market"
                  style={{ left: pct(row.market), borderColor: row.driver.color }}
                  title={`Market (Polymarket): ${row.market.toFixed(1)}%`}
                />
              )}
              <span
                className="db-dot model"
                style={{ left: pct(row.model), background: row.driver.color }}
                title={`Model: ${row.model.toFixed(1)}%`}
              />
            </div>
            <span className="db-values num">
              {row.model.toFixed(1)}%
              {row.market !== null && <em> vs {row.market.toFixed(1)}%</em>}
            </span>
            {row.gap !== null && Math.abs(row.gap) >= MATERIAL_GAP_PP ? (
              <span className={`gap-chip num ${row.gap > 0 ? 'up' : 'down'}`}>
                model {row.gap > 0 ? '+' : '−'}
                {Math.abs(row.gap).toFixed(1)} pp
              </span>
            ) : (
              <span className="gap-chip num quiet">≈ market</span>
            )}
          </div>
        ))}
      </div>
      <p className="chart-help">
        Filled dot = this model, outlined dot = Polymarket. Where the model is materially more
        bullish than the market, the market usually knows something the finishing statistics
        don't — reliability risk, upgrades, momentum. Trust the gap as a conversation starter,
        not an edge.
      </p>

      <h3 className="panel-title" style={{ marginTop: 22 }}>
        Simulated final points
      </h3>
      <div className="density-grid">
        {rows.map((row) => (
          <DensityCell key={row.driver.id} row={row} histogram={simulations.histograms[row.driver.id]} />
        ))}
      </div>

      <p className="disclaimer">
        A toy model, honestly labelled: it resamples {method.based_on_rounds} rounds of finishing
        positions and knows nothing about car upgrades, track characteristics, weather, driver
        market moves or team orders. With this small a sample, treat the probabilities as rough
        — the betting market's number is the better forecast.
      </p>
    </section>
  );
}
