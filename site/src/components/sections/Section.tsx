import type { EChartsOption } from 'echarts';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { SectionBreakdown } from '@/components/sections/SectionBreakdown';
import { SectionChart } from '@/components/sections/SectionChart';
import { AnchorButton } from '@/components/ui/AnchorButton';
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

/** Universal dashboard section scaffolding coordinating anchor links, generic controls, dynamic KPI rows, and inner visualizers. */
export const Section: React.FC<SectionProps> = ({ section, projectSlug }) => {
  // Initialize control values dictionary from section controls
  const [controlValues, setControlValues] = useState<Record<string, string | number>>(() => {
    const initial: Record<string, string | number> = {};
    if (section.type === 'chart') {
      for (const ctrl of section.controls ?? []) {
        initial[ctrl.id] = ctrl.defaultValue;
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

  const handleControlChange = (id: string, value: string | number) => {
    setControlValues((prev) => ({ ...prev, [id]: value }));
  };

  const anchorId = section.anchorId;
  const sectionId = section.id || anchorId;
  const exportName = projectSlug ? `${projectSlug}--${anchorId}` : anchorId;

  // Resolve dynamic or static chart view result
  const activeViewResult: DynamicViewResult | null = section.type === 'chart' ? section.buildView(controlValues) : null;

  // Extract option and dynamic KPI overrides
  const activeOption: EChartsOption | null = !activeViewResult ? null : isBundleResult(activeViewResult) ? activeViewResult.option : activeViewResult;

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
                <div key={ctrl.id} className="control-panel inline-flex items-center gap-2.5 px-3 py-1.5 text-xs">
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
        return <SectionBreakdown spec={section} />;
      case 'custom':
        return (
          <>
            <div className="flex items-start justify-between gap-3 mb-3 lg:mb-0 lg:pointer-events-none">
              <div className="lg:absolute lg:top-4 lg:left-4 lg:z-10 lg:pointer-events-auto">
                <AnchorButton anchorId={anchorId} />
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
                <AnchorButton anchorId={anchorId} />
              </div>
              {renderControls()}
            </div>
            {activeOption && <SectionChart option={activeOption} id={`chart-${sectionId}`} controlsHeight={controlsHeight} exportName={exportName} />}
          </>
        );
    }
  };

  return (
    <section id={anchorId} data-anchor-section={anchorId} className="scroll-mt-20 sm:scroll-mt-22 flex flex-col gap-4">
      {/* Upper KPI cards */}
      {kpisTop.length > 0 && <KpiRow kpis={kpisTop} />}

      {/* Unified Section Card Container */}
      <div className="card group">{renderContent()}</div>

      {/* Lower KPI cards */}
      {kpisBottom.length > 0 && <KpiRow kpis={kpisBottom} />}
    </section>
  );
};
