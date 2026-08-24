// Loaders for the static JSON "database". Every file is optional at runtime:
// a missing or failed fetch degrades to null and the UI renders what it has,
// with warnings from meta.json surfaced in the status bar.

export interface AggregatedProbability {
  median: number;
  min: number;
  max: number;
  books: number;
}

export interface TimelinePoint {
  date: string; // YYYY-MM-DD
  fetched_at: string;
  /** 'polymarket' | 'polymarket-history' | 'the-odds-api' */
  source?: string;
  /** Number of bookmakers aggregated (1 for prediction-market points). */
  bookmakers: number;
  byId: Record<string, AggregatedProbability>;
}

export interface RaceAnnotation {
  round: number;
  name: string;
  circuit: string;
  locality: string;
  country: string;
  date: string;
  hasSprint: boolean;
  winner: { driverId: string; code: string | null; name: string; team: string } | null;
}

export interface Timeline {
  generated_at: string;
  snapshot_days: number;
  points: TimelinePoint[];
  races: RaceAnnotation[];
}

export interface StandingsFile {
  season: number;
  round: number;
  fetched_at: string;
  standings: {
    position: number | null;
    driverId: string;
    code: string | null;
    name: string;
    team: string;
    points: number;
    wins: number;
  }[];
}

export interface Meta {
  results_updated_at: string | null;
  odds_updated_at: string | null;
  derived_updated_at: string | null;
  warnings: { source: string; message: string; at: string }[];
}

export interface DashboardData {
  timeline: Timeline | null;
  standings: StandingsFile | null;
  meta: Meta | null;
  fetchErrors: string[];
}

async function tryFetch<T>(path: string, errors: string[]): Promise<T | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${path}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    errors.push(`${path}: ${String(err instanceof Error ? err.message : err)}`);
    return null;
  }
}

export async function loadDashboardData(): Promise<DashboardData> {
  const fetchErrors: string[] = [];
  const [timeline, standings, meta] = await Promise.all([
    tryFetch<Timeline>('data/derived/timeline.json', fetchErrors),
    tryFetch<StandingsFile>('data/results/standings.json', fetchErrors),
    tryFetch<Meta>('data/derived/meta.json', fetchErrors),
  ]);
  return { timeline, standings, meta, fetchErrors };
}
