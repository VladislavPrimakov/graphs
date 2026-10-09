import type { KnipConfig } from 'knip';

export const pipelinesKnip: KnipConfig = {
  entry: ['src/**/index.ts', 'src/**/*.test.ts', 'src/utils/**/*.ts', 'scripts/**/*.ts'],
  project: ['src/**/*.ts', 'scripts/**/*.ts'],
};
