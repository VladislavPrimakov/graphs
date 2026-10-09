import type React from 'react';
import { Suspense, use } from 'react';
import { Links, Meta, Outlet, Scripts, useLocation } from 'react-router';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { loadCatalog } from '@/projects/registry';
import type { ProjectMeta } from '@/types';
import type { CldrLocaleUnits } from '@/utils/format';
import { AppProvider, getLanguageFromPath, type Language, type LocaleCommonDict } from '@/utils/provider';
import './styles/global.css';

const commonLoaders = import.meta.glob<{ LocaleCommon: LocaleCommonDict }>('./locales/common-*.ts');
const cldrLoaders = import.meta.glob<{ default: CldrLocaleUnits }>('../public/data/cldr/*.json');

export interface RootLocaleData {
  common: LocaleCommonDict;
  cldr: CldrLocaleUnits;
  projects: ProjectMeta[];
}

const rootLocaleCache = new Map<Language, Promise<RootLocaleData>>();

export function loadRootLocale(lang: Language): Promise<RootLocaleData> {
  let promise = rootLocaleCache.get(lang);
  if (!promise) {
    const commonLoader = commonLoaders[`./locales/common-${lang}.ts`];
    if (!commonLoader) {
      throw new Error(`Common locale dictionary missing for lang: ${lang}`);
    }
    const cldrLoader = cldrLoaders[`../public/data/cldr/${lang}.json`];
    if (!cldrLoader) {
      throw new Error(`CLDR units dataset missing for lang: ${lang}`);
    }

    promise = Promise.all([commonLoader(), cldrLoader(), loadCatalog(lang)]).then(([commonMod, cldrMod, projects]) => ({
      common: commonMod.LocaleCommon,
      cldr: (cldrMod.default ?? cldrMod) as CldrLocaleUnits,
      projects,
    }));
    rootLocaleCache.set(lang, promise);
  }
  return promise;
}

/** Root HTML document layout for React Router SSG rendering and client hydration. */
export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const lang = getLanguageFromPath(location.pathname);

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/svg+xml" href={`${import.meta.env.BASE_URL}favicon.svg`} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <noscript>
          <style>{'.loading-spinner-overlay { display: none !important; }'}</style>
        </noscript>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: synchronous theme initialization script to prevent FOUT
          dangerouslySetInnerHTML={{
            __html: `(function(){try{const t=localStorage.getItem('theme')||'system';const d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})();`,
          }}
        />
        <Meta />
        <Links />
      </head>
      <body className="bg-surface-base text-content-primary flex flex-col min-h-screen">
        <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const location = useLocation();
  const lang = getLanguageFromPath(location.pathname);
  const { common, cldr, projects } = use(loadRootLocale(lang));

  return (
    <AppProvider key={lang} lang={lang} common={common} cldr={cldr} projects={projects}>
      <SiteLayout>
        <Suspense fallback={<LoadingSpinner />}>
          <Outlet />
        </Suspense>
      </SiteLayout>
    </AppProvider>
  );
}
