import { themeColors } from '../tokens.js';

/**
 * Styles and configurations for Space Launches charts:
 * 1. Annual Mass of LEO/SSO Payload Capacity
 * 2. Historical Launch Cost to Low Earth Orbit ($/kg)
 */

export const SPACE_LAUNCHES_THEME = {
  regions: ['USA', 'China', 'Russia', 'Europe', 'Japan', 'India'],
  colors: themeColors.country,
};
