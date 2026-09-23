import { themeColors } from '../tokens.js';

/**
 * Styles and color palettes for Ukraine Economic charts:
 * 1. State Budget Execution, External Debt & GDP
 * 2. Foreign Trade Structure & Trade Balance
 */

export const UA_ECONOMIC_THEME = {
  // Chart 1: State Budget Execution, External Debt & GDP
  budget: {
    // Expenditures Stack (Left bar)
    defense: themeColors.budget.defense,
    otherExp: themeColors.budget.otherExp,

    // Revenues & Financing Stack (Middle-left bar)
    domesticRev: themeColors.budget.domesticRev,
    grants: themeColors.budget.grants,
    loans: themeColors.budget.loans,

    // Standalone Columns (Middle-right & Right bars)
    debt: themeColors.budget.debt,
    gdp: themeColors.country.USA,

    // Column Top & Inside Text Labels
    totalRevLabel: themeColors.text.primary,
    totalExpLabel: themeColors.text.primary,
    debtLabel: themeColors.text.primary,
    gdpLabel: themeColors.text.primary,
    insideBarText: themeColors.text.primary,
  },

  // Chart 2: Foreign Trade Structure & Trade Balance
  trade: {
    others: themeColors.text.secondary,
    balanceLine: themeColors.accent.primary,
    balanceLabel: themeColors.text.primary,
    exportTotal: themeColors.accent.blue,
    importTotal: themeColors.accent.orange,
  },

  // Display thresholds (no magic numbers in templates)
  thresholds: {
    minSegmentValue: 1.5,     // Hide segment label if <= 1.5 billion USD
    minTradeSharePct: 7,      // Hide trade partner label if < 7%
  },
};
