import type React from 'react';
import { createContext, Suspense, use, useContext } from 'react';
import { ExternalLinkIcon } from '@/components/icons';
import { SectionHeader } from '@/components/sections/SectionHeader';
import { ControlBar } from '@/components/ui/ControlBar';
import { KpiRow } from '@/components/ui/KpiCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { DashboardSectionSpec, DataLoader, DataLoadersMap, ProjectSource, ToolbarSpec } from '@/utils/project';
import { useTranslation } from '@/utils/provider';
import { type ControlStore, getOrCreateStoreFromControls, getStoreSnapshots, useCombinedStores } from '@/utils/store';
import { SECTION_DATA_ATTR, useInView } from '@/utils/viewport';

/** Context value exposed to visualizers nested within a section card. */
export interface SectionContextValue {
  sectionId: string;
  projectSlug: string;
  title?: string;
}

export const SectionContext = createContext<SectionContextValue | null>(null);

/** Hook accessing section identity and metadata within child visualizers. */
export function useSectionContext(): SectionContextValue | null {
  return useContext(SectionContext);
}

/** Props for the polymorphic Section renderer. */
export interface SectionProps {
  /** Polymorphic section specification. */
  section: DashboardSectionSpec;
  /** Unique project slug identifier for anchor links and export filenames. */
  projectSlug: string;
  /** Pre-resolved project-level data inherited by all dashboard sections. */
  projectData?: Record<string, unknown>;
  /** Optional project-level shared reactive data loaders evaluated inside sections on viewport entry. */
  sectionLoaders?: DataLoadersMap;
  /** Whether this section is the initial target for deep linking or above-the-fold display. @default false */
  initialInView?: boolean;
  /** Optional external dashboard toolbar stores governing this section. */
  externalStores?: Record<string, ControlStore>;
}

/** Clean card loader placeholder with normalized height preserving page geometry. */
function SectionLoader({ id, projectSlug, title }: { id: string; projectSlug?: string; title?: string }) {
  return (
    <div className="card min-h-chart flex flex-col justify-between relative">
      <SectionHeader sectionId={id} projectSlug={projectSlug} title={title} />
      <div className="flex-1 flex items-center justify-center min-h-75 relative">
        <LoadingSpinner fullscreen={false} size="sm" isVisible={true} />
      </div>
    </div>
  );
}

function SectionSources({ sources }: { sources?: ProjectSource[] }) {
  const { t } = useTranslation();
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-1 pt-1 border-t border-border-subtle/50 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-content-dim font-semibold uppercase tracking-wider text-2xs">{sources.length > 1 ? t.common.sources : t.common.source}:</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {sources.map((s) => (
          <a key={s.url || s.name} href={s.url} target="_blank" rel="noopener noreferrer" className="btn-subtle px-2 py-0.5 text-2xs gap-1">
            <span>{s.name}</span>
            <ExternalLinkIcon className="w-2.5 h-2.5 text-content-dim shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}

interface SectionLoadedContentProps {
  section: DashboardSectionSpec;
  projectSlug: string;
  projectData?: Record<string, unknown>;
  sectionLoaders?: DataLoadersMap;
  externalStores?: Record<string, ControlStore>;
  inViewRef: React.RefObject<boolean | null>;
  subscribeInView: (listener: (inView: boolean) => void) => () => void;
}

/** Inner section content unwrapping lazily fetched section dataset via React 19 use(). */
function SectionLoadedContent({ section, projectSlug, projectData = {}, sectionLoaders, externalStores, inViewRef, subscribeInView }: SectionLoadedContentProps) {
  const allLoaders: Record<string, DataLoader> = {
    ...(sectionLoaders ?? {}),
    ...((section.data as Record<string, DataLoader>) ?? {}),
  };

  const sectionData: Record<string, unknown> = {};
  if (Object.keys(allLoaders).length > 0) {
    const externalSnapshots = getStoreSnapshots(externalStores);

    const promises: Record<string, Promise<unknown>> = {};
    for (const key in allLoaders) {
      const loader = allLoaders[key];
      if (typeof loader === 'function') {
        promises[key] = loader(externalSnapshots);
      }
    }
    for (const key in promises) {
      sectionData[key] = use(promises[key]);
    }
  }

  const mergedData = {
    ...projectData,
    ...sectionData,
  };

  const rawToolbars = typeof section.toolbars === 'function' ? section.toolbars(mergedData) : section.toolbars;
  const internalToolbars: readonly ToolbarSpec[] = rawToolbars ?? [];

  const internalStores: Record<string, ControlStore> = {};
  for (const tb of internalToolbars) {
    if (tb.controls && tb.controls.length > 0) {
      internalStores[tb.id] = getOrCreateStoreFromControls(tb.id, tb.controls, { urlPrefix: tb.urlPrefix });
    }
  }

  const stores = { ...externalStores, ...internalStores };
  const storeValues = useCombinedStores(stores, inViewRef, subscribeInView) ?? {};

  const { content, title = section.title, kpisTop = section.kpisTop, kpisBottom = section.kpisBottom } = section.buildView(mergedData, storeValues);

  return (
    <SectionContext.Provider value={{ sectionId: section.id, projectSlug, title }}>
      <KpiRow kpis={kpisTop} />
      <div className="card">
        <SectionHeader sectionId={section.id} projectSlug={projectSlug} title={title} />
        {internalToolbars.length > 0 && (
          <div className="section-toolbar flex flex-col items-center gap-2 -mt-1 mb-4">
            {internalToolbars.map((tb) => {
              const store = internalStores[tb.id];
              return store ? <ControlBar key={tb.id} store={store} controls={tb.controls} /> : null;
            })}
          </div>
        )}
        {content}
        <SectionSources sources={section.sources} />
      </div>
      <KpiRow kpis={kpisBottom} />
    </SectionContext.Provider>
  );
}

/** Universal dashboard section scaffolding coordinating anchor links, generic controls, dynamic KPI rows, and inner visualizers. */
export const Section: React.FC<SectionProps> = ({ section, projectSlug, projectData, sectionLoaders, initialInView = false, externalStores }) => {
  const { ref, hasEnteredView, inViewRef, subscribeInView } = useInView<HTMLElement>(section.id, initialInView);
  const shouldLoad = hasEnteredView;

  return (
    <section ref={ref} id={section.id} {...{ [SECTION_DATA_ATTR]: section.id }} className="scroll-mt-16 flex flex-col gap-4">
      {shouldLoad ? (
        <Suspense fallback={<SectionLoader id={section.id} projectSlug={projectSlug} title={section.title} />}>
          <SectionLoadedContent
            section={section}
            projectSlug={projectSlug}
            projectData={projectData}
            sectionLoaders={sectionLoaders}
            externalStores={externalStores}
            inViewRef={inViewRef}
            subscribeInView={subscribeInView}
          />
        </Suspense>
      ) : (
        <SectionLoader id={section.id} projectSlug={projectSlug} title={section.title} />
      )}
    </section>
  );
};
