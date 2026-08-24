// The six tracked title contenders, their 2026 teams and chart colours.
// Teammates share the team hue in two shades and the second driver renders
// dashed, so team identity is honest and lines stay distinguishable (palette
// validated for CVD separation and contrast on the dark surface).

export interface TrackedDriver {
  id: string; // Jolpica driverId
  code: string;
  firstName: string;
  lastName: string;
  team: string;
  color: string;
  dashed: boolean;
  /** Names bookmakers use for this driver (lowercased for matching). */
  aliases: string[];
}

export const TRACKED_DRIVERS: TrackedDriver[] = [
  {
    id: 'antonelli',
    code: 'ANT',
    firstName: 'Kimi',
    lastName: 'Antonelli',
    team: 'Mercedes',
    color: '#00F5D0',
    dashed: false,
    aliases: ['kimi antonelli', 'andrea kimi antonelli', 'antonelli'],
  },
  {
    id: 'russell',
    code: 'RUS',
    firstName: 'George',
    lastName: 'Russell',
    team: 'Mercedes',
    color: '#00937F',
    dashed: true,
    aliases: ['george russell', 'russell'],
  },
  {
    id: 'hamilton',
    code: 'HAM',
    firstName: 'Lewis',
    lastName: 'Hamilton',
    team: 'Ferrari',
    color: '#FFA3B5',
    dashed: true,
    aliases: ['lewis hamilton', 'hamilton'],
  },
  {
    id: 'leclerc',
    code: 'LEC',
    firstName: 'Charles',
    lastName: 'Leclerc',
    team: 'Ferrari',
    color: '#E8002D',
    dashed: false,
    aliases: ['charles leclerc', 'leclerc'],
  },
  {
    id: 'norris',
    code: 'NOR',
    firstName: 'Lando',
    lastName: 'Norris',
    team: 'McLaren',
    color: '#FF8700',
    dashed: false,
    aliases: ['lando norris', 'norris'],
  },
  {
    id: 'max_verstappen',
    code: 'VER',
    firstName: 'Max',
    lastName: 'Verstappen',
    team: 'Red Bull',
    color: '#3671C6',
    dashed: false,
    aliases: ['max verstappen', 'verstappen'],
  },
];

export const FIELD = {
  id: 'field',
  code: 'FLD',
  label: 'Field',
  color: '#6B7280',
} as const;

export const TRACKED_IDS = TRACKED_DRIVERS.map((d) => d.id);

/** Match a bookmaker outcome name to a tracked driver id, or null if part of the field. */
export function matchDriver(outcomeName: string): string | null {
  const name = outcomeName.trim().toLowerCase();
  for (const d of TRACKED_DRIVERS) {
    if (d.aliases.includes(name)) return d.id;
    // fall back to surname-contained matching ("A. K. Antonelli", "M. Verstappen")
    if (name.includes(d.lastName.toLowerCase())) return d.id;
  }
  return null;
}
