import type { AiCompanyId } from '@graphs/types/ai-tokens/tokens-by-company';

export type { AiCompanyId };

/** Canonical AI model and inference provider brand names (invariant across locales). */
export const AI_COMPANIES: Record<AiCompanyId, string> = {
  doubao: 'Doubao (ByteDance)',
  google: 'Google (Gemini)',
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  fireworks: 'Fireworks AI',
  microsoft: 'Microsoft (Foundry)',
  deepseek: 'DeepSeek',
  together: 'Together AI',
};

/** Canonical brand color accents for provider throughput visualization. */
export const COMPANY_COLORS: Record<AiCompanyId, string> = {
  doubao: '#ef4444',
  google: '#2563eb',
  openai: '#10a37f',
  anthropic: '#db2777',
  fireworks: '#f97316',
  microsoft: '#7c5cff',
  deepseek: '#0ea5e9',
  together: '#64748b',
};
