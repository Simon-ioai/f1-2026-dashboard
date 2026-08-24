// Odds maths. This is the single most important calculation in the project:
// decimal odds -> raw implied probability -> vig-removed ("true") probability,
// normalised across the ENTIRE field per bookmaker, then aggregated across
// bookmakers as median with a min-max range.

export interface Outcome {
  name: string;
  /** Decimal (European) odds, e.g. 3.5 means 1/3.5 raw implied probability. */
  price: number;
}

export interface BookmakerOdds {
  key: string;
  title: string;
  lastUpdate: string;
  outcomes: Outcome[];
}

/** Raw implied probability of decimal odds. Throws on odds <= 1 (impossible price). */
export function impliedFromDecimal(odds: number): number {
  if (!Number.isFinite(odds) || odds < 1) {
    throw new Error(`Invalid decimal odds: ${odds}`);
  }
  return 1 / odds;
}

/**
 * Normalise one bookmaker's full-field outcomes to true probabilities that sum to 1.
 * The sum of raw implied probabilities exceeds 1 (the bookmaker's overround);
 * dividing by that sum removes it.
 */
export function normalizeBook(outcomes: Outcome[]): Map<string, number> {
  if (outcomes.length === 0) return new Map();
  const raw = outcomes.map((o) => ({ name: o.name, p: impliedFromDecimal(o.price) }));
  const overround = raw.reduce((sum, o) => sum + o.p, 0);
  return new Map(raw.map((o) => [o.name, o.p / overround]));
}

/** Median of a non-empty array. Even-length arrays average the middle two. */
export function median(values: number[]): number {
  if (values.length === 0) throw new Error('median of empty array');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface AggregatedProbability {
  median: number;
  min: number;
  max: number;
  /** How many bookmakers priced this outcome. */
  books: number;
}

/**
 * Aggregate across bookmakers. Each bookmaker is normalised over its own full
 * field first; `matcher` maps an outcome name to a canonical id (tracked driver)
 * or null, in which case the outcome is pooled into `fieldId`. Per bookmaker the
 * field probability is the sum of its unmatched outcomes' true probabilities.
 */
export function aggregateBooks(
  books: BookmakerOdds[],
  matcher: (outcomeName: string) => string | null,
  fieldId = 'field',
): Map<string, AggregatedProbability> {
  const perId = new Map<string, number[]>();
  for (const book of books) {
    if (book.outcomes.length === 0) continue;
    const normalized = normalizeBook(book.outcomes);
    let fieldSum = 0;
    for (const [name, p] of normalized) {
      const id = matcher(name);
      if (id === null) {
        fieldSum += p;
      } else {
        const arr = perId.get(id) ?? [];
        arr.push(p);
        perId.set(id, arr);
      }
    }
    const fieldArr = perId.get(fieldId) ?? [];
    fieldArr.push(fieldSum);
    perId.set(fieldId, fieldArr);
  }
  const result = new Map<string, AggregatedProbability>();
  for (const [id, values] of perId) {
    result.set(id, {
      median: median(values),
      min: Math.min(...values),
      max: Math.max(...values),
      books: values.length,
    });
  }
  return result;
}
