import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { TRACKED_DRIVERS } from '../lib/drivers';
import type { H2HFile } from '../lib/data';

const COLOR = new Map(TRACKED_DRIVERS.map((d) => [d.id, d.color]));
const PARTNER_FALLBACK = '#8a93a0';

function lastName(name: string): string {
  return name.split(' ').slice(-1)[0];
}

function fmtGap(ms: number): string {
  return `${(Math.abs(ms) / 1000).toFixed(3)}s`;
}

function GapTooltip({
  active,
  payload,
  primaryCode,
}: {
  active?: boolean;
  payload?: { payload?: { locality: string; gapMs: number | null; session: string | null; partnerCode: string | null } }[];
  primaryCode: string | null;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point || point.gapMs === null) return null;
  const ahead = point.gapMs < 0 ? primaryCode : point.partnerCode;
  return (
    <div className="tt">
      <div className="tt-date">{point.locality}</div>
      <div className="tt-row">
        <span className="name">
          {ahead} faster by {fmtGap(point.gapMs)} ({point.session})
        </span>
      </div>
    </div>
  );
}

export default function H2HPanel({ h2h }: { h2h: H2HFile }) {
  return (
    <section className="panel" style={{ marginTop: 18 }} aria-label="Teammate head-to-head">
      <h2 className="panel-title">Teammate head-to-head</h2>
      <p className="panel-sub">
        The only equal machinery on the grid. Qualifying gaps compare the deepest session both
        cars set a time in; race record counts only races where both were classified.
      </p>
      <div className="h2h-grid">
        {h2h.teams.map((t) => {
          const primaryColor = COLOR.get(t.primary.driverId) ?? PARTNER_FALLBACK;
          const partnerLabel = t.partners.map((p) => lastName(p.name)).join(' / ');
          const partnerColor =
            t.partners.length === 1
              ? COLOR.get(t.partners[0].driverId) ?? PARTNER_FALLBACK
              : PARTNER_FALLBACK;
          const totalPoints = t.primary.points + t.partners.reduce((s, p) => s + p.points, 0);
          const gap = t.overall.medianGapMs;
          const gapLeader = gap === null ? null : gap < 0 ? lastName(t.primary.name) : partnerLabel;
          return (
            <div className="h2h-card" key={t.team}>
              <div className="h2h-head">
                <span className="h2h-team">{t.team}</span>
                <span className="h2h-names">
                  <b style={{ color: primaryColor }}>{lastName(t.primary.name)}</b>
                  <em> vs </em>
                  <b style={{ color: partnerColor }}>{partnerLabel}</b>
                </span>
              </div>

              <div className="h2h-stats num">
                <div>
                  <span className="h2h-big">
                    {t.overall.qualiWins}–{t.overall.qualiLosses}
                  </span>
                  <span className="h2h-label">Qualifying</span>
                </div>
                <div>
                  <span className="h2h-big">
                    {t.overall.raceWins}–{t.overall.raceLosses}
                  </span>
                  <span className="h2h-label">Race (both classified)</span>
                </div>
                <div>
                  <span className="h2h-big">{gap === null ? '—' : fmtGap(gap)}</span>
                  <span className="h2h-label">
                    {gap === null
                      ? 'No comparable laps'
                      : `Median quali gap · ${gapLeader} ahead (${t.overall.comparableLaps} laps)`}
                  </span>
                </div>
              </div>

              <div className="h2h-points">
                <div
                  className="h2h-points-bar"
                  style={{
                    background: `linear-gradient(90deg, ${primaryColor} ${(t.primary.points / totalPoints) * 100}%, ${partnerColor}55 ${(t.primary.points / totalPoints) * 100}%)`,
                  }}
                />
                <span className="h2h-points-label num">
                  {t.primary.points} · {t.partners.map((p) => p.points).join(' · ')} pts
                </span>
              </div>

              <ResponsiveContainer width="100%" height={72}>
                <BarChart
                  data={t.trend.map((x) => ({ ...x, gapS: x.gapMs === null ? null : x.gapMs / 1000 }))}
                  margin={{ top: 6, right: 2, bottom: 0, left: 2 }}
                >
                  <XAxis dataKey="round" hide />
                  <ReferenceLine y={0} stroke="#3a3a44" />
                  <Tooltip
                    content={<GapTooltip primaryCode={t.primary.code} />}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    isAnimationActive={false}
                  />
                  <Bar dataKey="gapS" isAnimationActive={false} radius={[2, 2, 2, 2]} maxBarSize={10}>
                    {t.trend.map((x, i) => (
                      <Cell
                        key={i}
                        fill={x.gapMs !== null && x.gapMs < 0 ? primaryColor : `${partnerColor}AA`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="h2h-spark-label">
                Qualifying gap per round — bars below the line: {lastName(t.primary.name)} faster
                {t.partners.length > 1 && (
                  <>
                    {' '}
                    · {t.partners.map((p) => `vs ${lastName(p.name)}: ${p.rounds} rounds`).join(', ')}
                  </>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
