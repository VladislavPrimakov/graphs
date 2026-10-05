import type { EChartsOption } from 'echarts';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { SectionBreakdown } from '@/components/sections/SectionBreakdown';
import { SectionChart } from '@/components/sections/SectionChart';
import { AnchorButton } from '@/components/ui/AnchorButton';
import { Checkbox } from '@/components/ui/Checkbox';
import { KpiRow } from '@/components/ui/KpiCard';
import { Slider } from '@/components/ui/Slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup';
import type { ChartControl, DashboardSection as DashboardSectionType, DynamicBundleResult, DynamicViewResult, KpiCardSpec } from '@/types';
import { useFormat } from '@/utils/locales';

function isBundleResult(res: DynamicViewResult): res is DynamicBundleResult {
  return typeof res === 'object' && res !== null && 'option' in res;
}

/** Props for the polymorphic Section renderer. */
export interface SectionProps {
  /** Polymorphic section specification (chart, dynamic chart, or breakdown grid). */
  section: DashboardSectionType;
  /** Unique project slug identifier for anchor links and export filenames. */
  projectSlug?: string;
}

type ControlStateValue = string | number | boolean | [number, number];

/** Universal dashboard section scaffolding coordinating anchor links, generic controls, dynamic KPI rows, and inner visualizers. */
export const Section: React.FC<SectionProps> = ({ section, projectSlug }) => {
  // Initialize control values dictionary from section controls
  const [controlValues, setControlValues] = useState<Record<string, ControlStateValue>>(() => {
    const initial: Record<string, ControlStateValue> = {};
    if (section.type === 'chart') {
      for (const ctrl of section.controls ?? []) {
        if (ctrl.type === 'range-slider') {
          initial[ctrl.id] = ctrl.defaultValue ?? [ctrl.min, ctrl.max];
        } else {
          initial[ctrl.id] = ctrl.defaultValue;
        }
      }
    }
    return initial;
  });

  const controlsRef = useRef<HTMLDivElement>(null);
  const [controlsHeight, setControlsHeight] = useState(0);

  useEffect(() => {
    const el = controlsRef.current;
    if (!el) return;

    const updateHeight = () => {
      const isFloating = window.getComputedStyle(el).position === 'absolute';
      setControlsHeight(isFloating ? el.offsetHeight : 0);
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(el);
    window.addEventListener('resize', updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  const handleControlChange = (id: string, value: ControlStateValue) => {
    setControlValues((prev) => ({ ...prev, [id]: value }));
  };

  const sectionId = section.id;
  const exportName = projectSlug ? `${projectSlug}--${sectionId}` : sectionId;

  // Resolve dynamic or static chart view result
  const activeViewResult: DynamicViewResult | null = section.type === 'chart' ? section.buildView(controlValues) : null;

  // Extract option and dynamic KPI overrides
  const activeOption: EChartsOption | null = !activeViewResult ? null : isBundleResult(activeViewResult) ? activeViewResult.option : activeViewResult;

  const optTitle = Array.isArray(activeOption?.title) ? activeOption?.title[0] : activeOption?.title;
  const hasTitle = Boolean(optTitle && optTitle.show !== false && optTitle.text);
  const chartOffsetTop = controlsHeight > 28 && hasTitle ? controlsHeight - 28 : 0;

  const kpisTop: KpiCardSpec[] = activeViewResult && isBundleResult(activeViewResult) && activeViewResult.kpisTop ? activeViewResult.kpisTop : section.kpisTop || [];

  const kpisBottom: KpiCardSpec[] = activeViewResult && isBundleResult(activeViewResult) && activeViewResult.kpisBottom ? activeViewResult.kpisBottom : section.kpisBottom || [];

  const fmt = useFormat();

  const renderControls = () => {
    if (section.type !== 'chart' || !section.controls?.length) return null;
    return (
      <div ref={controlsRef} className="flex flex-col items-end gap-2 shrink-0 ml-auto lg:absolute lg:top-4 lg:right-4 lg:z-10 lg:pointer-events-auto">
        {section.controls.map((ctrl: ChartControl) => {
          switch (ctrl.type) {
            case 'slider': {
              const val = Number(controlValues[ctrl.id] ?? ctrl.defaultValue);
              return (
                <div key={ctrl.id} className="control-panel inline-flex items-center gap-2.5 px-3 h-7 text-xs">
                  {ctrl.label && (
                    <span className="text-content-secondary font-medium whitespace-nowrap">
                      {ctrl.label}: <span className="font-bold text-accent-primary font-mono">{fmt.number(val)}</span>
                    </span>
                  )}
                  <div className="w-20 sm:w-28 flex items-center">
                    <Slider min={ctrl.min} max={ctrl.max} step={ctrl.step} value={[val]} onValueChange={([v]) => handleControlChange(ctrl.id, v)} />
                  </div>
                </div>
              );
            }
            case 'range-slider': {
              const range = (controlValues[ctrl.id] ?? ctrl.defaultValue ?? [ctrl.min, ctrl.max]) as [number, number];
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
                  <div className="w-24 sm:w-32 flex items-center">
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
              const val = String(controlValues[ctrl.id] ?? ctrl.defaultValue);
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
              const checked = Boolean(controlValues[ctrl.id] ?? ctrl.defaultValue);
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
        })}
      </div>
    );
  };

  const renderContent = () => {
    switch (section.type) {
      case 'breakdown-grid':
        return <SectionBreakdown spec={section} projectSlug={projectSlug} />;
      case 'custom':
        return (
          <>
            <div className="flex items-start justify-between gap-3 mb-3 lg:mb-0 lg:pointer-events-none">
              <div className="lg:absolute lg:top-4 lg:left-4 lg:z-10 lg:pointer-events-auto">
                <AnchorButton sectionId={sectionId} projectSlug={projectSlug} />
              </div>
            </div>
            {section.render()}
          </>
        );
      case 'chart':
        return (
          <>
            <div className="flex items-start justify-between gap-3 mb-3 lg:mb-0 lg:pointer-events-none">
              <div className="lg:absolute lg:top-4 lg:left-4 lg:z-10 lg:pointer-events-auto">
                <AnchorButton sectionId={sectionId} projectSlug={projectSlug} />
              </div>
              {renderControls()}
            </div>
            {activeOption && <SectionChart option={activeOption} id={`chart-${sectionId}`} offsetTop={chartOffsetTop} exportName={exportName} />}
          </>
        );
    }
  };

  return (
    <section id={sectionId} data-section={sectionId} className="scroll-mt-20 sm:scroll-mt-22 flex flex-col gap-4">
      {/* Upper KPI cards */}
      {kpisTop.length > 0 && <KpiRow kpis={kpisTop} />}

      {/* Unified Section Card Container */}
      <div className="card group">{renderContent()}</div>

      {/* Lower KPI cards */}
      {kpisBottom.length > 0 && <KpiRow kpis={kpisBottom} />}
    </section>
  );
};
