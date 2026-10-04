import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  ignoreExportsUsedInFile: true,
  rules: {
    files: 'error',
    dependencies: 'error',
    unlisted: 'error',
    unresolved: 'error',
    exports: 'error',
    types: 'error',
    duplicates: 'error',
  },
  workspaces: {
    site: {
      entry: ['src/pages/**/*.tsx', 'src/projects/registry.ts', 'src/projects/**/project.ts', 'src/projects/**/meta.ts', 'src/projects/**/locales/*.ts', 'src/locales/**/*.ts', 'scripts/**/*.ts'],
      project: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
      ignoreDependencies: ['tailwindcss', '@babel/plugin-syntax-jsx', '@babel/preset-typescript'],
    },
    pipelines: {
      entry: ['src/**/index.ts', 'src/**/*.test.ts', 'src/utils/**/*.ts'],
      project: ['src/**/*.ts'],
    },
    types: {
      entry: ['projects/**/*.ts'],
      project: ['**/*.ts'],
    },
  },
};

export default config;
