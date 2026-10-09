import type { KnipConfig } from 'knip';

export const siteKnip: KnipConfig = {
  entry: ['src/pages/**/*.tsx', 'src/locales/*.ts', 'src/projects/registry.ts', 'src/projects/**/{meta,project,locales/*}.ts', 'scripts/**/*.ts'],
  project: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
  ignoreDependencies: ['tailwindcss', '@babel/plugin-syntax-jsx', '@babel/preset-typescript'],
};
