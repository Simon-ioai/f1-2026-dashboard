// OpenF1 fallback — used only when Jolpica is down, to patch in the most
// recent race result so the dashboard stays fresh. OpenF1 does not publish
// championship points, so points are derived from finishing position using
// the standard scoring table (no fastest-lap bonus in 2026).

import { fetchJson } from './io.js';

const BASE = 'https://api.openf1.org/v1';

const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];

interface OpenF1Session {
  session_key: number;
  meeting_key: number;
  session_name: string;
  date_start: string;
  location: string;
  country_name: string;
  circuit_short_name: string;
  year: number;
}

interface OpenF1SessionResult {
  position: number | null;
  driver_number: number;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
}

interface OpenF1Driver {
  driver_number: number;
  full_name: string;
  name_acronym: string;
  team_name: string;
}

export interface FallbackResult {
  sessionName: 'Race' | 'Sprint';
  dateStart: string;
  location: string;
  country: string;
  circuit: string;
  results: {
    position: number | null;
    driverNumber: number;
    fullName: string;
    code: string;
    team: string;
    points: number;
    status: string;
  }[];
}

/** Most recent completed Race (or Sprint) session of the season, with results. */
export async function getLatestSessionResult(
  year: number,
  sessionName: 'Race' | 'Sprint' = 'Race',
): Promise<FallbackResult | null> {
  const sessions = await fetchJson<OpenF1Session[]>(
    `${BASE}/sessions?year=${year}&session_name=${sessionName}`,
  );
  const past = sessions
    .filter((s) => new Date(s.date_start).getTime() < Date.now())
    .sort((a, b) => a.date_start.localeCompare(b.date_start));
  const latest = past[past.length - 1];
  if (!latest) return null;

  const [results, drivers] = await Promise.all([
    fetchJson<OpenF1SessionResult[]>(`${BASE}/session_result?session_key=${latest.session_key}`),
    fetchJson<OpenF1Driver[]>(`${BASE}/drivers?session_key=${latest.session_key}`),
  ]);
  const byNumber = new Map(drivers.map((d) => [d.driver_number, d]));
  const points = sessionName === 'Race' ? RACE_POINTS : SPRINT_POINTS;

  return {
    sessionName,
    dateStart: latest.date_start,
    location: latest.location,
    country: latest.country_name,
    circuit: latest.circuit_short_name,
    results: results
      .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
      .map((r) => {
        const d = byNumber.get(r.driver_number);
        const scored = r.position !== null && !r.dnf && !r.dns && !r.dsq ? points[r.position - 1] ?? 0 : 0;
        return {
          position: r.position,
          driverNumber: r.driver_number,
          fullName: d?.full_name ?? `#${r.driver_number}`,
          code: d?.name_acronym ?? '???',
          team: d?.team_name ?? 'Unknown',
          points: scored,
          status: r.dsq ? 'Disqualified' : r.dns ? 'DNS' : r.dnf ? 'DNF' : 'Finished',
        };
      }),
  };
}
