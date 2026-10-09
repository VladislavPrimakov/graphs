import fs from 'node:fs';
import path from 'node:path';
import { transformAsync } from '@babel/core';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import reactCompiler from 'babel-plugin-react-compiler';
import { defineConfig, type Plugin } from 'vite';
import { parseChangelogVersions } from './src/utils/version';

const changelog = fs.readFileSync(path.resolve(__dirname, '../CHANGELOG.md'), 'utf-8');
const siteVersion = parseChangelogVersions(changelog)[0] ?? '0.0.0';

function reactCompilerPlugin(): Plugin {
  return {
    name: 'vite-plugin-react-compiler',
    enforce: 'pre',
    async transform(code, id) {
      const [filepath] = id.split('?');
      if (!/\.[jt]sx$/.test(filepath) || filepath.includes('node_modules') || filepath.includes('virtual:')) {
        return;
      }

      const result = await transformAsync(code, {
        filename: filepath,
        plugins: [[reactCompiler, { target: '19' }], '@babel/plugin-syntax-jsx'],
        presets: ['@babel/preset-typescript'],
        sourceMaps: true,
      });

      if (!result?.code) return;

      return {
        code: result.code,
        // biome-ignore lint/suspicious/noExplicitAny: Babel EncodedSourceMap (file?: string | null) is incompatible with Rollup ExistingRawSourceMap (file?: string)
        map: (result.map ?? undefined) as any,
      };
    },
  };
}

const rawBase = process.env.BASE_URL ?? '/graphs';
const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

export default defineConfig(({ command }) => ({
  base,
  plugins: [reactCompilerPlugin(), reactRouter(), tailwindcss()],
  server: {
    port: 3000,
  },
  preview: {
    port: 3001,
  },
  logLevel: command === 'build' ? 'warn' : 'info',
  define: {
    __SITE_VERSION__: JSON.stringify(siteVersion),
  },
  resolve: {
    alias: {
      '@graphs/types': path.resolve(__dirname, '../types'),
      '@': path.resolve(__dirname, './src'),
      '@data': path.resolve(__dirname, './src/data'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        if (warning.code === 'DYNAMIC_IMPORT_WILL_NOT_MOVE' || warning.message?.includes('dynamic import will not move module')) {
          return;
        }
        defaultHandler(warning);
      },
    },
  },
}));
