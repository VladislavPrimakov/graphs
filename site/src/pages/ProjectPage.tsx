import { use } from 'react';
import { useParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionNav } from '@/components/layout/SectionNav';
import { Section } from '@/components/sections/Section';
import metadata from '@/data/metadata.json';
import NotFoundPage from '@/pages/NotFoundPage';
import { loadProjectBundle, STATIC_PROJECT_MAP } from '@/projects/registry';
import { PROJECT_SLUGS, type ProjectSlug } from '@/types';
import { type Language, useFormat, useLanguage, useTranslation } from '@/utils/locales';

interface ProjectDashboardProps {
  slug: ProjectSlug;
  section?: string;
  lang: Language;
}

/** Internal dashboard content view coordinating polymorphic section rendering. */
function ProjectDashboard({ slug, section, lang }: ProjectDashboardProps) {
  const { t: localeT } = useTranslation();
  const fmt = useFormat();

  const { project, data, t: routeT } = use(loadProjectBundle(slug, lang));

  const t = {
    common: localeT.common,
    projMeta: routeT.projMeta,
    proj: routeT.proj,
  };
  const title = t.projMeta.title;
  const description = t.projMeta.description;
  const lastUpdated = (metadata as Record<string, string>)[project.id];
  // biome-ignore lint/suspicious/noExplicitAny: polymorphic dispatch across dynamic project specifications
  const sections = project.buildSections({ data: data as any, lang, t: t as any, fmt });

  const sectionTitles: Record<string, string> = {};
  for (const s of sections) {
    if (s.title) sectionTitles[s.id] = s.title;
  }

  const activeSection = section ? sections.find((s) => s.id === section) : undefined;
  const activeSectionTitle = activeSection?.title || (section ? sectionTitles[section] : undefined);
  const pageTitle = activeSectionTitle ? `${title} — ${activeSectionTitle}` : title;

  return (
    <>
      <title>{pageTitle}</title>
      <meta property="og:title" content={pageTitle} />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="description" content={description} />
      <meta property="og:description" content={description} />
      <div className="flex flex-col gap-6 sm:gap-8">
        <SectionNav sections={project.sections as unknown as string[]} projectSlug={project.id} sectionTitles={sectionTitles} projectTitle={title} initialSection={section} />
        <PageHeader title={title} description={description} tags={project.tags} sources={project.sources} lastUpdated={lastUpdated} />
        <div className="flex flex-col gap-8">
          {sections.map((sec) => (
            <Section key={sec.id} section={sec} projectSlug={project.id} />
          ))}
        </div>
      </div>
    </>
  );
}

/** Universal dashboard shell component unwrapping dynamic project bundle via React 19 use(). */
export default function ProjectPage() {
  const { slug, section } = useParams() as { slug: ProjectSlug; section?: string };
  const { lang } = useLanguage();

  if (!slug || !PROJECT_SLUGS.includes(slug)) {
    return <NotFoundPage />;
  }

  const staticMeta = STATIC_PROJECT_MAP[slug];
  if (section && !staticMeta?.sections.includes(section)) {
    return <NotFoundPage />;
  }

  return <ProjectDashboard key={`${slug}:${lang}`} slug={slug} section={section} lang={lang} />;
}
