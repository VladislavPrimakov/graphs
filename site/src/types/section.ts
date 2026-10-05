import type { EChartsOption } from 'echarts';
import type React from 'react';
import type { SemanticColor } from '@/utils/color';

export type { SemanticColor };

/** Metric KPI card specification rendered above or below dashboard sections. */
export interface KpiCardSpec {
  /** Optional identifier for DOM targeting or testing. */
  id?: string;
  /** KPI metric title or descriptive label. */
  label: string;
  /** Formatted numerical or string value displayed prominently. */
  value: string | number;
  /** Semantic color variant or custom CSS/Tailwind color string. @default 'default' */
  valueColor?: SemanticColor | (string & {});
}

/** Base section specification shared by all dashboard sections. */
export interface BaseSectionSpec {
  /** Canonical section identifier matching URL sub-path (e.g. 'budget-and-debt'). */
  id: string;
  /** Optional primary section title. */
  title?: string;
  /** KPI cards positioned above the section content. */
  kpisTop?: KpiCardSpec[];
  /** KPI cards positioned below the section content. */
  kpisBottom?: KpiCardSpec[];
}

/** Base interface for any interactive section control. */
export interface BaseControl {
  /** Unique control identifier (e.g. 'mode', 'count', 'period'). */
  id: string;
  /** User-facing label or prefix. */
  label?: string;
}

/** Available toggle segment option. */
export interface ToggleOption {
  readonly value: string;
  readonly label: string;
}

/** Segmented view toggle button group control. */
export interface ToggleControl extends BaseControl {
  /** Discriminator for toggle control. */
  type: 'toggle';
  /** Available toggle segment options. */
  options: readonly ToggleOption[];
  /** Default selected option value. */
  defaultValue: string;
}

/** Range slider input control. */
export interface SliderControl extends BaseControl {
  /** Discriminator for slider control. */
  type: 'slider';
  /** Minimum slider range limit. */
  min: number;
  /** Maximum slider range limit. */
  max: number;
  /** Step increment. @default 1 */
  step?: number;
  /** Initial slider value. */
  defaultValue: number;
}

/** Dual-handle range slider input control for filtering intervals (e.g. years [2021, 2026]). */
export interface RangeSliderControl extends BaseControl {
  /** Discriminator for range slider control. */
  type: 'range-slider';
  /** Minimum slider range limit. */
  min: number;
  /** Maximum slider range limit. */
  max: number;
  /** Step increment. @default 1 */
  step?: number;
  /** Minimum interval between the two thumbs. @default 0 */
  minStepsBetweenThumbs?: number;
  /** Initial range bounds tuple [start, end]. Defaults to full [min, max] range if omitted. */
  defaultValue?: [number, number];
}

/** Checkbox toggle control for boolean options (e.g. showLabels). */
export interface CheckboxControl extends BaseControl {
  /** Discriminator for checkbox control. */
  type: 'checkbox';
  /** Initial boolean state. */
  defaultValue: boolean;
}

/** Discriminated union of all supported interactive chart controls. */
export type ChartControl = ToggleControl | SliderControl | RangeSliderControl | CheckboxControl;

/** Type map mapping each control type to its emitted value type. */
export type ControlTypeMap<C> = {
  slider: number;
  'range-slider': [number, number];
  checkbox: boolean;
  toggle: C extends { options: readonly { value: infer V }[] } ? V : string;
};

/** Resolves the value type emitted by a given control. */
export type ControlValue<C extends ChartControl> = ControlTypeMap<C>[C['type']];

/** Derives strongly-typed values map from a controls tuple. */
export type ControlsToValues<C extends readonly ChartControl[] | undefined = readonly ChartControl[] | undefined> = C extends readonly ChartControl[]
  ? { [K in C[number] as K['id']]: ControlValue<K> }
  : Record<string, never>;

/** Enriched view bundle containing ECharts option and optional section header/KPI overrides. */
export interface DynamicBundleResult {
  /** Native Apache ECharts option definition. */
  option: EChartsOption;
  /** Optional primary section title override for this view state. */
  title?: string;
  /** Dynamic KPI cards positioned above the chart. */
  kpisTop?: KpiCardSpec[];
  /** Dynamic KPI cards positioned below the chart. */
  kpisBottom?: KpiCardSpec[];
}

/** Result returned by dynamic view builders: raw EChartsOption or enriched view bundle. */
export type DynamicViewResult = EChartsOption | DynamicBundleResult;

/** Unified interactive chart section computing Apache ECharts options via reactive or static view builder. */
export interface ChartSectionSpec<C extends readonly ChartControl[] | undefined = readonly ChartControl[] | undefined> extends BaseSectionSpec {
  /** Optional chart archetype discriminator (injected automatically by chartSection). @default 'chart' */
  type?: 'chart';
  /** Optional interactive controls rendered in the card header. */
  controls?: C;
  /** Builder function producing concrete ECharts options and optional dynamic KPI overrides. */
  buildView(values: ControlsToValues<C>): DynamicViewResult;
}

/** Runtime chart section specification with guaranteed 'chart' discriminator. */
export type ChartSection<C extends readonly ChartControl[] | undefined = readonly ChartControl[] | undefined> = ChartSectionSpec<C> & { type: 'chart' };

/**
 * Type-safe chart section builder inferring reactive values from control definitions.
 */
export function chartSection<const C extends readonly ChartControl[] | undefined = undefined>(spec: ChartSectionSpec<C>): ChartSection<C> {
  return {
    type: 'chart',
    ...spec,
  };
}

/** Single item within a breakdown list. */
export interface BreakdownItem {
  /** Display name of the item or model. */
  name: string;
  /** Numerical count or formatted value of the item. */
  value: number | string;
}

/** Named list of items inside a breakdown category card. */
export interface BreakdownList {
  /** Display label for the group or faction (e.g. 'RF', 'UA'). */
  label: string;
  /** Aggregate total count or metric for this list. */
  total?: number | string;
  /** Color theme accent applied to totals and indicator borders. */
  color?: string;
  /** Array of individual items in this list. */
  items: BreakdownItem[];
}

/** Individual category card within a breakdown grid. */
export interface BreakdownCategory {
  /** Unique category identifier. */
  id: string;
  /** User-facing category title (e.g. 'Aircraft', 'Tanks'). */
  title: string;
  /** Optional icon displayed before the category title. */
  icon?: React.ReactNode;
  /** Optional badge text displayed in the header (e.g. '1.9:1'). */
  badge?: string;
  /** Comparison lists displayed inside this category card. */
  lists: BreakdownList[];
}

/** Breakdown grid section displaying categorized item comparisons across categories. */
export interface BreakdownGridSpec extends BaseSectionSpec {
  /** Section archetype discriminator. */
  type: 'breakdown-grid';
  /** Number of items to show per list before collapsing (defaults to 5). */
  previewLimit?: number;
  /** Categorized comparison cards. */
  categories: BreakdownCategory[];
}

/** Custom React-rendered section container (e.g. interactive WebGL map). */
export interface CustomSectionSpec extends BaseSectionSpec {
  /** Section archetype discriminator. */
  type: 'custom';
  /** Render function returning custom React elements. */
  render: () => React.ReactNode;
}

/** Runtime custom section specification. */
export type CustomSection = CustomSectionSpec;

/**
 * Type-safe custom section builder.
 */
export function customSection(spec: Omit<CustomSectionSpec, 'type'>): CustomSection {
  return {
    type: 'custom',
    ...spec,
  };
}

/** Union of all dashboard section specifications (charts, breakdown grids, and custom views). */
export type DashboardSection = ChartSection | BreakdownGridSpec | CustomSection;
