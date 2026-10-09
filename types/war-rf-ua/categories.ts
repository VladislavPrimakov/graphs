/** Canonical machine identifiers for military equipment loss categories. */
export const WAR_LOSS_CATEGORIES = [
  'tanks',
  'ifv',
  'transport',
  'sp_artillery',
  'air_defense',
  'mlrs',
  'towed_artillery',
  'engineering',
  'radars_jammers',
  'airplanes',
  'helicopters',
  'vessels',
  'imv',
  'anti_tank',
] as const;

/** Canonical military equipment category identifier. */
export type WarLossCategory = (typeof WAR_LOSS_CATEGORIES)[number];
