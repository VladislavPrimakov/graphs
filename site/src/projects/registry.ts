import type { LocaleProjectMeta, Project, ProjectMeta, ProjectTag, StaticProjectMeta } from '@/types';
import type { Language } from '@/utils/provider';

// Dynamically discover all project metadata descriptors, specifications, localized dictionaries, and section datasets
const metaModules = import.meta.glob<{ meta: StaticProjectMeta }>('./*/meta.ts', { eager: true });
const projectLoaders = import.meta.glob<{ project: Project }>('./*/project.ts');
const metaLoaders = import.meta.glob<{ meta: LocaleProjectMeta }>('./*/locales/meta-*.ts');
const dictLoaders = import.meta.glob<{ dict: Record<string, unknown> }>('./*/locales/dict-*.ts');

/** Canonical static project metadata descriptors discovered dynamically from project slices. */
export const STATIC_PROJECT_INFOS: StaticProjectMeta[] = Object.values(metaModules).map((mod) => mod.meta);

/** Map of static project metadata indexed by project slug for instant synchronous validation. */
export const STATIC_PROJECT_MAP: Record<string, StaticProjectMeta> = Object.fromEntries(STATIC_PROJECT_INFOS.map((p) => [p.id, p]));

/** Alphabetically sorted list of all unique category tags across registered projects. */
export const ALL_UNIQUE_TAGS: ProjectTag[] = Array.from(new Set(STATIC_PROJECT_INFOS.flatMap((p) => p.tags))).sort();

/** In-memory cache for localized catalog descriptors. */
const catalogCache = new Map<Language, Promise<ProjectMeta[]>>();

/** Asynchronously loads localized project catalog descriptors for the active language. */
export function loadCatalog(lang: Language): Promise<ProjectMeta[]> {
  let promise = catalogCache.get(lang);
  if (!promise) {
    promise = Promise.all(
      STATIC_PROJECT_INFOS.map(async (info) => {
        const loader = metaLoaders[`./${info.id}/locales/meta-${lang}.ts`];
        const mod = loader ? await loader() : null;
        return {
          ...info,
          title: mod?.meta.title ?? info.id,
          description: mod?.meta.description ?? '',
          sectionTitles: mod?.meta.sections ?? {},
        };
      }),
    );
    catalogCache.set(lang, promise);
  }
  return promise;
}

/** Complete project bundle containing specification and localized dictionaries. */
export interface CompleteProjectBundle {
  project: Project;
  t: {
    projMeta: LocaleProjectMeta;
    proj: Record<string, unknown>;
  };
}

/** In-memory cache for dynamically imported project bundles. */
const bundleCache = new Map<string, Promise<CompleteProjectBundle>>();

/** Asynchronously loads the complete project bundle (specification and localized dictionary) in parallel. */
export function loadProjectBundle(slug: string, lang: Language): Promise<CompleteProjectBundle> {
  const cacheKey = `${slug}:${lang}`;
  let promise = bundleCache.get(cacheKey);
  if (!promise) {
    const projectLoader = projectLoaders[`./${slug}/project.ts`];
    if (!projectLoader) {
      throw new Error(`Project specification not found: ${slug}`);
    }
    const metaLoader = metaLoaders[`./${slug}/locales/meta-${lang}.ts`];
    if (!metaLoader) {
      throw new Error(`Locale meta file not found for project: ${slug}, lang: ${lang}`);
    }
    const dictLoader = dictLoaders[`./${slug}/locales/dict-${lang}.ts`];
    if (!dictLoader) {
      throw new Error(`Locale dict file not found for project: ${slug}, lang: ${lang}`);
    }

    promise = Promise.all([projectLoader(), metaLoader(), dictLoader()]).then(([projectMod, metaMod, dictMod]) => ({
      project: projectMod.project,
      t: {
        projMeta: metaMod.meta,
        proj: dictMod.dict,
      },
    }));
    bundleCache.set(cacheKey, promise);
  }
  return promise;
}

async function fetchSectionJson<T>(slug: string, sectionId: string): Promise<T> {
  if (import.meta.env.SSR) {
    const { readFile } = await import(/* @vite-ignore */ 'node:fs/promises');
    const { resolve } = await import(/* @vite-ignore */ 'node:path');
    const publicDir = process.cwd().endsWith('site') ? 'public/data' : 'site/public/data';
    const filePath = resolve(process.cwd(), publicDir, slug, sectionId, 'data.json');
    return JSON.parse(await readFile(filePath, 'utf-8')) as T;
  }
  const url = `${import.meta.env.BASE_URL}data/${slug}/${sectionId}/data.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching data for ${slug}/${sectionId}`);
  return (await res.json()) as T;
}

/** In-memory cache for loaded section datasets. */
const sectionDataCache = new Map<string, Promise<unknown>>();

/** Asynchronously loads a typed section dataset on demand. */
export function loadSectionData<T = unknown>(slug: string, sectionId: string): Promise<T> {
  const cacheKey = `${slug}:${sectionId}`;
  let promise = sectionDataCache.get(cacheKey);
  if (!promise) {
    promise = fetchSectionJson<T>(slug, sectionId);
    sectionDataCache.set(cacheKey, promise);
  }
  return promise as Promise<T>;
}
