// Title odds timeline, rebuilt to the design handoff: custom SVG lines and
// bid-ask bands, flag race markers, face bubbles in a right-hand gutter with
// collision avoidance, crosshair hover with a face tooltip, chip isolation,
// and a Season / Last-30-days toggle. All values come from timeline.json.

import { useMemo, useState } from 'react';
import Face from './Face';
import { driverView, lastName } from '../lib/driverInfo';
import { flagFor } from '../lib/flags';
import { FIELD, TRACKED_DRIVERS } from '../lib/drivers';
import type { Timeline as TimelineData } from '../lib/data';

const DAY = 86_400_000;
const H = 340;
const PT = 8;
const PB = 332;
const BUBBLE_GAP = 31;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Series {
  id: string;
  full: string;
  dashed: boolean;
  view: ReturnType<typeof driverView>;
  leader?: boolean;
}

function fmtD(t: number): string {
  const d = new Date(t);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}

const y = (p: number) => PB - (p / 100) * (PB - PT);

export default function Timeline({ timeline }: { timeline: TimelineData }) {
  const [iso, setIso] = useState<string | null>(null);
  const [range, setRange] = useState<'all' | '30'>('all');
  const [hover, setHover] = useState<number | null>(null);

  const series: Series[] = useMemo(() => {
    const latest = timeline.points[timeline.points.length - 1];
    const leaderId = latest
      ? [...TRACKED_DRIVERS].sort(
          (a, b) => (latest.byId[b.id]?.median ?? 0) - (latest.byId[a.id]?.median ?? 0),
        )[0]?.id
      : undefined;
    return [
      ...TRACKED_DRIVERS.map((d) => ({
        id: d.id,
        full: `${d.firstName} ${d.lastName}`,
        dashed: d.dashed,
        view: driverView(d.id, d.code),
        leader: d.id === leaderId,
      })),
      { id: FIELD.id, full: 'Field', dashed: true, view: driverView('field') },
    ];
  }, [timeline]);

  const all = timeline.points;
  const [i0, i1] = useMemo(() => {
    if (range === '30') {
      const cutoff = Date.parse(all[all.length - 1].date) - 30 * DAY;
      const first = all.findIndex((p) => Date.parse(p.date) >= cutoff);
      return [Math.max(0, first), all.length - 1];
    }
    return [0, all.length - 1];
  }, [all, range]);

  const t0 = Date.parse(all[i0].date);
  const t1 = Date.parse(all[i1].date);
  const X = (i: number) => ((Date.parse(all[i].date) - t0) / (t1 - t0)) * 1000;
  const Xp = (i: number) => ((Date.parse(all[i].date) - t0) / (t1 - t0)) * 100;
  const xT = (t: number) => ((t - t0) / (t1 - t0)) * 100;
  const op = (id: string) => (!iso || iso === id ? 1 : 0.12);

  const { lines, bands } = useMemo(() => {
    const lines: { id: string; d: string; w: number; dash: string; c: string }[] = [];
    const bands: { id: string; d: string; c: string }[] = [];
    const step = range === '30' ? 1 : 3;
    for (const s of series) {
      const pts: string[] = [];
      for (let i = i0; i <= i1; i++) {
        const v = all[i].byId[s.id];
        if (!v) continue;
        pts.push(`${pts.length ? 'L' : 'M'}${X(i).toFixed(1)},${y(v.median * 100).toFixed(1)}`);
      }
      lines.push({
        id: s.id,
        d: pts.join(''),
        w: s.leader ? 2.6 : 1.9,
        dash: s.dashed ? '6 4' : 'none',
        c: s.view.color,
      });
      // bid-ask band from the real min/max
      const idx: number[] = [];
      for (let i = i0; i <= i1; i += step) idx.push(i);
      if (idx[idx.length - 1] !== i1) idx.push(i1);
      const withData = idx.filter((i) => all[i].byId[s.id]);
      if (withData.length > 1) {
        const hi = withData
          .map((i, m) => `${m ? 'L' : 'M'}${X(i).toFixed(1)},${y(all[i].byId[s.id].max * 100).toFixed(1)}`)
          .join('');
        const lo = [...withData]
          .reverse()
          .map((i) => `L${X(i).toFixed(1)},${y(all[i].byId[s.id].min * 100).toFixed(1)}`)
          .join('');
        bands.push({ id: s.id, d: hi + lo + 'Z', c: s.view.color });
      }
    }
    return { lines, bands };
  }, [series, all, i0, i1, range]);

  // Line-end bubbles: forward pass pushes down, clamp, backward pass pushes up.
  const bubbles = useMemo(() => {
    const last = all[i1];
    const ends = series
      .filter((s) => last.byId[s.id])
      .map((s) => ({ s, ye: y(last.byId[s.id].median * 100), pct: (last.byId[s.id].median * 100).toFixed(1) }))
      .sort((a, b) => a.ye - b.ye);
    const pos = ends.map((e) => Math.max(PT + 6, e.ye));
    for (let i = 1; i < pos.length; i++) pos[i] = Math.max(pos[i], pos[i - 1] + BUBBLE_GAP);
    if (pos.length) pos[pos.length - 1] = Math.min(pos[pos.length - 1], PB);
    for (let i = pos.length - 2; i >= 0; i--) pos[i] = Math.min(pos[i], pos[i + 1] - BUBBLE_GAP);
    return ends.map((e, m) => ({
      ...e,
      y: pos[m],
      link: `M0,${e.ye.toFixed(1)} C9,${e.ye.toFixed(1)} 9,${pos[m].toFixed(1)} 18,${pos[m].toFixed(1)}`,
    }));
  }, [series, all, i1]);

  const raceFlags = useMemo(
    () =>
      timeline.races
        .map((r) => ({ ...r, t: Date.parse(r.date), flag: flagFor(r.country) }))
        .filter((r) => r.t >= t0 && r.t <= t1)
        .map((r, j) => ({
          ...r,
          x: xT(r.t),
          top: range === '30' ? 7 : j % 2 ? 12 : 0,
          title: `${r.name} · ${fmtD(r.t)}${r.winner ? ` · won by ${r.winner.name}` : ''}`,
        })),
    [timeline.races, t0, t1, range],
  );

  const xTicks = useMemo(() => {
    const ticks: { x: number; label: string }[] = [];
    if (range === '30') {
      for (let i = i0; i <= i1; i += 5) ticks.push({ x: Xp(i), label: fmtD(Date.parse(all[i].date)) });
    } else {
      const start = new Date(t0);
      for (let m = start.getUTCFullYear() * 12 + start.getUTCMonth() + 1; ; m++) {
        const t = Date.UTC(Math.floor(m / 12), m % 12, 1);
        if (t > t1) break;
        ticks.push({ x: xT(t), label: MON[m % 12] });
      }
    }
    return ticks;
  }, [range, i0, i1, t0, t1]);

  // Mover: biggest 7-day change among tracked drivers.
  const mover = useMemo(() => {
    const latest = all[all.length - 1];
    const target = Date.parse(latest.date) - 7 * DAY;
    const baseArr = all.filter((p) => Date.parse(p.date) <= target);
    const base = baseArr.length ? baseArr[baseArr.length - 1] : all[0];
    if (base === latest) return null;
    let best: { s: Series; delta: number } | null = null;
    for (const s of series) {
      if (s.id === FIELD.id) continue;
      const a = latest.byId[s.id]?.median;
      const b = base.byId[s.id]?.median;
      if (a === undefined || b === undefined) continue;
      const delta = (a - b) * 100;
      if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { s, delta };
    }
    return best && Math.abs(best.delta) >= 0.05 ? best : null;
  }, [all, series]);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - r.left) / r.width;
    const t = t0 + frac * (t1 - t0);
    let bestI = i0;
    for (let i = i0; i <= i1; i++) {
      if (Math.abs(Date.parse(all[i].date) - t) < Math.abs(Date.parse(all[bestI].date) - t)) bestI = i;
    }
    if (bestI !== hover) setHover(bestI);
  };

  const hoverOn = hover !== null && hover >= i0 && hover <= i1;
  const hoverX = hoverOn ? Xp(hover) : 0;
  const hoverRows = hoverOn
    ? series
        .map((s) => ({ s, p: all[hover].byId[s.id]?.median }))
        .filter((r): r is { s: Series; p: number } => r.p !== undefined)
        .sort((a, b) => b.p - a.p)
    : [];

  return (
    <section className="panel" aria-label="Title odds timeline">
      <div className="panel-head">
        <h2 className="panel-title">Title odds timeline</h2>
        <p className="panel-sub">
          Implied championship-win probability from Polymarket's title market, tracked daily since
          December 2025.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {series.map((s) => (
          <button
            key={s.id}
            onClick={() => setIso((cur) => (cur === s.id ? null : s.id))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 14px 4px 4px',
              borderRadius: 999,
              border: `1px solid ${iso === s.id ? s.view.color : 'var(--line)'}`,
              background: iso === s.id ? 'var(--panel2)' : 'transparent',
              opacity: op(s.id) === 1 ? 1 : 0.45,
              fontSize: 15,
              fontWeight: 600,
              transition: 'opacity .15s',
            }}
          >
            <Face d={s.view} size={26} />
            {s.full}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', padding: 3, borderRadius: 999, background: 'var(--sunk)', gap: 2 }}>
          {(
            [
              ['all', 'Season'],
              ['30', 'Last 30 days'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => {
                setRange(k);
                setHover(null);
              }}
              style={{
                padding: '5px 14px',
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 600,
                background: range === k ? 'var(--panel)' : 'transparent',
                color: range === k ? 'var(--ink)' : 'var(--muted)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="hscroll">
      <div style={{ paddingRight: 118, minWidth: 620 }}>
        <div style={{ position: 'relative', height: 30 }}>
          {raceFlags.map((f) => (
            <div
              key={f.round}
              title={f.title}
              style={{
                position: 'absolute',
                left: `${f.x}%`,
                top: f.top,
                transform: 'translateX(-50%)',
                width: 16,
                height: 16,
                borderRadius: '50%',
                overflow: 'hidden',
                boxShadow: '0 0 0 1.5px var(--panel), 0 0 0 2.5px var(--line2)',
              }}
            >
              {f.flag ? (
                <img src={f.flag} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ display: 'block', width: '100%', height: '100%', background: 'var(--sunk)' }} />
              )}
            </div>
          ))}
        </div>

        <div style={{ position: 'relative', height: H, cursor: 'crosshair' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          {[0, 25, 50, 75, 100].map((v) => (
            <div key={v} style={{ position: 'absolute', left: 0, right: 0, top: y(v), borderTop: '1px solid var(--line)' }}>
              <span className="num" style={{ position: 'absolute', right: 'calc(100% + 8px)', top: -10, fontSize: 12, color: 'var(--muted)' }}>
                {v}%
              </span>
            </div>
          ))}
          {raceFlags.map((f) => (
            <div key={f.round} style={{ position: 'absolute', top: 0, bottom: 0, left: `${f.x}%`, borderLeft: '1px dashed var(--line2)', opacity: 0.6 }} />
          ))}
          <svg viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
            {bands.map((b) => (
              <path key={b.id} d={b.d} fill={b.c} opacity={0.16 * op(b.id)} />
            ))}
            {lines.map((l) => (
              <path
                key={l.id}
                d={l.d}
                fill="none"
                stroke={l.c}
                strokeWidth={l.w}
                strokeDasharray={l.dash}
                opacity={op(l.id)}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </svg>
          <svg viewBox={`0 0 18 ${H}`} preserveAspectRatio="none" style={{ position: 'absolute', left: '100%', top: 0, width: 18, height: '100%', overflow: 'visible' }}>
            {bubbles.map((b) => (
              <path key={b.s.id} d={b.link} fill="none" stroke={b.s.view.color} strokeWidth="1.2" opacity={op(b.s.id)} />
            ))}
          </svg>
          {bubbles.map((b) => (
            <div key={b.s.id} style={{ opacity: op(b.s.id) }}>
              <div
                style={{
                  position: 'absolute',
                  left: '100%',
                  top: b.ye,
                  width: 7,
                  height: 7,
                  margin: '-3.5px 0 0 -3.5px',
                  borderRadius: '50%',
                  background: b.s.view.color,
                  boxShadow: '0 0 0 2px var(--panel)',
                }}
              />
              <div style={{ position: 'absolute', left: 'calc(100% + 18px)', top: b.y, transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                <Face d={b.s.view} size={28} ring title={b.s.full} />
                <span className="num" style={{ fontSize: 14, fontWeight: 700 }}>{b.pct}%</span>
              </div>
            </div>
          ))}
          {hoverOn && (
            <>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${hoverX}%`, borderLeft: '1px solid var(--line2)', pointerEvents: 'none' }} />
              {hoverRows
                .filter((r) => op(r.s.id) === 1)
                .map((r) => (
                  <div
                    key={r.s.id}
                    style={{
                      position: 'absolute',
                      left: `${hoverX}%`,
                      top: y(r.p * 100),
                      width: 9,
                      height: 9,
                      margin: '-4.5px 0 0 -4.5px',
                      borderRadius: '50%',
                      background: r.s.view.color,
                      boxShadow: '0 0 0 2px var(--panel)',
                      pointerEvents: 'none',
                    }}
                  />
                ))}
              <div
                className="tipcard"
                style={{ top: 8, left: `${hoverX}%`, transform: hoverX > 60 ? 'translateX(calc(-100% - 14px))' : 'translateX(14px)' }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
                  {new Date(all[hover!].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {hover === all.length - 1 ? ' · today' : ''}
                </div>
                {hoverRows.map((r) => (
                  <div key={r.s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Face d={r.s.view} size={20} />
                    <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{r.s.full}</span>
                    <span className="num" style={{ fontSize: 14, fontWeight: 700 }}>{(r.p * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ position: 'relative', height: 24, marginTop: 6 }}>
          {xTicks.map((t, i) => (
            <span key={i} className="num" style={{ position: 'absolute', left: `${t.x}%`, transform: 'translateX(-50%)', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>
      </div>

      <div className="help-note">
        Lines are the market-implied title probability, normalised so the whole field sums to
        100%; the soft band is the market's bid–ask spread. Flags mark race weekends — hover one
        for the venue. Click a driver chip to isolate; click again to bring everyone back.
      </div>

      {mover && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px 18px', padding: '16px 20px', borderRadius: 14, background: 'var(--panel2)', border: '1px solid var(--line)' }}>
          <div style={{ position: 'relative', width: 48, height: 48, flex: 'none' }}>
            <Face d={mover.s.view} size={48} title={mover.s.full} />
            <div
              style={{
                position: 'absolute',
                right: -6,
                bottom: -4,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: mover.delta > 0 ? 'var(--up)' : 'var(--down)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                boxShadow: '0 0 0 2px var(--panel2)',
              }}
            >
              {mover.delta > 0 ? '▲' : '▼'}
            </div>
          </div>
          <div className="num" style={{ fontSize: 30, fontWeight: 900, color: mover.delta > 0 ? 'var(--up)' : 'var(--down)', lineHeight: 1 }}>
            {Math.abs(mover.delta).toFixed(1)} <span style={{ fontSize: 18 }}>pp</span>
          </div>
          <div style={{ fontSize: 17, flex: 1, minWidth: 240 }}>
            <strong>{mover.s.full}</strong> is the biggest mover of the last 7 days — the market
            moved {mover.delta > 0 ? 'towards' : 'away from'} him by{' '}
            <strong className="num">{Math.abs(mover.delta).toFixed(1)} percentage points</strong>.
          </div>
        </div>
      )}
    </section>
  );
}

export { lastName };
