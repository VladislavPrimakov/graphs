import { PROJECT_SLUGS, type ProjectDataMap, type ProjectSlug } from '@graphs/types';
import type { LocaleProjectMeta, Project, ProjectMeta, ProjectTag, StaticProjectMeta } from '@/types';
import type { Language } from '@/utils/locales';

// Dynamically discover all project metadata descriptors, specifications, and localized dictionaries
const metaModules = import.meta.glob<{ meta: StaticProjectMeta }>('./*/meta.ts', { eager: true });
const projectLoaders = import.meta.glob<{ project: Project }>('./*/project.ts');
const metaLoaders = import.meta.glob<{ meta: LocaleProjectMeta }>('./*/locales/meta-*.ts');
const dictLoaders = import.meta.glob<{ dict: Record<string, unknown> }>('./*/locales/dict-*.ts');
const dataLoaders = import.meta.glob<{ default: unknown }>('../data/*.json');

/** Canonical static project metadata descriptors ordered by canonical PROJECT_SLUGS SSoT. */
export const STATIC_PROJECT_INFOS: StaticProjectMeta[] = PROJECT_SLUGS.map((slug) => {
  const mod = metaModules[`./${slug}/meta.ts`];
  if (!mod?.meta) {
    throw new Error(`Static metadata descriptor missing for project slug: ${slug}`);
  }
  return mod.meta;
});

/** Map of static project metadata indexed by project slug for instant synchronous validation. */
export const STATIC_PROJECT_MAP: Record<ProjectSlug, StaticProjectMeta> = Object.fromEntries(STATIC_PROJECT_INFOS.map((p) => [p.id, p])) as Record<ProjectSlug, StaticProjectMeta>;

/** Alphabetically sorted list of all unique category tags across registered projects. */
export const ALL_UNIQUE_TAGS: ProjectTag[] = Array.from(new Set(STATIC_PROJECT_INFOS.flatMap((p) => p.tags))).sort();

/** In-memory cache for localized catalog descriptors. */
const catalogCache = new Map<Language, Promise<ProjectMeta[]>>();

/** Resolves localized project catalog descriptors for the active language. */
export function getLocalizedCatalog(lang: Language): Promise<ProjectMeta[]> {
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
        };
      }),
    );
    catalogCache.set(lang, promise);
  }
  return promise;
}

/** Complete project bundle containing specification, typed dataset JSON, and localized dictionaries. */
export interface CompleteProjectBundle {
  project: Project;
  data: ProjectDataMap[ProjectSlug];
  t: {
    projMeta: LocaleProjectMeta;
    proj: Record<string, unknown>;
  };
}

/** In-memory cache for dynamically imported project bundles. */
const bundleCache = new Map<string, Promise<CompleteProjectBundle>>();

/** Asynchronously loads the complete project bundle (specification, dataset JSON, localized dictionary) in parallel. */
export function loadProjectBundle(slug: ProjectSlug, lang: Language): Promise<CompleteProjectBundle> {
  const cacheKey = `${slug}:${lang}`;
  let promise = bundleCache.get(cacheKey);
  if (!promise) {
    const projectLoader = projectLoaders[`./${slug}/project.ts`];
    if (!projectLoader) {
      throw new Error(`Project specification not found: ${slug}`);
    }
    const dataLoader = dataLoaders[`../data/${slug}.json`];
    if (!dataLoader) {
      throw new Error(`Data file not found for project: ${slug}`);
    }
    const metaLoader = metaLoaders[`./${slug}/locales/meta-${lang}.ts`];
    if (!metaLoader) {
      throw new Error(`Locale meta file not found for project: ${slug}, lang: ${lang}`);
    }
    const dictLoader = dictLoaders[`./${slug}/locales/dict-${lang}.ts`];
    if (!dictLoader) {
      throw new Error(`Locale dict file not found for project: ${slug}, lang: ${lang}`);
    }

    promise = Promise.all([projectLoader(), dataLoader(), metaLoader(), dictLoader()]).then(([projectMod, dataMod, metaMod, dictMod]) => ({
      project: projectMod.project,
      data: ((dataMod as { default: unknown }).default ?? dataMod) as ProjectDataMap[ProjectSlug],
      t: {
        projMeta: metaMod.meta,
        proj: dictMod.dict,
      },
    }));
    bundleCache.set(cacheKey, promise);
  }
  return promise;
}
