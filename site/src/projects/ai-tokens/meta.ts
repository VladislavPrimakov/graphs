import type { StaticProjectMeta } from '@/types';

/** Static metadata descriptor for AI Tokens dashboard. */
export const meta = {
  id: 'ai-tokens',
  tags: ['ai', 'tokens', 'compute', 'global'],
  sections: ['tokens-by-region', 'tokens-by-company'],
} as const satisfies StaticProjectMeta<'ai-tokens'>;
