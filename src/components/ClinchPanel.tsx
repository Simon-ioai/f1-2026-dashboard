import Face from './Face';
import { driverView, lastName } from '../lib/driverInfo';
import { flagFor } from '../lib/flags';
import { TRACKED_DRIVERS } from '../lib/drivers';
import type { ClinchFile } from '../lib/data';

const TRACKED = new Set(TRACKED_DRIVERS.map((d) => d.id));

function fmtDate(date: string): string {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

export default function ClinchPanel({ clinch }: { clinch: ClinchFile }) {
  const champion = clinch.drivers.find((d) => d.status === 'clinched');
  const tracked = clinch.drivers.filter((d) => TRACKED.has(d.driverId));
  const untrackedAlive = clinch.drivers.filter(
    (d) => d.status !== 'eliminated' && !TRACKED.has(d.driverId) && d.driverId !== champion?.driverId,
  );
  const eliminated = clinch.drivers.filter((d) => d.status === 'eliminated');
  const byRound = new Map<string, string[]>();
  for (const d of eliminated) {
    const key = d.eliminatedAt?.raceName ?? 'Before this data begins';
    byRound.set(key, [...(byRound.get(key) ?? []), lastName(d.name)]);
  }

  return (
    <section className="panel" aria-label="Clinch scenarios">
      <div className="panel-head">
        <h2 className="panel-title">Clinch scenarios</h2>
        <p className="panel-sub num">
          After round {clinch.based_on_round} · {clinch.points_available} points still on the
          table across {clinch.remaining_races} races ({clinch.remaining_sprints} sprint
          {clinch.remaining_sprints === 1 ? '' : 's'})
        </p>
      </div>

      {champion && (
        <div style={{ padding: '14px 18px', borderRadius: 14, border: '1px solid var(--warn)', background: 'var(--warn-bg)', fontSize: 17 }}>
          🏆 <b>{champion.name}</b> is the 2026 World Champion
          {champion.clinchedAt?.raceName ? ` — title sealed at the ${champion.clinchedAt.raceName}.` : '.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tracked.map((d, i) => {
          if (d.status === 'clinched') return null;
          const view = driverView(d.driverId, d.code);
          const border = i === 0 && d.status === 'alive' ? `2px solid ${view.color}` : '1px solid var(--line)';
          const flag = d.clinch ? flagFor(d.clinch.country) : null;
          return (
            <div
              key={d.driverId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '12px 20px 12px 16px',
                borderRadius: 14,
                background: 'var(--panel2)',
                border,
                borderLeft: `4px solid ${view.color}`,
                opacity: d.status === 'eliminated' ? 0.62 : 1,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 44, flex: 'none' }}>
                {flag ? (
                  <img
                    src={flag}
                    alt={d.clinch?.locality ?? ''}
                    style={{ width: 40, height: 27, borderRadius: 5, objectFit: 'cover', boxShadow: '0 0 0 1px var(--line2)' }}
                  />
                ) : (
                  <span style={{ width: 40, height: 27, borderRadius: 5, background: 'var(--sunk)' }} />
                )}
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.06em', color: 'var(--muted)' }}>
                  {d.clinch ? `R${d.clinch.round}` : d.status === 'eliminated' ? 'out' : 'tie'}
                </span>
              </div>
              <Face d={view} size={40} title={d.name} />
              <div style={{ fontSize: 17, lineHeight: 1.45, flex: 1, minWidth: 0 }}>
                {d.status === 'eliminated' ? (
                  <>
                    <strong>{lastName(d.name)}</strong> can no longer win the title
                    {d.eliminatedAt?.raceName ? ` — mathematically eliminated at the ${d.eliminatedAt.raceName}.` : '.'}
                  </>
                ) : !d.clinch ? (
                  <>
                    <strong>{lastName(d.name)}</strong> can at best equal the leader on points —
                    the title would then go to a wins countback.
                  </>
                ) : (
                  <>
                    <strong>{lastName(d.name)}</strong>{' '}
                    {d.position === 1 ? 'wins the title in' : 'can clinch, at the earliest, in'}{' '}
                    <strong>{d.clinch.locality}</strong> on {fmtDate(d.clinch.date)} — if he
                    outscores {d.clinch.chiefRivalName ? lastName(d.clinch.chiefRivalName) : 'his closest rival'} by{' '}
                    <strong className="num">{d.clinch.gapNeeded} points</strong> before then.
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
        {untrackedAlive.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 14px' }}>
            <span style={{ fontSize: 15, color: 'var(--muted)' }}>Also still mathematically alive:</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {untrackedAlive.map((d) => {
                const view = driverView(d.driverId, d.code);
                return (
                  <div
                    key={d.driverId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 12px 3px 3px',
                      borderRadius: 999,
                      background: 'var(--panel2)',
                      border: '1px solid var(--line)',
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    <Face d={view} size={24} />
                    {lastName(d.name)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {byRound.size > 0 && (
          <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--muted)' }}>
            Out of the running:{' '}
            {[...byRound.entries()]
              .map(([raceName, names]) => `${names.join(', ')} (${raceName.replace(' Grand Prix', ' GP')})`)
              .join(' · ')}
            .
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          "Clinch" and "eliminated" are strict: reaching a points tie counts as alive, since ties
          are settled by a wins countback this model doesn't predict.
        </div>
      </div>
    </section>
  );
}
