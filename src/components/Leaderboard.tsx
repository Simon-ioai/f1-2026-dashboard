import { TRACKED_DRIVERS } from '../lib/drivers';
import type { StandingsFile, Timeline, TimelinePoint } from '../lib/data';

const DAY = 86_400_000;

/** Latest point, and the closest point to seven days earlier (if any). */
function latestAndWeekAgo(points: TimelinePoint[]): [TimelinePoint | null, TimelinePoint | null] {
  if (points.length === 0) return [null, null];
  const latest = points[points.length - 1];
  const target = Date.parse(latest.date) - 7 * DAY;
  const earlier = points.filter((p) => Date.parse(p.date) <= target);
  return [latest, earlier.length > 0 ? earlier[earlier.length - 1] : null];
}

export default function Leaderboard({
  timeline,
  standings,
}: {
  timeline: Timeline | null;
  standings: StandingsFile | null;
}) {
  const [latest, weekAgo] = latestAndWeekAgo(timeline?.points ?? []);

  if (latest) {
    const cards = TRACKED_DRIVERS.map((d) => {
      const now = latest.byId[d.id];
      const prev = weekAgo?.byId[d.id];
      return {
        driver: d,
        value: now ? now.median * 100 : null,
        delta: now && prev ? (now.median - prev.median) * 100 : null,
      };
    }).sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

    return (
      <section className="panel" aria-label="Title probability leaderboard">
        <h2 className="panel-title">Title probability</h2>
        <p className="panel-sub num">
          {latest.source?.startsWith('polymarket')
            ? 'Market-implied (Polymarket), normalised'
            : `Bookmaker-implied, vig removed · median of ${latest.bookmakers} bookmaker${latest.bookmakers === 1 ? '' : 's'}`}{' '}
          · {latest.date}
          {weekAgo ? ' · Δ vs 7 days' : ''}
        </p>
        <div className="leaderboard">
          {cards.map((c, i) => (
            <div
              className="driver-card"
              key={c.driver.id}
              style={{ '--team': c.driver.color } as React.CSSProperties}
            >
              <div className="pos">P{i + 1}</div>
              <div className="value num">
                {c.value !== null ? (
                  <>
                    {c.value.toFixed(1)}
                    <small>%</small>
                  </>
                ) : (
                  '—'
                )}
              </div>
              <div className="who">
                {c.driver.firstName} {c.driver.lastName}
              </div>
              <div className="team-name">{c.driver.team}</div>
              {c.delta !== null && (
                <div
                  className={`delta num ${c.delta > 0.05 ? 'up' : c.delta < -0.05 ? 'down' : 'flat'}`}
                >
                  {c.delta > 0 ? '▲' : c.delta < 0 ? '▼' : '•'} {Math.abs(c.delta).toFixed(1)}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!standings) return null;
  const known = new Map(TRACKED_DRIVERS.map((d) => [d.id, d]));
  return (
    <section className="panel" aria-label="Championship standings">
      <h2 className="panel-title">Championship standings</h2>
      <p className="panel-sub num">
        After round {standings.round} · title probabilities appear once the first odds snapshot
        lands
      </p>
      <div className="leaderboard">
        {standings.standings.slice(0, 6).map((s) => {
          const d = known.get(s.driverId);
          return (
            <div
              className="driver-card"
              key={s.driverId}
              style={{ '--team': d?.color ?? 'var(--ink-muted)' } as React.CSSProperties}
            >
              <div className="pos">P{s.position ?? '–'}</div>
              <div className="value num">
                {s.points}
                <small>pts</small>
              </div>
              <div className="who">{s.name}</div>
              <div className="team-name">
                {s.team}
                {s.wins > 0 ? ` · ${s.wins} win${s.wins === 1 ? '' : 's'}` : ''}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
