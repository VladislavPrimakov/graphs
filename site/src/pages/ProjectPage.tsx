import metadata from '@data/metadata.json';
import { use, useEffect, useLayoutEffect } from 'react';
import { useParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionNav } from '@/components/layout/SectionNav';
import { Section } from '@/components/sections/Section';
import NotFoundPage from '@/pages/NotFoundPage';
import { loadProjectBundle, STATIC_PROJECT_MAP } from '@/projects/registry';
import { type Language, useFormat, useLanguage, useTheme, useTranslation } from '@/utils/provider';
import { getAbsoluteUrl } from '@/utils/version';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface ProjectDashboardProps {
  slug: string;
  section?: string;
  lang: Language;
}

/** Internal dashboard content view coordinating polymorphic section rendering. */
function ProjectDashboard({ slug, section, lang }: ProjectDashboardProps) {
  const { t: localeT } = useTranslation();
  const fmt = useFormat();
  const { resolvedTheme, tokens } = useTheme();

  const { project, t: routeT } = use(loadProjectBundle(slug, lang));

  useIsomorphicLayoutEffect(() => {
    if (section) {
      const el = document.getElementById(section);
      el?.scrollIntoView({ behavior: 'instant' });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [section]);

  const t = {
    common: localeT.common,
    projMeta: routeT.projMeta,
    proj: routeT.proj,
  };
  const title = t.projMeta.title;
  const description = t.projMeta.description;
  const lastUpdated = (metadata as Record<string, string>)[project.id];
  // biome-ignore lint/suspicious/noExplicitAny: polymorphic dispatch across dynamic project specifications
  const sections = project.buildSections({ lang, t: t as any, fmt, theme: resolvedTheme, tokens });

  const sectionTitles: Record<string, string> = {};
  for (const s of sections) {
    if (s.title) sectionTitles[s.id] = s.title;
  }

  const activeSectionTitle = section ? (routeT.projMeta.sections as Record<string, string>)[section] : undefined;
  const pageTitle = activeSectionTitle ? `${title} — ${activeSectionTitle}` : title;
  const pageDescription = (section ? sectionTitles[section] : undefined) || description;

  const targetSectionId = section || (project.sections?.[0] as string | undefined);
  const ogImage = targetSectionId ? getAbsoluteUrl(`/og/${project.id}-${targetSectionId}.png`) : undefined;

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
        <SectionNav sections={project.sections as unknown as string[]} projectSlug={project.id} sectionTitles={sectionTitles} projectTitle={title} initialSection={section} />
        <PageHeader title={title} description={description} tags={project.tags} lastUpdated={lastUpdated} />
        <div className="flex flex-col gap-8">
          {sections.map((sec, index) => {
            const isInitial = section ? sec.id === section : index === 0;
            return <Section key={sec.id} section={sec} projectSlug={project.id} initialInView={isInitial} />;
          })}
        </div>
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
