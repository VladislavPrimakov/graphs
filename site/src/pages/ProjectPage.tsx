import { use, useEffect } from 'react';
import { useParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionNav } from '@/components/layout/SectionNav';
import { Section } from '@/components/sections/Section';
import { DashboardToolbars } from '@/components/ui/ControlBar';
import { dismissInitialLoader } from '@/components/ui/LoadingSpinner';
import NotFoundPage from '@/pages/NotFoundPage';
import { type DashboardSectionSpec, type DashboardToolbarSpec, loadProjectBundle, type Project, STATIC_PROJECT_MAP } from '@/utils/project';
import { type Language, useFormat, useLanguage, useTheme, useTranslation } from '@/utils/provider';
import { type ControlStore, clearStoreRegistry, getOrCreateStoreFromControls } from '@/utils/store';
import { getAbsoluteUrl } from '@/utils/version';
import metadata from '../../public/data/metadata.json';

interface ProjectDashboardProps {
  slug: string;
  section?: string;
  lang: Language;
}

const projectDataPromisesCache = new WeakMap<Project, Record<string, Promise<unknown>>>();

/** Pre-caches project-level data loader promises per project specification instance to maintain referential stability for use(). */
function getProjectDataPromises(project: Project): Record<string, Promise<unknown>> {
  if (!project.data) return {};
  let cached = projectDataPromisesCache.get(project);
  if (!cached) {
    cached = {};
    for (const key in project.data) {
      cached[key] = project.data[key]();
    }
    projectDataPromisesCache.set(project, cached);
  }
  return cached;
}

/** Dynamic content view resolving project datasets, building interactive toolbars, and coordinating sections. */
function ProjectDashboard({ slug, section, lang }: ProjectDashboardProps) {
  const { t: localeT } = useTranslation();
  const fmt = useFormat();
  const { resolvedTheme, tokens } = useTheme();

  const { project, t: routeT } = use(loadProjectBundle(slug, lang));

  const t = {
    common: localeT.common,
    projMeta: routeT.projMeta,
    proj: routeT.proj,
  };
  const title = t.projMeta.title;
  const description = t.projMeta.description;
  const lastUpdated = (metadata as Record<string, string>)[project.id];
  // biome-ignore lint/suspicious/noExplicitAny: polymorphic dispatch across dynamic project specifications
  const buildCtx = { lang, t: t as any, fmt, theme: resolvedTheme, tokens };

  useEffect(() => {
    dismissInitialLoader();
    return () => {
      clearStoreRegistry();
    };
  }, []);

  // Resolve project-level data loaders (if defined)
  const projectData: Record<string, unknown> = {};
  if (project.data) {
    const promises = getProjectDataPromises(project);
    for (const key in promises) {
      projectData[key] = use(promises[key]);
    }
  }

  const sections = project.buildSections(buildCtx);
  const toolbars: DashboardToolbarSpec[] = project.toolbars ? project.toolbars(projectData, buildCtx) : [];

  const metaSectionTitles = routeT.projMeta.sections as Record<string, string>;
  const activeSectionTitle = section ? metaSectionTitles[section] : undefined;
  const pageTitle = activeSectionTitle ? `${title} — ${activeSectionTitle}` : title;

  const fullSectionTitles: Record<string, string> = {};
  for (const s of sections) {
    if (s.title) fullSectionTitles[s.id] = s.title;
  }
  const pageDescription = (section ? fullSectionTitles[section] : undefined) || description;

  const targetSectionId = section || (project.sections?.[0] as string | undefined);
  const ogImage = targetSectionId ? getAbsoluteUrl(`/og/${project.id}-${targetSectionId}.png`) : undefined;

  const getMatchedToolbars = (secId: string) => toolbars.filter((tb) => (tb.scope === 'all' ? true : tb.scope.includes(secId)));

  const renderSections = () => {
    if (toolbars.length === 0) {
      return sections.map((sec, index) => {
        const isInitial = section ? sec.id === section : index === 0;
        return <Section key={sec.id} section={sec} projectSlug={project.id} projectData={projectData} initialInView={isInitial} />;
      });
    }

    const projectStores: Record<string, ControlStore> = {};
    for (const tb of toolbars) {
      projectStores[tb.id] = getOrCreateStoreFromControls(tb.id, tb.controls, { urlPrefix: tb.urlPrefix });
    }

    interface SectionGroup {
      toolbars: DashboardToolbarSpec[];
      sections: { spec: DashboardSectionSpec; index: number }[];
    }

    const groups: SectionGroup[] = [];

    for (let idx = 0; idx < sections.length; idx++) {
      const spec = sections[idx];
      const matched = getMatchedToolbars(spec.id);
      const lastGroup = groups[groups.length - 1];

      const isSameGroup = lastGroup && lastGroup.toolbars.length === matched.length && lastGroup.toolbars.every((tb, i) => tb.id === matched[i].id);

      if (isSameGroup) {
        lastGroup.sections.push({ spec, index: idx });
      } else {
        groups.push({ toolbars: matched, sections: [{ spec, index: idx }] });
      }
    }

    return groups.map((group) => {
      if (group.toolbars.length === 0) {
        return group.sections.map(({ spec, index }) => (
          <Section key={spec.id} section={spec} projectSlug={project.id} projectData={projectData} sectionLoaders={project.sectionData} initialInView={section ? spec.id === section : index === 0} />
        ));
      }

      const groupStores: Record<string, ControlStore> = {};
      for (const tb of group.toolbars) {
        groupStores[tb.id] = projectStores[tb.id];
      }

      return (
        <div key={`group-${group.sections[0].spec.id}`} className="section-group relative flex flex-col gap-8">
          <DashboardToolbars toolbars={group.toolbars} stores={groupStores} />
          {group.sections.map(({ spec, index }) => (
            <Section
              key={spec.id}
              section={spec}
              projectSlug={project.id}
              projectData={projectData}
              sectionLoaders={project.sectionData}
              initialInView={section ? spec.id === section : index === 0}
              externalStores={groupStores}
            />
          ))}
        </div>
      );
    });
  };

  return (
    <>
      <title>{pageTitle}</title>
      <meta property="og:site_name" content={t.common.graphs} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={pageTitle} />
      {pageDescription && (
        <>
          <meta name="description" content={pageDescription} />
          <meta property="og:description" content={pageDescription} />
        </>
      )}
      {ogImage && (
        <>
          <meta property="og:image" content={ogImage} />
          <meta name="twitter:card" content="summary_large_image" />
        </>
      )}
      <div className="flex flex-col gap-8">
        <SectionNav sections={project.sections as unknown as string[]} projectSlug={project.id} sectionTitles={metaSectionTitles} projectTitle={title} initialSection={section} />
        <PageHeader title={title} description={description} tags={project.tags} lastUpdated={lastUpdated} />
        <div className="flex flex-col gap-8">{renderSections()}</div>
      </div>
    </>
  );
}

/** Universal dashboard shell component unwrapping dynamic project bundle via React 19 use(). */
export default function ProjectPage() {
  const { slug, section } = useParams() as { slug?: string; section?: string };
  const { lang } = useLanguage();

  const staticMeta = slug ? STATIC_PROJECT_MAP[slug] : undefined;
  if (!slug || !staticMeta) {
    return <NotFoundPage />;
  }

  if (section && !staticMeta.sections.includes(section)) {
    return <NotFoundPage />;
  }

  return <ProjectDashboard key={`${slug}:${lang}`} slug={slug} section={section} lang={lang} />;
}
