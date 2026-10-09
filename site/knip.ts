import type { KnipConfig } from 'knip';

export const siteKnip: KnipConfig = {
  project: ['src/**/*.{ts,tsx,css}', 'scripts/**/*.ts', 'tests/**/*.ts'],
  ignoreDependencies: ['@babel/plugin-syntax-jsx', '@babel/preset-typescript'],
};
