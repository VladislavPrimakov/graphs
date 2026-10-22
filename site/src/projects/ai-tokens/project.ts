import type { AiTokensDataset } from '@graphs/shared/types/ai-tokens/data';
import { defineProject, loadDataset, type ProjectSection } from '@/utils/project';
import type { dict } from './locales/dict-en';
import { meta } from './meta';

const data = {
  aiTokensData: () => loadDataset<AiTokensDataset>('ai-tokens', 'data.json'),
};

export type Section = ProjectSection<typeof data, typeof dict>;

/** Project specification for AI token inference throughput dashboard. */
export const project = defineProject({
  meta,
  data,
  sections: import.meta.glob('./sections/*.ts', { eager: true }),
});
