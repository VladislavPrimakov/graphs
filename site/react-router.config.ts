import fs from 'node:fs';
import path from 'node:path';
import type { Config } from '@react-router/dev/config';
import { NON_DEFAULT_LANGUAGES } from './src/utils/provider';
import { parseChangelogVersions } from './src/utils/version';

const rawBase = process.env.BASE_URL ?? '/graphs';
const basename = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

/** Discovers project slugs and their canonical section paths dynamically from the filesystem tree. */
function getProjectRoutes(): { slug: string; sections: string[] }[] {
  const projectsDir = path.resolve(import.meta.dirname, 'src/projects');
  const slugs = fs
    .readdirSync(projectsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  return slugs.map((slug) => {
    const sectionsDir = path.join(projectsDir, slug, 'sections');
    const sections = fs.existsSync(sectionsDir)
      ? fs
          .readdirSync(sectionsDir)
          .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))
          .map((file) => file.replace(/\.ts$/, ''))
      : [];
    return { slug, sections };
  });
}

/** Discovers release versions from root CHANGELOG.md dynamically for SSG pre-rendering. */
function getChangelogVersions(): string[] {
  const changelogPath = path.resolve(import.meta.dirname, '../CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) return [];
  return parseChangelogVersions(fs.readFileSync(changelogPath, 'utf8'));
}

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
    const projects = getProjectRoutes();
    const versions = getChangelogVersions();
    const defaultProjectPaths = projects.map((p) => `/${p.slug}`);
    const defaultSectionPaths = projects.flatMap((p) => p.sections.map((sec) => `/${p.slug}/${sec}`));
    const changelogPaths = [
      '/changelog',
      ...versions.map((ver) => `/changelog/v${ver}`),
      ...NON_DEFAULT_LANGUAGES.map((lang) => `/${lang}/changelog`),
      ...NON_DEFAULT_LANGUAGES.flatMap((lang) => versions.map((ver) => `/${lang}/changelog/v${ver}`)),
    ];
    const notFoundPaths = ['/404', ...NON_DEFAULT_LANGUAGES.map((lang) => `/${lang}/404`)];
    const localizedPaths = NON_DEFAULT_LANGUAGES.flatMap((lang) => [
      `/${lang}`,
      ...projects.map((p) => `/${lang}/${p.slug}`),
      ...projects.flatMap((p) => p.sections.map((sec) => `/${lang}/${p.slug}/${sec}`)),
    ]);
    return ['/', ...defaultProjectPaths, ...defaultSectionPaths, ...changelogPaths, ...notFoundPaths, ...localizedPaths];
  },
} satisfies Config;
