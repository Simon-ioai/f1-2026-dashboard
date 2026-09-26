// The six tracked title contenders, their 2026 teams and chart colours.
// Colours are CSS variables so each theme (dark / light, via
// prefers-color-scheme) supplies its own validated set — the concrete values
// live in index.css. Teammates keep dash differentiation as a colour-blind
// fallback, and the array order is the legend order, arranged so no two
// similar hues sit next to each other.

export interface TrackedDriver {
  id: string; // Jolpica driverId
  code: string;
  firstName: string;
  lastName: string;
  team: string;
  /** CSS variable reference, e.g. 'var(--dc-antonelli)'. */
  color: string;
  dashed: boolean;
  /** Names bookmakers use for this driver (lowercased for matching). */
  aliases: string[];
}

const driver = (
  id: string,
  code: string,
  firstName: string,
  lastName: string,
  team: string,
  dashed: boolean,
  aliases: string[],
): TrackedDriver => ({
  id,
  code,
  firstName,
  lastName,
  team,
  color: `var(--dc-${id})`,
  dashed,
  aliases,
});

export const TRACKED_DRIVERS: TrackedDriver[] = [
  driver('antonelli', 'ANT', 'Kimi', 'Antonelli', 'Mercedes', false, [
    'kimi antonelli',
    'andrea kimi antonelli',
    'antonelli',
  ]),
  driver('leclerc', 'LEC', 'Charles', 'Leclerc', 'Ferrari', false, ['charles leclerc', 'leclerc']),
  driver('russell', 'RUS', 'George', 'Russell', 'Mercedes', true, ['george russell', 'russell']),
  driver('norris', 'NOR', 'Lando', 'Norris', 'McLaren', false, ['lando norris', 'norris']),
  driver('hamilton', 'HAM', 'Lewis', 'Hamilton', 'Ferrari', true, ['lewis hamilton', 'hamilton']),
  driver('max_verstappen', 'VER', 'Max', 'Verstappen', 'Red Bull', false, [
    'max verstappen',
    'verstappen',
  ]),
];

export const FIELD = {
  id: 'field',
  code: 'FLD',
  label: 'Field',
  color: 'var(--dc-field)',
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
