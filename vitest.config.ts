import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'api',
          root: './apps/api',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          setupFiles: ['./test/setup.ts'],
        },
      },
    ],
  },
});
