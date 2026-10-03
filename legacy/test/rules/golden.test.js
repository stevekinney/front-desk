import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { apply, recordingContext } from './record.js';

const require = createRequire(import.meta.url);
const { rules } = require('../../rules');

const fixturesDir = path.resolve(import.meta.dirname, '../../../fixtures/rules');

describe('golden cases', () => {
  it('has a fixture for every rule', () => {
    const fixtures = fs
      .readdirSync(fixturesDir)
      .map((file) => file.replace(/\.json$/, ''))
      .sort();
    expect(fixtures).toEqual(rules.map((rule) => rule.name).sort());
  });

  for (const rule of rules) {
    it(`${rule.name} matches its fixture`, async () => {
      const golden = JSON.parse(
        fs.readFileSync(path.join(fixturesDir, rule.name + '.json'), 'utf8'),
      );
      for (const goldenCase of golden.cases) {
        const ctx = recordingContext({
          now: goldenCase.now ?? golden.now,
          teammates: goldenCase.teammates ?? golden.teammates,
        });
        const ticket = structuredClone(goldenCase.ticket);
        const when = await apply(rule, ticket, ctx);
        expect({ when, effects: ctx.effects }, goldenCase.name).toEqual(goldenCase.expected);
      }
    });
  }
});
