import type { EChartsOption } from 'echarts';
import type React from 'react';
import { lazy, Suspense, startTransition, use, useState } from 'react';
import { ExternalLinkIcon } from '@/components/icons';
import { SectionBreakdown } from '@/components/sections/SectionBreakdown';
import { SectionHeader } from '@/components/sections/SectionHeader';
import { Checkbox } from '@/components/ui/Checkbox';
import { KpiRow } from '@/components/ui/KpiCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Slider } from '@/components/ui/Slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup';
import { loadSectionData } from '@/projects/registry';
import type { ChartControl, DashboardSection as DashboardSectionType, DynamicBundleResult, DynamicViewResult, KpiCardSpec, ProjectSource } from '@/types';
import { useFormat, useTranslation } from '@/utils/provider';
import { useInView } from '@/utils/useInView';
import { SECTION_DATA_ATTR } from '@/utils/useScrollSpy';

const SectionChart = lazy(() => import('./SectionChart').then((m) => ({ default: m.SectionChart })));

function isBundleResult(res: DynamicViewResult): res is DynamicBundleResult {
  return typeof res === 'object' && res !== null && 'option' in res;
}

/** Props for the polymorphic Section renderer. */
export interface SectionProps {
  /** Polymorphic section specification (chart, dynamic chart, or breakdown grid). */
  section: DashboardSectionType;
  /** Unique project slug identifier for anchor links and export filenames. */
  projectSlug: string;
  /** Whether this section is the initial target for deep linking or above-the-fold display. @default false */
  initialInView?: boolean;
}

type ControlStateValue = string | number | boolean | readonly [number, number] | [number, number];

/** Clean card loader placeholder with normalized height preserving page geometry. */
function SectionLoader({ id, projectSlug, title }: { id: string; projectSlug?: string; title?: string }) {
  return (
    <div className="card min-h-[60vh] flex flex-col justify-between relative">
      <SectionHeader sectionId={id} projectSlug={projectSlug} title={title} />
      <div className="flex-1 flex items-center justify-center min-h-[300px] relative">
        <LoadingSpinner fullscreen={false} size="sm" isVisible={true} />
      </div>
    </div>
  );
}

interface SectionLoadedContentProps {
  section: DashboardSectionType;
  projectSlug: string;
}

/** Inner section content unwrapping lazily fetched section dataset via React 19 use(). */
function SectionLoadedContent({ section, projectSlug }: SectionLoadedContentProps) {
  // Lazily load typed section dataset chunk
  const data = use(loadSectionData(projectSlug, section.id));

  const sectionId = section.id;

  // Resolve controls either from static array or dynamically computed from section data
  const resolvedControls: readonly ChartControl[] | undefined = section.type === 'chart' ? (typeof section.controls === 'function' ? section.controls(data) : section.controls) : undefined;

  // Initialize control values dictionary from section controls
  const [controlValues, setControlValues] = useState<Record<string, ControlStateValue>>(() => {
    const initial: Record<string, ControlStateValue> = {};
    for (const ctrl of resolvedControls ?? []) {
      if (ctrl.type === 'range-slider') {
        initial[ctrl.id] = ctrl.defaultValue ?? [ctrl.min, ctrl.max];
      } else {
        initial[ctrl.id] = ctrl.defaultValue;
      }
    }
    return initial;
  });

  const handleControlChange = (id: string, value: ControlStateValue) => {
    startTransition(() => {
      setControlValues((prev) => ({ ...prev, [id]: value }));
    });
  };

  const exportName = `${projectSlug}--${sectionId}`;

  // Ensure effective control values are always clamped to the current min/max bounds of resolved controls
  const effectiveValues: Record<string, ControlStateValue> = {};
  if (resolvedControls) {
    for (const ctrl of resolvedControls) {
      if (ctrl.type === 'range-slider') {
        const raw = (controlValues[ctrl.id] ?? ctrl.defaultValue ?? [ctrl.min, ctrl.max]) as [number, number];
        effectiveValues[ctrl.id] = [Math.max(ctrl.min, Math.min(ctrl.max, raw[0])), Math.max(ctrl.min, Math.min(ctrl.max, raw[1]))];
      } else if (ctrl.type === 'slider') {
        const raw = Number(controlValues[ctrl.id] ?? ctrl.defaultValue);
        effectiveValues[ctrl.id] = Math.max(ctrl.min, Math.min(ctrl.max, raw));
      } else {
        effectiveValues[ctrl.id] = controlValues[ctrl.id] ?? ctrl.defaultValue;
      }
    }
  }

  // Resolve dynamic or static chart view result
  const activeViewResult: DynamicViewResult | null = section.type === 'chart' ? section.buildView(data, effectiveValues) : null;

  // Extract option and dynamic KPI overrides
  const activeOption: EChartsOption | null = !activeViewResult ? null : isBundleResult(activeViewResult) ? activeViewResult.option : activeViewResult;

  const activeTitle = activeViewResult && isBundleResult(activeViewResult) && activeViewResult.title ? activeViewResult.title : section.title;

  const kpisTop: KpiCardSpec[] = activeViewResult && isBundleResult(activeViewResult) && activeViewResult.kpisTop ? activeViewResult.kpisTop : section.kpisTop || [];

  const kpisBottom: KpiCardSpec[] = activeViewResult && isBundleResult(activeViewResult) && activeViewResult.kpisBottom ? activeViewResult.kpisBottom : section.kpisBottom || [];

  const sources: ProjectSource[] = activeViewResult && isBundleResult(activeViewResult) && activeViewResult.sources ? activeViewResult.sources : section.sources || [];

  const fmt = useFormat();
  const { t } = useTranslation();

  const renderControls = () => {
    if (section.type !== 'chart' || !resolvedControls?.length) return null;
    return resolvedControls.map((ctrl: ChartControl) => {
      switch (ctrl.type) {
        case 'slider': {
          const val = Number(effectiveValues[ctrl.id] ?? ctrl.defaultValue);
          return (
            <div key={ctrl.id} className="control-panel inline-flex items-center gap-2.5 px-3 h-7 text-xs">
              {ctrl.label && (
                <span className="text-content-secondary font-medium whitespace-nowrap">
                  {ctrl.label}: <span className="font-bold text-accent-primary font-mono">{fmt.number(val)}</span>
                </span>
              )}
              <div className="w-28 flex items-center">
                <Slider min={ctrl.min} max={ctrl.max} step={ctrl.step} value={[val]} onValueChange={([v]) => handleControlChange(ctrl.id, v)} />
              </div>
            </div>
          );
        }
        case 'range-slider': {
          const range = (effectiveValues[ctrl.id] ?? ctrl.defaultValue ?? [ctrl.min, ctrl.max]) as [number, number];
          return (
            <div key={ctrl.id} className="control-panel inline-flex items-center gap-2.5 px-3 h-7 text-xs">
              {ctrl.label && (
                <span className="text-content-secondary font-medium whitespace-nowrap">
                  {ctrl.label}:{' '}
                  <span className="font-bold text-accent-primary font-mono">
                    {range[0]} – {range[1]}
                  </span>
                </span>
              )}
              <div className="w-32 flex items-center">
                <Slider
                  min={ctrl.min}
                  max={ctrl.max}
                  step={ctrl.step ?? 1}
                  minStepsBetweenThumbs={ctrl.minStepsBetweenThumbs ?? 0}
                  value={range}
                  onValueChange={(val) => handleControlChange(ctrl.id, val as [number, number])}
                />
              </div>
            </div>
          );
        }
        case 'toggle': {
          const val = String(effectiveValues[ctrl.id] ?? ctrl.defaultValue);
          return (
            <ToggleGroup
              key={ctrl.id}
              type="single"
              value={val}
              onValueChange={(v) => {
                if (v) handleControlChange(ctrl.id, v);
              }}
            >
              {ctrl.options.map((opt) => (
                <ToggleGroupItem key={opt.value} value={opt.value}>
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          );
        }
        case 'checkbox': {
          const checked = Boolean(effectiveValues[ctrl.id] ?? ctrl.defaultValue);
          const controlId = `ctrl-${sectionId}-${ctrl.id}`;
          return (
            <div key={ctrl.id} className="control-panel inline-flex items-center gap-2 px-2.5 h-7 text-xs select-none transition-colors hover:bg-surface-elevated">
              <Checkbox id={controlId} checked={checked} onCheckedChange={(c) => handleControlChange(ctrl.id, Boolean(c))} />
              {ctrl.label && (
                <label htmlFor={controlId} className="text-content-secondary font-medium cursor-pointer">
                  {ctrl.label}
                </label>
              )}
            </div>
          );
        }
        default:
          return null;
      }
    });
  };

  const renderContent = () => {
    switch (section.type) {
      case 'breakdown-grid':
        return <SectionBreakdown spec={section} data={data} projectSlug={projectSlug} />;
      case 'custom':
        return (
          <>
            <SectionHeader sectionId={sectionId} projectSlug={projectSlug} title={section.title} />
            {section.render(data)}
          </>
        );
      case 'chart':
        return (
          <>
            <SectionHeader sectionId={sectionId} projectSlug={projectSlug} title={activeTitle} controls={renderControls()} />
            {activeOption && <SectionChart option={activeOption} id={`chart-${sectionId}`} exportName={exportName} title={activeTitle} />}
          </>
        );
    }
  };

  return (
    <>
      {/* Upper KPI cards */}
      {kpisTop.length > 0 && <KpiRow kpis={kpisTop} />}

      {/* Unified Section Card Container */}
      <div className="card">
        {renderContent()}

        {/* Section Sources Footer */}
        {sources.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border-subtle/50 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-content-dim font-semibold uppercase tracking-wider text-[11px]">{sources.length > 1 ? t.common.sources : t.common.source}:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {sources.map((s) => (
                <a
                  key={s.url || s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-subtle px-2 py-0.5 text-[11px] text-content-secondary hover:text-accent-primary transition-colors flex items-center gap-1"
                >
                  <span>{s.name}</span>
                  <ExternalLinkIcon className="w-2.5 h-2.5 text-content-dim shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lower KPI cards */}
      {kpisBottom.length > 0 && <KpiRow kpis={kpisBottom} />}
    </>
  );
}

/** Universal dashboard section scaffolding coordinating anchor links, generic controls, dynamic KPI rows, and inner visualizers. */
export const Section: React.FC<SectionProps> = ({ section, projectSlug, initialInView = false }) => {
  const { ref, hasEnteredView } = useInView<HTMLElement>({
    id: section.id,
    initialInView,
  });
  const shouldLoad = hasEnteredView;

  return (
    <section ref={ref} id={section.id} {...{ [SECTION_DATA_ATTR]: section.id }} className="scroll-mt-20 flex flex-col gap-4">
      {shouldLoad ? (
        <Suspense fallback={<SectionLoader id={section.id} projectSlug={projectSlug} title={section.title} />}>
          <SectionLoadedContent section={section} projectSlug={projectSlug} />
        </Suspense>
      ) : (
        <SectionLoader id={section.id} projectSlug={projectSlug} title={section.title} />
      )}
    </section>
  );
};
