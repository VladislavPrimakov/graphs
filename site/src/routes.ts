import { index, type RouteConfig, route } from '@react-router/dev/routes';
import { type Language, NON_DEFAULT_LANGUAGES } from './utils/provider';

export default [
  index('pages/CatalogPage.tsx', { id: 'catalog-default' }),
  ...NON_DEFAULT_LANGUAGES.map((lang: Language) => route(lang, 'pages/CatalogPage.tsx', { id: `catalog-${lang}` })),
  route('changelog', 'pages/ChangelogPage.tsx', { id: 'changelog-default' }),
  route('changelog/:version', 'pages/ChangelogPage.tsx', { id: 'changelog-version-default' }),
  ...NON_DEFAULT_LANGUAGES.map((lang: Language) => route(`${lang}/changelog`, 'pages/ChangelogPage.tsx', { id: `changelog-${lang}` })),
  ...NON_DEFAULT_LANGUAGES.map((lang: Language) => route(`${lang}/changelog/:version`, 'pages/ChangelogPage.tsx', { id: `changelog-version-${lang}` })),
  route('404', 'pages/NotFoundPage.tsx', { id: 'not-found-explicit' }),
  ...NON_DEFAULT_LANGUAGES.map((lang: Language) => route(`${lang}/404`, 'pages/NotFoundPage.tsx', { id: `not-found-${lang}` })),
  route(':slug', 'pages/ProjectPage.tsx', { id: 'project-default' }),
  route(':slug/:section', 'pages/ProjectPage.tsx', { id: 'project-section-default' }),
  ...NON_DEFAULT_LANGUAGES.map((lang: Language) => route(`${lang}/:slug`, 'pages/ProjectPage.tsx', { id: `project-${lang}` })),
  ...NON_DEFAULT_LANGUAGES.map((lang: Language) => route(`${lang}/:slug/:section`, 'pages/ProjectPage.tsx', { id: `project-section-${lang}` })),
  route('*', 'pages/NotFoundPage.tsx', { id: 'not-found' }),
] satisfies RouteConfig;
