import { getCountryColor } from '../tokens.js';

/**
 * Line widths and styles for World Economic charts:
 * 1. Macroeconomic Scale (GDP at PPP)
 * 2. Machinery & Capital Goods Turnover (HS Chapter 84)
 * 3. Total Electricity Generation
 * 4. Manufacturing Value Added (MVA)
 * 5. Clean Power (Solar & Wind)
 * 6. Electricity Intensity Per Capita
 */

export interface WorldEconomicEntityStyle {
  name: string;
  color: string;
  lineWidth: number;
}

export const WORLD_ECONOMIC_LINE_WIDTHS: Record<string, number> = {
  'China': 3.2,
  'USA': 2.8,
  'Europe': 2.6,
  'Japan': 2.2,
  'South Korea': 2.2,
  'Taiwan': 2.2,
  'India': 2.0,
  'Russia': 2.0,
};

export const DEFAULT_LINE_WIDTH = 2.0;

export function getWorldEconomicLineWidth(country: string): number {
  return WORLD_ECONOMIC_LINE_WIDTHS[country] || DEFAULT_LINE_WIDTH;
}

export function getWorldEconomicEntity(country: string): WorldEconomicEntityStyle {
  return {
    name: country,
    color: getCountryColor(country),
    lineWidth: getWorldEconomicLineWidth(country),
  };
}
