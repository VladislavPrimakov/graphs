import metadata from '@data/metadata.json';
import { use, useEffect, useEffectEvent, useState } from 'react';
import { useParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionNav } from '@/components/layout/SectionNav';
import { Section } from '@/components/sections/Section';
import NotFoundPage from '@/pages/NotFoundPage';
import { loadProjectBundle, STATIC_PROJECT_MAP } from '@/projects/registry';
import { type Language, useFormat, useLanguage, useTheme, useTranslation } from '@/utils/provider';

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

  // If entering with a target section in URL or clicking a nav pill, hold target lock until scroll settles
  const [navTarget, setNavTarget] = useState<string | null>(section ?? null);

  useEffect(() => {
    if (!section) return;

    // Scroll to target element with proper scroll-mt offset on initial mount
    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }, [section]);

  const unlock = useEffectEvent(() => {
    setNavTarget(null);
  });

  useEffect(() => {
    if (!navTarget) return;

    // Release target lock strictly when scrolling settles or user manually interacts
    window.addEventListener('scrollend', unlock, { once: true, passive: true });
    window.addEventListener('wheel', unlock, { once: true, passive: true });
    window.addEventListener('touchmove', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });

    return () => {
      window.removeEventListener('scrollend', unlock);
      window.removeEventListener('wheel', unlock);
      window.removeEventListener('touchmove', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [navTarget]);

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
        <SectionNav
          sections={project.sections as unknown as string[]}
          projectSlug={project.id}
          sectionTitles={sectionTitles}
          projectTitle={title}
          initialSection={section}
          onNavigate={(sectionId) => setNavTarget(sectionId)}
        />
        <PageHeader title={title} description={description} tags={project.tags} lastUpdated={lastUpdated} />
        <div className="flex flex-col gap-8">
          {sections.map((sec, index) => {
            const isTarget = navTarget ? sec.id === navTarget : section ? sec.id === section : index === 0;
            const enabled = !navTarget || isTarget;
            return <Section key={sec.id} section={sec} projectSlug={project.id} initialInView={isTarget} enabled={enabled} />;
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
