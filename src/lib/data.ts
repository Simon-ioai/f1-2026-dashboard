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

export interface SimulationsFile {
  generated_at: string;
  method: {
    iterations: number;
    seed: number;
    recent_window: number;
    recent_weight: number;
    based_on_rounds: number;
    remaining_races: number;
    remaining_sprints: number;
    notes: string;
  };
  drivers: {
    driverId: string;
    name: string;
    team: string;
    code: string | null;
    currentPoints: number;
    dnfRate: number;
    titleProb: number;
    mean: number;
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  }[];
  histograms: Record<string, { binStart: number; binWidth: number; counts: number[] }>;
}

export interface ClinchFile {
  generated_at: string;
  based_on_round: number;
  remaining_races: number;
  remaining_sprints: number;
  points_available: number;
  drivers: {
    driverId: string;
    code: string | null;
    name: string;
    team: string;
    position: number | null;
    points: number;
    status: 'clinched' | 'alive' | 'eliminated';
    clinch: {
      round: number;
      raceName: string;
      locality: string;
      date: string;
      gapNeeded: number | null;
      chiefRivalId: string | null;
      chiefRivalName: string | null;
    } | null;
    clinchedAt: { round: number; raceName: string | null } | null;
    eliminatedAt: { round: number; raceName: string | null; date: string | null } | null;
  }[];
}

export interface H2HFile {
  generated_at: string;
  based_on_round: number;
  note: string;
  teams: {
    team: string;
    primary: { driverId: string; code: string | null; name: string; points: number };
    partners: {
      driverId: string;
      code: string | null;
      name: string;
      points: number;
      rounds: number;
      qualiWins: number;
      qualiLosses: number;
      raceWins: number;
      raceLosses: number;
      medianGapMs: number | null;
      comparableLaps: number;
    }[];
    overall: {
      qualiWins: number;
      qualiLosses: number;
      raceWins: number;
      raceLosses: number;
      medianGapMs: number | null;
      comparableLaps: number;
    };
    trend: {
      round: number;
      locality: string;
      gapMs: number | null;
      session: string | null;
      partnerId: string;
      partnerCode: string | null;
    }[];
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
  simulations: SimulationsFile | null;
  clinch: ClinchFile | null;
  h2h: H2HFile | null;
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
  const [timeline, standings, simulations, clinch, h2h, meta] = await Promise.all([
    tryFetch<Timeline>('data/derived/timeline.json', fetchErrors),
    tryFetch<StandingsFile>('data/results/standings.json', fetchErrors),
    tryFetch<SimulationsFile>('data/derived/simulations.json', fetchErrors),
    tryFetch<ClinchFile>('data/derived/clinch.json', fetchErrors),
    tryFetch<H2HFile>('data/derived/h2h.json', fetchErrors),
    tryFetch<Meta>('data/derived/meta.json', fetchErrors),
  ]);
  return { timeline, standings, simulations, clinch, h2h, meta, fetchErrors };
}
