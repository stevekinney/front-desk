import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';

import { apply, recordingContext, ruleTicket } from './record.js';

const require = createRequire(import.meta.url);
const rulePath = require.resolve('../../rules/assign-round-robin');

// The rotation lives in the module, so reload it to start every test at teammate 1.
let rule;
beforeEach(() => {
  delete require.cache[rulePath];
  rule = require(rulePath);
});

const teammates = [
  { id: 1, name: 'Priya Raman' },
  { id: 2, name: 'Dana Whitfield' },
  { id: 3, name: 'Marcus Lee' },
];

describe('assign-round-robin', () => {
  it('only looks at open tickets that nobody has', () => {
    expect(rule.when(ruleTicket())).toBe(true);
    expect(rule.when(ruleTicket({ assignee_id: 2 }))).toBe(false);
    expect(rule.when(ruleTicket({ status: 'pending' }))).toBe(false);
  });

  it('gives the first ticket to the first teammate', async () => {
    const ctx = recordingContext({ teammates });
    await apply(rule, ruleTicket(), ctx);
    expect(ctx.effects).toEqual([{ type: 'assign', teammateId: 1 }]);
  });

  it('gives the next ticket to the next teammate', async () => {
    const ctx = recordingContext({ teammates });
    await apply(rule, ruleTicket({ id: 1 }), ctx);
    await apply(rule, ruleTicket({ id: 2 }), ctx);
    expect(ctx.effects).toEqual([
      { type: 'assign', teammateId: 1 },
      { type: 'assign', teammateId: 2 },
    ]);
  });

  it('leaves spam for the spam folder', async () => {
    const ctx = recordingContext({ teammates });
    await apply(rule, ruleTicket({ id: 1, tags: ['spam'] }), ctx);
    await apply(rule, ruleTicket({ id: 2 }), ctx);
    expect(ctx.effects).toEqual([{ type: 'assign', teammateId: 1 }]);
  });

  it('wraps around after the last teammate', async () => {
    const ctx = recordingContext({ teammates });
    for (const id of [1, 2, 3, 4]) await apply(rule, ruleTicket({ id }), ctx);
    expect(ctx.effects).toEqual([1, 2, 3, 1].map((teammateId) => ({ type: 'assign', teammateId })));
  });

  it('does nothing when nobody is on the desk', async () => {
    const ctx = recordingContext({ teammates: [] });
    await apply(rule, ruleTicket({ id: 6 }), ctx);
    expect(ctx.effects).toEqual([]);
  });
});
