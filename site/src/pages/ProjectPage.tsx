import { use } from 'react';
import { useParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionNav } from '@/components/layout/SectionNav';
import { Section } from '@/components/sections/Section';
import metadata from '@/data/metadata.json';
import NotFoundPage from '@/pages/NotFoundPage';
import { loadProjectBundle } from '@/projects/registry';
import { PROJECT_SLUGS, type ProjectSlug } from '@/types';
import { type Language, useFormat, useLanguage, useTranslation } from '@/utils/locales';

interface ProjectDashboardProps {
  slug: ProjectSlug;
  lang: Language;
}

/** Internal dashboard content view coordinating polymorphic section rendering. */
function ProjectDashboard({ slug, lang }: ProjectDashboardProps) {
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
  const anchors = sections.map((s) => s.anchorId);

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <div className="flex flex-col gap-6 sm:gap-8">
        <SectionNav anchors={anchors} />
        <PageHeader title={title} description={description} tags={project.tags} sources={project.sources} lastUpdated={lastUpdated} />
        <div className="flex flex-col gap-8">
          {sections.map((section) => (
            <Section key={section.anchorId} section={section} projectSlug={project.id} />
          ))}
        </div>
      </div>
    </>
  );
}

/** Universal dashboard shell component unwrapping dynamic project bundle via React 19 use(). */
export default function ProjectPage() {
  const { slug } = useParams() as { slug: ProjectSlug };
  const { lang } = useLanguage();

  if (!slug || !PROJECT_SLUGS.includes(slug)) {
    return <NotFoundPage />;
  }

  return <ProjectDashboard key={`${slug}:${lang}`} slug={slug} lang={lang} />;
}
