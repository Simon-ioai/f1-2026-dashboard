import { TRACKED_DRIVERS } from '../lib/drivers';
import type { Timeline } from '../lib/data';

const DAY = 86_400_000;

/** Biggest change in median implied probability over (up to) the last 7 days. */
export default function MoverCallout({ timeline }: { timeline: Timeline }) {
  const points = timeline.points;
  if (points.length < 2) return null;

  const latest = points[points.length - 1];
  const target = Date.parse(latest.date) - 7 * DAY;
  const window = points.filter((p) => Date.parse(p.date) <= target);
  // fall back to the oldest point if we don't have 7 days of history yet
  const base = window.length > 0 ? window[window.length - 1] : points[0];
  if (base === latest) return null;

  let best: { driver: (typeof TRACKED_DRIVERS)[number]; delta: number } | null = null;
  for (const d of TRACKED_DRIVERS) {
    const now = latest.byId[d.id];
    const then = base.byId[d.id];
    if (!now || !then) continue;
    const delta = (now.median - then.median) * 100;
    if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { driver: d, delta };
  }
  if (!best || Math.abs(best.delta) < 0.05) return null;

  const spanDays = Math.round((Date.parse(latest.date) - Date.parse(base.date)) / DAY);
  const dir = best.delta > 0 ? 'up' : 'down';
  return (
    <div className="mover" style={{ '--mover-color': best.driver.color } as React.CSSProperties}>
      <span className={`big num delta ${dir}`}>
        {best.delta > 0 ? '▲' : '▼'} {Math.abs(best.delta).toFixed(1)} pp
      </span>
      <span>
        <b>
          {best.driver.firstName} {best.driver.lastName}
        </b>{' '}
        is the biggest mover of the last {spanDays} day{spanDays === 1 ? '' : 's'} — the market
        moved {best.delta > 0 ? 'towards' : 'away from'} him by{' '}
        <b className="num">{Math.abs(best.delta).toFixed(1)} percentage points</b>.
      </span>
    </div>
  );
}
