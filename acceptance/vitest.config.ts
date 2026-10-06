import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * The acceptance suite: one or more files per backlog item, run by
 * `npm run feature:check -- <id>`. It is not part of `npm test`.
 */
const root = path.resolve(import.meta.dirname, '..');

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'acceptance',
          root,
          environment: 'node',
          include: ['acceptance/FD-*.test.ts'],
          exclude: ['acceptance/FD-*.ui.test.ts'],
          setupFiles: ['./acceptance/support/setup.ts'],
          testTimeout: 120_000,
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'acceptance-web',
          root,
          environment: 'jsdom',
          include: ['acceptance/FD-*.ui.test.ts'],
          setupFiles: ['./acceptance/support/setup-web.ts'],
        },
      },
    ],
  },
});
