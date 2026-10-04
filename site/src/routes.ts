import { index, type RouteConfig, route } from '@react-router/dev/routes';
import { type Language, NON_DEFAULT_LANGUAGES } from './utils/locales';

export default [
  index('pages/CatalogPage.tsx', { id: 'catalog-default' }),
  ...NON_DEFAULT_LANGUAGES.map((lang: Language) => route(lang, 'pages/CatalogPage.tsx', { id: `catalog-${lang}` })),
  route('changelog', 'pages/ChangelogPage.tsx', { id: 'changelog-default' }),
  ...NON_DEFAULT_LANGUAGES.map((lang: Language) => route(`${lang}/changelog`, 'pages/ChangelogPage.tsx', { id: `changelog-${lang}` })),
  route('404', 'pages/NotFoundPage.tsx', { id: 'not-found-explicit' }),
  ...NON_DEFAULT_LANGUAGES.map((lang: Language) => route(`${lang}/404`, 'pages/NotFoundPage.tsx', { id: `not-found-${lang}` })),
  route(':slug', 'pages/ProjectPage.tsx', { id: 'project-default' }),
  ...NON_DEFAULT_LANGUAGES.map((lang: Language) => route(`${lang}/:slug`, 'pages/ProjectPage.tsx', { id: `project-${lang}` })),
  route('*', 'pages/NotFoundPage.tsx', { id: 'not-found' }),
] satisfies RouteConfig;
