import fs from 'node:fs';
import path from 'node:path';
import { transformAsync } from '@babel/core';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import reactCompiler from 'babel-plugin-react-compiler';
import { Marked } from 'marked';
import { defineConfig, type Plugin } from 'vite';
import { parseChangelogReleases, parseChangelogVersions } from './src/utils/version';
import { SECTION_DATA_ATTR } from './src/utils/viewport';

const changelogPath = path.resolve(__dirname, '../CHANGELOG.md');
const changelog = fs.readFileSync(changelogPath, 'utf-8');
const siteVersion = parseChangelogVersions(changelog)[0] ?? '0.0.0';

function changelogPlugin(): Plugin {
  const virtualModuleId = 'virtual:changelog';
  const resolvedVirtualModuleId = `\0${virtualModuleId}`;

  return {
    name: 'vite-plugin-changelog',
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    async load(id) {
      if (id !== resolvedVirtualModuleId) return;

      this.addWatchFile(changelogPath);
      const raw = fs.readFileSync(changelogPath, 'utf-8');
      const releases = parseChangelogReleases(raw);
      const marked = new Marked({ gfm: true });
      marked.use({
        renderer: {
          heading({ text, depth }) {
            if (depth === 2) {
              const match = text.match(/\[(\d+\.\d+\.\d+)\]/);
              if (match) {
                const sectionId = `v${match[1]}`;
                return `<h2 id="${sectionId}" ${SECTION_DATA_ATTR}="${sectionId}">${text}</h2>\n`;
              }
              const slug = text
                .toLowerCase()
                .replace(/[^\w]+/g, '-')
                .replace(/^-|-$/g, '');
              return `<h2 id="${slug}">${text}</h2>\n`;
            }
            return `<h${depth}>${text}</h${depth}>\n`;
          },
        },
      });

      const html = await marked.parse(raw);
      return `export const changelogData = ${JSON.stringify({ html, releases })};`;
    },
  };
}

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

export default defineConfig(({ command }) => ({
  base: '/',
  plugins: [changelogPlugin(), reactCompilerPlugin(), reactRouter(), tailwindcss()],
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
      '@graphs/shared': path.resolve(__dirname, '../shared/src'),
      '@': path.resolve(__dirname, './src'),
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
