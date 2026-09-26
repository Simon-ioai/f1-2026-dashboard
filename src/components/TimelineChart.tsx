import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  Brush,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AvatarBubble } from './DriverAvatar';
import { FIELD, TRACKED_DRIVERS } from '../lib/drivers';
import type { RaceAnnotation, Timeline } from '../lib/data';

const DAY = 86_400_000;

interface SeriesDef {
  id: string;
  label: string;
  color: string;
  dashed: boolean;
}

const SERIES: SeriesDef[] = [
  ...TRACKED_DRIVERS.map((d) => ({
    id: d.id,
    label: `${d.firstName} ${d.lastName}`,
    color: d.color,
    dashed: d.dashed,
  })),
  { id: FIELD.id, label: FIELD.label, color: FIELD.color, dashed: true },
];

type Row = Record<string, number | [number, number] | null> & { t: number };

function fmtDate(t: number, withYear = false): string {
  return new Date(t).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

function raceTitle(race: RaceAnnotation): string {
  const winner = race.winner ? `Winner: ${race.winner.name} (${race.winner.team})` : 'Not run yet';
  return `R${race.round} · ${race.name} · ${race.circuit} · ${winner}`;
}

function TimelineTooltip({
  active,
  label,
  payload,
  races,
}: {
  active?: boolean;
  label?: number;
  payload?: { dataKey?: string; value?: number }[];
  races: RaceAnnotation[];
}) {
  if (!active || !payload || label === undefined) return null;
  const values = SERIES.map((s) => {
    const entry = payload.find((p) => p.dataKey === s.id);
    return entry && typeof entry.value === 'number' ? { ...s, value: entry.value } : null;
  })
    .filter((v): v is SeriesDef & { value: number } => v !== null)
    .sort((a, b) => b.value - a.value);
  if (values.length === 0) return null;
  const race = races.find((r) => Math.abs(Date.parse(r.date) - label) < DAY / 2);
  return (
    <div className="tt">
      <div className="tt-date">{fmtDate(label, true)}</div>
      {values.map((v) => (
        <div className="tt-row" key={v.id}>
          <span className="dot" style={{ background: v.color }} />
          <span className="name">{v.label}</span>
          <span className="val num">{v.value.toFixed(1)}%</span>
        </div>
      ))}
      {race && (
        <div className="tt-race">
          🏁 {race.name}
          {race.winner ? ` — won by ${race.winner.name}` : ''}
        </div>
      )}
    </div>
  );
}

export default function TimelineChart({ timeline }: { timeline: Timeline }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [last30, setLast30] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  // 0 until measured: race labels stay hidden for the first paint rather than
  // flashing a colliding layout on narrow screens.
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setChartWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const allRows = useMemo<Row[]>(
    () =>
      timeline.points.map((p) => {
        const row: Row = { t: Date.parse(p.date) };
        for (const s of SERIES) {
          const agg = p.byId[s.id];
          row[s.id] = agg ? agg.median * 100 : null;
          row[`${s.id}Band`] = agg ? [agg.min * 100, agg.max * 100] : null;
        }
        return row;
      }),
    [timeline],
  );

  const rows = useMemo(() => {
    if (!last30 || allRows.length === 0) return allRows;
    const cutoff = allRows[allRows.length - 1].t - 30 * DAY;
    return allRows.filter((r) => r.t >= cutoff);
  }, [allRows, last30]);

  const domain = useMemo<[number, number]>(() => {
    if (rows.length === 0) return [0, 1];
    const pad = rows.length === 1 ? DAY : DAY / 2;
    return [rows[0].t - pad, rows[rows.length - 1].t + pad];
  }, [rows]);

  const visibleRaces = useMemo(
    () =>
      timeline.races.filter((r) => {
        const t = Date.parse(r.date);
        return t >= domain[0] && t <= domain[1];
      }),
    [timeline.races, domain],
  );

  // Legend chip semantics: toggle by default; click a visible series while all
  // are visible to isolate it; click the sole survivor to bring everyone back.
  function onChip(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      const visibleCount = SERIES.length - prev.size;
      if (prev.has(id)) {
        next.delete(id);
      } else if (visibleCount === SERIES.length) {
        return new Set(SERIES.filter((s) => s.id !== id).map((s) => s.id));
      } else if (visibleCount === 1) {
        return new Set();
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const singleDay = rows.length === 1;
  // Two staggered rows, ~80px per label: hide the text when it can't fit.
  // Markers and their hover titles always stay.
  const showRaceLabels = visibleRaces.length <= Math.floor(chartWidth / 80) * 2;

  return (
    <div ref={wrapRef}>
      <div className="chart-toolbar" role="group" aria-label="Toggle drivers">
        {SERIES.map((s) => (
          <button
            key={s.id}
            className={`chip${hidden.has(s.id) ? ' off' : ''}`}
            onClick={() => onChip(s.id)}
          >
            <span className={`swatch${s.dashed ? ' dashed' : ''}`} style={{ '--sw': s.color } as React.CSSProperties} />
            {s.label}
          </button>
        ))}
        <button
          className={`chip range-btn${last30 ? ' active' : ''}`}
          onClick={() => setLast30((v) => !v)}
        >
          Last 30 days
        </button>
      </div>

      {/* Mount the chart only once the container is measured: a re-render while
          the draw-in animation is starting (width 0 -> measured flips the race
          labels on) freezes Recharts' line tween at its hidden first frame. */}
      {chartWidth > 0 && (
      <ResponsiveContainer width="100%" height={420}>
        <ComposedChart data={rows} margin={{ top: 18, right: 22, bottom: 0, left: -14 }}>
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={domain}
            tickFormatter={(t: number) => fmtDate(t)}
            stroke="var(--chart-axis)"
            tick={{ fill: 'var(--ink-muted)', fontSize: 12 }}
            tickMargin={8}
          />
          <YAxis
            unit="%"
            stroke="var(--chart-axis)"
            tick={{ fill: 'var(--ink-muted)', fontSize: 12 }}
            width={58}
            domain={[0, 'auto']}
          />
          {visibleRaces.map((race, i) => (
            <ReferenceLine
              key={race.round}
              x={Date.parse(race.date)}
              stroke="var(--chart-axis)"
              strokeDasharray="3 4"
              label={
                // Stagger labels over two rows so neighbouring races don't
                // collide; drop them entirely when the chart is too dense.
                showRaceLabels
                  ? {
                      value: race.locality,
                      position: 'top',
                      dy: (i % 2) * 13 - 2,
                      fill: 'var(--ink-muted)',
                      fontSize: 10.5,
                    }
                  : undefined
              }
            >
              <title>{raceTitle(race)}</title>
            </ReferenceLine>
          ))}
          {SERIES.filter((s) => !hidden.has(s.id)).map((s) => (
            <Area
              key={`${s.id}-band`}
              dataKey={`${s.id}Band`}
              stroke="none"
              fill={s.color}
              fillOpacity={0.09}
              connectNulls
              isAnimationActive={false}
              activeDot={false}
              tooltipType="none"
            />
          ))}
          {SERIES.filter((s) => !hidden.has(s.id)).map((s) => (
            <Line
              key={s.id}
              dataKey={s.id}
              stroke={s.color}
              strokeWidth={s.id === FIELD.id ? 1.5 : 2.2}
              strokeDasharray={s.dashed ? '7 4' : undefined}
              dot={(props: { cx?: number; cy?: number; index?: number; value?: number }) => {
                const isLast = props.index === rows.length - 1;
                if (props.cx === undefined || props.cy === undefined || props.value == null) {
                  return <g key={`e-${props.index}`} />;
                }
                if (isLast && s.id !== FIELD.id) {
                  return (
                    <AvatarBubble key={`a-${props.index}`} cx={props.cx} cy={props.cy} r={9} color={s.color} />
                  );
                }
                if (singleDay) {
                  return <circle key={`s-${props.index}`} cx={props.cx} cy={props.cy} r={4} fill={s.color} />;
                }
                return <g key={`e-${props.index}`} />;
              }}
              activeDot={{ r: 4.5, strokeWidth: 0 }}
              connectNulls
              // rAF is suspended in hidden/background tabs, which would freeze
              // the draw-in tween at its invisible first frame — skip it there.
              isAnimationActive={typeof document !== 'undefined' && !document.hidden}
              animationDuration={900}
              animationEasing="ease-out"
            />
          ))}
          <Tooltip
            content={<TimelineTooltip races={timeline.races} />}
            cursor={{ stroke: 'var(--chart-grid)', strokeDasharray: '2 3' }}
            isAnimationActive={false}
          />
          {rows.length > 6 && (
            <Brush
              dataKey="t"
              height={26}
              travellerWidth={9}
              stroke="var(--chart-grid)"
              fill="var(--surface)"
              tickFormatter={(t: number) => fmtDate(t)}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      )}
      <p className="chart-help">
        Lines are the market-implied title probability, normalised so the whole field sums to
        100%; the soft band is the market's bid–ask spread (bookmaker min–max where bookmaker
        data exists). Vertical markers are race weekends — hover one for the result. Click a
        driver chip to isolate; click again to bring everyone back.
      </p>
    </div>
  );
}
