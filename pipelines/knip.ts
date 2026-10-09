import type { KnipConfig } from 'knip';

export const pipelinesKnip: KnipConfig = {
  entry: ['src/**/*.test.ts'],
  project: ['src/**/*.ts'],
};
