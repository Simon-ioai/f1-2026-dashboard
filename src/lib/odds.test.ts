import { describe, expect, it } from 'vitest';
import { aggregateBooks, impliedFromDecimal, median, normalizeBook, type BookmakerOdds } from './odds';

describe('impliedFromDecimal', () => {
  it('converts decimal odds to raw implied probability', () => {
    expect(impliedFromDecimal(2.0)).toBeCloseTo(0.5, 10);
    expect(impliedFromDecimal(1.5)).toBeCloseTo(2 / 3, 10);
    expect(impliedFromDecimal(100)).toBeCloseTo(0.01, 10);
  });

  it('rejects impossible odds', () => {
    expect(() => impliedFromDecimal(0.9)).toThrow();
    expect(() => impliedFromDecimal(0)).toThrow();
    expect(() => impliedFromDecimal(NaN)).toThrow();
  });
});

describe('normalizeBook — the known worked example', () => {
  // Bookmaker prices a three-driver field at 1.5, 3.0, 6.0.
  // Raw implied: 0.6667 + 0.3333 + 0.1667 = 1.1667 (16.67% overround).
  // True probabilities: 4/7, 2/7, 1/7 — and they must sum to exactly 1.
  const book = [
    { name: 'Kimi Antonelli', price: 1.5 },
    { name: 'Lando Norris', price: 3.0 },
    { name: 'Max Verstappen', price: 6.0 },
  ];

  it('removes the overround by normalising over the full field', () => {
    const p = normalizeBook(book);
    expect(p.get('Kimi Antonelli')).toBeCloseTo(4 / 7, 10);
    expect(p.get('Lando Norris')).toBeCloseTo(2 / 7, 10);
    expect(p.get('Max Verstappen')).toBeCloseTo(1 / 7, 10);
  });

  it('sums to exactly 1 after normalisation', () => {
    const sum = [...normalizeBook(book).values()].reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 12);
  });

  it('an overround-free book is unchanged by normalisation', () => {
    const fair = normalizeBook([
      { name: 'A', price: 2.0 },
      { name: 'B', price: 2.0 },
    ]);
    expect(fair.get('A')).toBeCloseTo(0.5, 12);
  });
});

describe('median', () => {
  it('handles odd and even counts', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([7])).toBe(7);
  });
  it('throws on empty input', () => {
    expect(() => median([])).toThrow();
  });
});

describe('aggregateBooks', () => {
  const matcher = (name: string) =>
    ({ 'Kimi Antonelli': 'antonelli', 'Lando Norris': 'norris' })[name] ?? null;

  const mkBook = (key: string, prices: [string, number][]): BookmakerOdds => ({
    key,
    title: key,
    lastUpdate: '2026-08-24T12:00:00Z',
    outcomes: prices.map(([name, price]) => ({ name, price })),
  });

  it('takes the median across bookmakers and the min-max range', () => {
    // Three books price Antonelli in a fair two-man field at 50%, 60%, 80%.
    const books = [
      mkBook('a', [['Kimi Antonelli', 2.0], ['Lando Norris', 2.0]]),
      mkBook('b', [['Kimi Antonelli', 1 / 0.6], ['Lando Norris', 1 / 0.4]]),
      mkBook('c', [['Kimi Antonelli', 1.25], ['Lando Norris', 5.0]]),
    ];
    const agg = aggregateBooks(books, matcher);
    const ant = agg.get('antonelli')!;
    expect(ant.median).toBeCloseTo(0.6, 10);
    expect(ant.min).toBeCloseTo(0.5, 10);
    expect(ant.max).toBeCloseTo(0.8, 10);
    expect(ant.books).toBe(3);
  });

  it('pools unmatched outcomes into the field, per bookmaker, after normalising', () => {
    const books = [
      mkBook('a', [
        ['Kimi Antonelli', 2.0], // raw 0.5
        ['Somebody Else', 4.0], // raw 0.25
        ['Another Driver', 4.0], // raw 0.25
      ]),
    ];
    const agg = aggregateBooks(books, matcher);
    expect(agg.get('antonelli')!.median).toBeCloseTo(0.5, 10);
    expect(agg.get('field')!.median).toBeCloseTo(0.5, 10);
  });

  it('tracked + field sums to 1 for every bookmaker', () => {
    const books = [
      mkBook('a', [
        ['Kimi Antonelli', 1.8],
        ['Lando Norris', 3.4],
        ['Unknown One', 9.0],
        ['Unknown Two', 15.0],
      ]),
    ];
    const agg = aggregateBooks(books, matcher);
    const total =
      agg.get('antonelli')!.median + agg.get('norris')!.median + agg.get('field')!.median;
    expect(total).toBeCloseTo(1, 12);
  });

  it('skips bookmakers with no outcomes rather than crashing', () => {
    const agg = aggregateBooks([mkBook('empty', [])], matcher);
    expect(agg.size).toBe(0);
  });
});
