/** Canonical registry of all categorization and discovery tags used across projects. */
export const PROJECT_TAGS = [
  'global',
  'space',
  'launches',
  'ua',
  'rf',
  'war',
  'frontline',
  'air-defense',
  'missiles',
  'uav',
  'losses',
  'equipment',
  'economy',
  'budget',
  'gdp',
  'energy',
  'industry',
  'ai',
  'tokens',
  'compute',
] as const;

/** Union type of all valid project categorization tags. */
export type ProjectTag = (typeof PROJECT_TAGS)[number];
