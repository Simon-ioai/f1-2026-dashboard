// Jolpica-F1 (the maintained successor to the frozen Ergast API).
// All list endpoints are paginated with a max page size of 100.

import { fetchJson, sleep } from './io.js';

const BASE = 'https://api.jolpi.ca/ergast/f1';
const PAGE = 100;

interface MRData {
  MRData: {
    total: string;
    limit: string;
    offset: string;
    RaceTable?: { Races: JolpicaRace[] };
    StandingsTable?: { StandingsLists: StandingsList[] };
  };
}

export interface JolpicaRace {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit: {
    circuitId: string;
    circuitName: string;
    Location: { locality: string; country: string };
  };
  Sprint?: { date: string; time?: string };
  Results?: RaceResult[];
  SprintResults?: RaceResult[];
  QualifyingResults?: QualifyingResult[];
}

export interface RaceResult {
  position: string;
  positionText: string;
  points: string;
  grid?: string;
  laps?: string;
  status?: string;
  Driver: { driverId: string; code?: string; givenName: string; familyName: string; permanentNumber?: string };
  Constructor: { constructorId: string; name: string };
  Time?: { millis?: string; time?: string };
}

export interface QualifyingResult {
  position: string;
  Driver: { driverId: string; code?: string; givenName: string; familyName: string };
  Constructor: { constructorId: string; name: string };
  Q1?: string;
  Q2?: string;
  Q3?: string;
}

export interface StandingsList {
  season: string;
  round: string;
  DriverStandings: {
    position?: string;
    positionText: string;
    points: string;
    wins: string;
    Driver: { driverId: string; code?: string; givenName: string; familyName: string };
    Constructors: { constructorId: string; name: string }[];
  }[];
}

/** Fetch every page of a race-table endpoint and merge Races that span pages. */
async function fetchAllRaces(path: string): Promise<JolpicaRace[]> {
  const merged = new Map<string, JolpicaRace>();
  let offset = 0;
  for (;;) {
    const page = await fetchJson<MRData>(`${BASE}/${path}.json?limit=${PAGE}&offset=${offset}`);
    const races = page.MRData.RaceTable?.Races ?? [];
    for (const race of races) {
      const existing = merged.get(race.round);
      if (!existing) {
        merged.set(race.round, race);
      } else {
        // rows for the same race can span pages; concatenate result arrays
        if (race.Results) existing.Results = [...(existing.Results ?? []), ...race.Results];
        if (race.SprintResults) existing.SprintResults = [...(existing.SprintResults ?? []), ...race.SprintResults];
        if (race.QualifyingResults)
          existing.QualifyingResults = [...(existing.QualifyingResults ?? []), ...race.QualifyingResults];
      }
    }
    offset += PAGE;
    if (offset >= Number(page.MRData.total)) break;
    await sleep(300); // stay well inside Jolpica's rate limits
  }
  return [...merged.values()].sort((a, b) => Number(a.round) - Number(b.round));
}

export const getSchedule = (season: number) => fetchAllRaces(`${season}`);
export const getResults = (season: number) => fetchAllRaces(`${season}/results`);
export const getSprints = (season: number) => fetchAllRaces(`${season}/sprint`);
export const getQualifying = (season: number) => fetchAllRaces(`${season}/qualifying`);

export async function getDriverStandings(season: number): Promise<StandingsList | null> {
  const page = await fetchJson<MRData>(`${BASE}/${season}/driverstandings.json?limit=${PAGE}`);
  return page.MRData.StandingsTable?.StandingsLists[0] ?? null;
}
