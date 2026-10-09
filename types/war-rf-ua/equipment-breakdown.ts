import type { WarLossCategory } from './categories';
import type { LossSummaryData } from './category-losses';

/** Documented losses for a specific military equipment model. */
export interface LossEquipmentModel {
  /** Full military equipment model designation (e.g., 'T-80BVM', 'M2A2 Bradley'). */
  name: string;
  /** Total verified loss count for this specific model (units). */
  count: number;
}

/** Sub-model loss breakdown for a specific equipment category. */
export interface LossCategoryDetailData {
  /** Breakdown of equipment models by faction. */
  models?: {
    /** Russian verified lost models sorted by frequency. */
    rf?: LossEquipmentModel[];
    /** Ukrainian verified lost models sorted by frequency. */
    ua?: LossEquipmentModel[];
  };
}

/** Section dataset for equipment-breakdown. */
export interface EquipmentBreakdownSectionData {
  byCategory: Record<WarLossCategory, LossCategoryDetailData>;
  periods: string[];
  summary: LossSummaryData;
}
