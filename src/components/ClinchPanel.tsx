import { flagFor } from '../lib/flags';
import { TRACKED_DRIVERS } from '../lib/drivers';
import type { ClinchFile } from '../lib/data';

const TRACKED = new Map(TRACKED_DRIVERS.map((d) => [d.id, d]));

function fmtDate(date: string): string {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
  });
}

function lastName(fullName: string): string {
  return fullName.split(' ').slice(-1)[0];
}

export default function ClinchPanel({ clinch }: { clinch: ClinchFile }) {
  const champion = clinch.drivers.find((d) => d.status === 'clinched');
  const tracked = clinch.drivers.filter((d) => TRACKED.has(d.driverId));
  const untrackedAlive = clinch.drivers.filter(
    (d) => d.status !== 'eliminated' && !TRACKED.has(d.driverId) && d.driverId !== champion?.driverId,
  );
  const eliminated = clinch.drivers.filter((d) => d.status === 'eliminated');
  // Group eliminations by the round they happened at, newest first.
  const byRound = new Map<string, string[]>();
  for (const d of eliminated) {
    const key = d.eliminatedAt?.raceName ?? 'Before this data begins';
    byRound.set(key, [...(byRound.get(key) ?? []), lastName(d.name)]);
  }

  return (
    <section className="panel" style={{ marginTop: 18 }} aria-label="Clinch scenarios">
      <h2 className="panel-title">Clinch scenarios</h2>
      <p className="panel-sub num">
        After round {clinch.based_on_round} · {clinch.points_available} points still on the table
        across {clinch.remaining_races} races ({clinch.remaining_sprints} sprint
        {clinch.remaining_sprints === 1 ? '' : 's'})
      </p>

      {champion && (
        <div className="champion-banner">
          🏆 <b>{champion.name}</b> is the 2026 World Champion
          {champion.clinchedAt?.raceName ? ` — title sealed at the ${champion.clinchedAt.raceName}.` : '.'}
        </div>
      )}

      <div className="clinch-list">
        {tracked.map((d) => {
          const driver = TRACKED.get(d.driverId)!;
          const accent = { '--team': driver.color } as React.CSSProperties;
          if (d.status === 'clinched') return null; // covered by the banner
          if (d.status === 'eliminated') {
            return (
              <div className="clinch-row out" key={d.driverId} style={accent}>
                <span className="clinch-badge num"><span className="round-no">out</span></span>
                <p>
                  <b>{driver.lastName}</b> can no longer win the title
                  {d.eliminatedAt?.raceName
                    ? ` — mathematically eliminated at the ${d.eliminatedAt.raceName}.`
                    : '.'}
                </p>
              </div>
            );
          }
          if (!d.clinch) {
            return (
              <div className="clinch-row" key={d.driverId} style={accent}>
                <span className="clinch-badge num"><span className="round-no">tie</span></span>
                <p>
                  <b>{driver.lastName}</b> can at best equal the leader on points — the title
                  would then go to a wins countback.
                </p>
              </div>
            );
          }
          const isLeader = d.position === 1;
          const flag = flagFor(d.clinch.country);
          return (
            <div className="clinch-row" key={d.driverId} style={accent}>
              <span className="clinch-badge num">
                {flag && <img className="clinch-flag" src={flag} alt="" />}
                <span className="round-no">R{d.clinch.round}</span>
              </span>
              <p>
                <b>{driver.lastName}</b> {isLeader ? 'wins the title' : 'can clinch, at the earliest,'}{' '}
                in <b>{d.clinch.locality}</b> on {fmtDate(d.clinch.date)} — if he outscores{' '}
                {d.clinch.chiefRivalName ? lastName(d.clinch.chiefRivalName) : 'his closest rival'} by{' '}
                <b className="num">{d.clinch.gapNeeded} points</b> before then.
              </p>
            </div>
          );
        })}
      </div>

      <div className="clinch-footnotes">
        {untrackedAlive.length > 0 && (
          <p>
            Also still mathematically alive:{' '}
            {untrackedAlive.map((d) => lastName(d.name)).join(', ')}.
          </p>
        )}
        {byRound.size > 0 && (
          <p>
            Out of the running:{' '}
            {[...byRound.entries()]
              .map(([raceName, names]) => `${names.join(', ')} (${raceName.replace(' Grand Prix', ' GP')})`)
              .join(' · ')}
            .
          </p>
        )}
        <p className="quiet-note">
          "Clinch" and "eliminated" are strict: reaching a points tie counts as alive, since ties
          are settled by a wins countback this model doesn't predict.
        </p>
      </div>
    </section>
  );
}
