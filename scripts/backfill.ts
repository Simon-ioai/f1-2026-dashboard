// First-run seeding: fetch the season so far (schedule, results, standings,
// sprints, qualifying) and build derived files.
//
// Honest limitation: odds history before the first snapshot CANNOT be
// backfilled — historical odds are a paid feature on The Odds API. The odds
// timeline therefore starts on the day the first snapshot is taken.

import { updateResults } from './update-results.js';
import { buildDerived } from './build-derived.js';

console.log('Backfilling season data (results, standings, schedule)…');
await updateResults();
buildDerived();
await import('./simulate.js'); // run the Monte Carlo pass on the fresh data
console.log(
  '\nDone. Note: past odds cannot be backfilled on the free plan — ' +
    'the odds timeline starts at your first snapshot (npm run snapshot:odds).',
);
