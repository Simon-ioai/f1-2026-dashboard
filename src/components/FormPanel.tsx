import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TRACKED_DRIVERS } from '../lib/drivers';
import type { FormFile } from '../lib/data';

const DRIVER = new Map(TRACKED_DRIVERS.map((d) => [d.id, d]));

interface CellDatum {
  round: number;
  locality: string;
  pointsAvg: number;
  qualiAvg: number | null;
  diverged: boolean;
}

function FormTooltip({
  active,
  payload,
  mode,
}: {
  active?: boolean;
  payload?: { payload?: CellDatum }[];
  mode: 'points' | 'quali';
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="tt">
      <div className="tt-date">{p.locality}</div>
      <div className="tt-row">
        <span className="name">
          {mode === 'points'
            ? `3-race avg: ${p.pointsAvg.toFixed(1)} pts/weekend`
            : p.qualiAvg !== null
              ? `3-race avg quali: P${p.qualiAvg.toFixed(1)}`
              : 'no representative qualifying'}
        </span>
      </div>
      {mode === 'points' && p.diverged && (
        <div className="tt-race">⚡ form break vs season baseline</div>
      )}
    </div>
  );
}

/** Dot only on flagged weekends, so the chart stays quiet elsewhere. */
function divergenceDot(color: string) {
  return function Dot(props: { cx?: number; cy?: number; payload?: CellDatum; index?: number }) {
    const { cx, cy, payload, index } = props;
    if (!payload?.diverged || cx === undefined || cy === undefined) {
      return <g key={`d-${index}`} />;
    }
    return (
      <g key={`d-${index}`}>
        <circle cx={cx} cy={cy} r={6} fill={color} fillOpacity={0.25} />
        <circle cx={cx} cy={cy} r={2.8} fill={color} />
      </g>
    );
  };
}

export default function FormPanel({ form }: { form: FormFile }) {
  return (
    <section className="panel" style={{ marginTop: 18 }} aria-label="Form index">
      <h2 className="panel-title">Form index</h2>
      <p className="panel-sub">
        Rolling 3-weekend averages — who is actually trending, independent of the championship
        gap. Dashed line: season baseline. Marked dots: weekends where a driver's form broke
        away from their normal range.
      </p>
      <div className="form-grid">
        {form.drivers.map((d) => {
          const driver = DRIVER.get(d.driverId);
          const color = driver?.color ?? '#8a93a0';
          const data: CellDatum[] = d.rounds.map((r) => ({
            round: r.round,
            locality: r.locality,
            pointsAvg: r.pointsAvg,
            qualiAvg: r.qualiAvg,
            diverged: r.diverged,
          }));
          const latest = data[data.length - 1];
          const trend = latest ? latest.pointsAvg - d.baselinePoints : 0;
          return (
            <div className="form-cell" key={d.driverId}>
              <div className="form-head">
                <span className="density-name">
                  <span className="dot" style={{ background: color }} />
                  {driver?.lastName ?? d.name}
                </span>
                <span
                  className={`form-trend num ${trend > 1 ? 'up' : trend < -1 ? 'down' : 'flat'}`}
                  title="Current 3-race points average vs season baseline"
                >
                  {trend > 1 ? '▲' : trend < -1 ? '▼' : '•'} {Math.abs(trend).toFixed(1)}
                </span>
              </div>

              <p className="form-chart-label">Points per weekend (3-race avg)</p>
              <ResponsiveContainer width="100%" height={64}>
                <LineChart data={data} margin={{ top: 8, right: 4, bottom: 2, left: 4 }}>
                  <XAxis dataKey="round" hide />
                  <YAxis hide domain={[0, 33]} />
                  <ReferenceLine y={d.baselinePoints} stroke="#4a4a55" strokeDasharray="4 4" />
                  <Tooltip content={<FormTooltip mode="points" />} isAnimationActive={false} />
                  <Line
                    dataKey="pointsAvg"
                    stroke={color}
                    strokeWidth={2}
                    dot={divergenceDot(color)}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>

              <p className="form-chart-label">Qualifying position (3-race avg, up = better)</p>
              <ResponsiveContainer width="100%" height={52}>
                <LineChart data={data} margin={{ top: 6, right: 4, bottom: 2, left: 4 }}>
                  <XAxis dataKey="round" hide />
                  <YAxis hide reversed domain={[1, 'auto']} />
                  {d.baselineQuali !== null && (
                    <ReferenceLine y={d.baselineQuali} stroke="#4a4a55" strokeDasharray="4 4" />
                  )}
                  <Tooltip content={<FormTooltip mode="quali" />} isAnimationActive={false} />
                  <Line
                    dataKey="qualiAvg"
                    stroke={color}
                    strokeWidth={1.6}
                    strokeOpacity={0.75}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </section>
  );
}
