import type { ProjectDataMap, ProjectSlug } from '@graphs/types';
import type { LocalizedFormatters } from '@/utils/format';
import type { Language, LocaleCommonDict } from '@/utils/locales';
import type { DashboardSection } from './section';
import type { ProjectTag } from './tag';

/** Data provider or official agency citation for dataset provenance. */
export interface ProjectSource {
  /** Name of the organization or data provider. */
  name: string;
  /** Direct URL to the official source repository or dataset portal. */
  url: string;
}

/** Static project metadata (identity, tags, and sources) independent of locale and chart builders. */
export interface StaticProjectMeta<K extends ProjectSlug = ProjectSlug> {
  /** Unique project slug identifier. */
  id: K;
  /** Categorization and discovery tags for catalog filtering. */
  tags: ProjectTag[];
  /** List of primary sources and statistical agencies cited. */
  sources: ProjectSource[];
}

/** Localized text metadata declaration for a project (title and description). */
export interface LocaleProjectMeta {
  /** Localized project title. */
  title: string;
  /** Localized project description. */
  description: string;
}

/** Lightweight metadata declaration of a project for navigation and overview cards without chart builders. */
export interface ProjectMeta<K extends ProjectSlug = ProjectSlug> extends StaticProjectMeta<K>, LocaleProjectMeta {}

/** Localized translation container for a project comprising common phrases, metadata, and chart dictionary. */
export interface ProjectTranslation<D = Record<string, unknown>> {
  common: LocaleCommonDict;
  projMeta: LocaleProjectMeta;
  proj: D;
}

/** Unified context passed to buildSections containing dataset, active locale, translations, and formatters. */
export interface BuildSectionsContext<K extends ProjectSlug = ProjectSlug, D = Record<string, unknown>> {
  data: ProjectDataMap[K];
  lang: Language;
  t: ProjectTranslation<D>;
  fmt: LocalizedFormatters;
}

/** Static declaration of a dashboard project in the catalog with section builders. */
export interface Project<K extends ProjectSlug = ProjectSlug, D = Record<string, unknown>> extends StaticProjectMeta<K> {
  /** Factory function returning the complete array of configured dashboard sections for the page. */
  buildSections: (ctx: BuildSectionsContext<K, D>) => DashboardSection[];
}
