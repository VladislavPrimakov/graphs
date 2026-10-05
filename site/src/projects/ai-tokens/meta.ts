import type { StaticProjectMeta } from '@/types';

/** Static metadata descriptor for AI Tokens dashboard. */
export const meta = {
  id: 'ai-tokens',
  tags: ['ai', 'tokens', 'compute', 'global'],
  sources: [
    { name: 'Tokens Per Day', url: 'https://tokensperday.com/' },
    { name: 'National Data Bureau of China', url: 'https://www.ndb.gov.cn/' },
    { name: 'OpenRouter Telemetry', url: 'https://openrouter.ai/' },
  ],
  sections: ['tokens-by-region', 'tokens-by-company'],
} as const satisfies StaticProjectMeta<'ai-tokens'>;
