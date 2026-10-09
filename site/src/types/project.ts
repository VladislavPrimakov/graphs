import type { ResolvedTheme, ThemeColors } from '@/styles/tokens';
import type { LocalizedFormatters } from '@/utils/format';
import type { Language, LocaleCommonDict } from '@/utils/provider';
import type { DashboardSection } from './section';
import type { ProjectTag } from './tag';

/** Data provider or official agency citation for dataset provenance. */
export interface ProjectSource {
  /** Name of the organization or data provider. */
  name: string;
  /** Direct URL to the official source repository or dataset portal. */
  url: string;
}

/** Static project metadata (identity, tags, and section paths) independent of locale and chart builders. */
export interface StaticProjectMeta<K extends string = string, S extends string = string> {
  /** Unique project slug identifier. */
  id: K;
  /** Categorization and discovery tags for catalog filtering. */
  tags: ProjectTag[];
  /** Ordered list of canonical section IDs matching URL sub-paths (e.g. ['budget-and-debt', ...]). */
  sections: readonly S[];
}

/** Localized text metadata declaration for a project (title, description, and section preview titles). */
export interface LocaleProjectMeta<S extends string = string> {
  /** Localized project title. */
  title: string;
  /** Localized project description. */
  description: string;
  /** Localized concise names for sections rendered in catalog preview cards. */
  sections?: Record<S, string>;
}

/** Lightweight metadata declaration of a project for navigation and overview cards without chart builders. */
export interface ProjectMeta<K extends string = string, S extends string = string> extends StaticProjectMeta<K, S>, Omit<LocaleProjectMeta<S>, 'sections'> {
  /** Localized concise names for sections rendered in catalog preview cards. */
  sectionTitles?: Record<S, string>;
}

/** Localized translation container for a project comprising common phrases, metadata, and chart dictionary. */
export interface ProjectTranslation<D = Record<string, unknown>> {
  common: LocaleCommonDict;
  projMeta: LocaleProjectMeta;
  proj: D;
}

/** Context passed to section builder factory containing active locale, translations, formatters, and resolved theme tokens. */
export interface BuildSectionContext<D = Record<string, unknown>> {
  lang: Language;
  t: ProjectTranslation<D>;
  fmt: LocalizedFormatters;
  theme: ResolvedTheme;
  tokens: ThemeColors;
}

/** Function contract for building an individual isolated dashboard section. */
export type SectionBuilder<TData = unknown, D = Record<string, unknown>> = (ctx: BuildSectionContext<D>) => DashboardSection<TData>;

/** Static declaration of a dashboard project in the catalog with section builders. */
export interface Project<K extends string = string, D = Record<string, unknown>> extends StaticProjectMeta<K> {
  /** Factory function returning the complete array of configured dashboard sections for the page. */
  buildSections: (ctx: BuildSectionContext<D>) => DashboardSection<unknown>[];
}
