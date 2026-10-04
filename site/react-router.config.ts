import type { Config } from '@react-router/dev/config';
import { PROJECT_SLUGS } from './src/types';
import { NON_DEFAULT_LANGUAGES } from './src/utils/locales';

const rawBase = process.env.BASE_URL ?? '/graphs';
const basename = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

export default {
  appDirectory: 'src',
  buildDirectory: process.env.BUILD_DIR || 'dist',
  basename,
  ssr: false,
  future: {
    v8_middleware: true,
    v8_splitRouteModules: true,
    v8_viteEnvironmentApi: true,
    v8_passThroughRequests: true,
    v8_trailingSlashAwareDataRequests: true,
  },
  async prerender() {
    const defaultProjectPaths = PROJECT_SLUGS.map((slug) => `/${slug}`);
    const changelogPaths = ['/changelog', ...NON_DEFAULT_LANGUAGES.map((lang) => `/${lang}/changelog`)];
    const notFoundPaths = ['/404', ...NON_DEFAULT_LANGUAGES.map((lang) => `/${lang}/404`)];
    const localizedPaths = NON_DEFAULT_LANGUAGES.flatMap((lang) => [
      `/${lang}`,
      ...PROJECT_SLUGS.map((slug) => `/${lang}/${slug}`),
    ]);
    return ['/', ...defaultProjectPaths, ...changelogPaths, ...notFoundPaths, ...localizedPaths];
  },
} satisfies Config;
