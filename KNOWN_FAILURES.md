# Known failures

The tests below are known to fail on `main` under the conditions listed. `npm run smoke` reads this file: a failure in a file listed here is reported as known, and anything else is reported as new.

Keep each entry to one file path in backticks at the start of a list item, followed by when it fails and the backlog item that tracks it. Remove an entry when its fix lands.

- `legacy/test/rules/assign-round-robin.test.js`: fails in more than half of shuffled test orders, which is how CI and `npm run smoke` run the suite. It passes in the default order that `npm test` and `npm run check` use, and `npm run smoke` says so when a seed happens to miss it. Reproduce one order with `npm run smoke -- --seed 2`. Tracked as FD-03.
