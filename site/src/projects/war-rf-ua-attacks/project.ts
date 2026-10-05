import type { Project, SectionBuilder } from '@/types';
import type { dict } from './locales/dict-en';
import { meta } from './meta';

const modules = import.meta.glob<Record<string, SectionBuilder<'war-rf-ua-attacks', typeof dict>>>('./sections/*.ts', { eager: true });

/** Project specification for Russian missile and UAV strikes on Ukraine dashboard. */
export const project: Project<'war-rf-ua-attacks', typeof dict> = {
  ...meta,
  buildSections: (ctx) =>
    meta.sections.map((id) => {
      const mod = modules[`./sections/${id}.ts`];
      if (!mod) throw new Error(`Section module missing: ./sections/${id}.ts`);
      const builder = Object.values(mod)[0];
      return builder(ctx);
    }),
};
