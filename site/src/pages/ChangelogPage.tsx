import { changelogData } from 'virtual:changelog';
import { useEffect } from 'react';
import { useParams } from 'react-router';
import { dismissInitialLoader } from '@/components/ui/LoadingSpinner';
import NotFoundPage from '@/pages/NotFoundPage';
import { cn } from '@/utils/cn';
import { usePath, useTranslation } from '@/utils/provider';
import { type ChangelogRelease, SITE_VERSION } from '@/utils/version';
import { scrollToSection, useScrollSpy } from '@/utils/viewport';

interface ChangelogContentProps {
  html: string;
  releases: ChangelogRelease[];
  normalizedVersion?: string;
}

function ChangelogContent({ html, releases, normalizedVersion }: ChangelogContentProps) {
  const { t } = useTranslation();
  const { getPath } = usePath();

  const activeId = useScrollSpy(
    (id) => (id ? getPath(`/changelog/${id}`) : getPath('/changelog')),
    normalizedVersion,
    (id) => {
      const ver = (id || normalizedVersion || `v${SITE_VERSION}`).replace(/^v/, '');
      return `${t.common.changelog} (v${ver})`;
    },
  );

  const activeVersion = (activeId || normalizedVersion || `v${SITE_VERSION}`).replace(/^v/, '');
  const pageTitle = `${t.common.changelog} (v${activeVersion})`;

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  useEffect(() => {
    dismissInitialLoader();
  }, []);

  const changelogDesc = `Release history and changelog for Graphs (v${activeVersion})`;

  return (
    <>
      <title>{pageTitle}</title>
      <meta name="description" content={changelogDesc} />
      <meta property="og:site_name" content={t.common.graphs} />
      <meta property="og:type" content="article" />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={changelogDesc} />

      <div className="max-w-7xl mx-auto py-6">
        <div className="flex gap-8 items-start justify-center">
          {/* Left balance spacer to guarantee pixel-perfect viewport centering on desktop */}
          <div className="hidden lg:block w-48 shrink-0 pointer-events-none" aria-hidden="true" />

          {/* Main changelog document */}
          <div className="max-w-5xl w-full min-w-0">
            <div className="card p-6">
              {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized static build markdown content */}
              <div className="changelog-markdown text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </div>

          {/* Right sticky outline TOC (desktop) */}
          <aside className="hidden lg:block w-48 shrink-0 sticky top-24">
            <div className="text-2xs font-bold text-content-muted uppercase tracking-wider mb-2.5 px-3">{t.common.releases}</div>
            <nav className="grid grid-cols-[max-content_auto] border-l border-border-subtle text-xs">
              {releases.map(({ version: ver, date }) => {
                const id = `v${ver}`;
                const isActive = activeId === id;
                const targetPath = getPath(`/changelog/${id}`);

                return (
                  <a
                    key={ver}
                    href={targetPath}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection(id, 'smooth');
                      history.replaceState(null, '', targetPath + window.location.search);
                      document.title = `${t.common.changelog} (v${ver})`;
                    }}
                    className={cn(
                      'col-span-2 grid grid-cols-subgrid px-3 py-1.5 font-mono items-baseline gap-x-2 whitespace-nowrap transition-all',
                      isActive
                        ? 'border-l-2 border-accent-primary -ml-0.5 font-bold text-accent-primary bg-accent-glow/20 rounded-r'
                        : 'text-content-muted hover:text-content-primary hover:border-l hover:border-border-muted -ml-px',
                    )}
                  >
                    <span>{id}</span>
                    {date && <span className={cn('text-2xs font-mono', isActive ? 'text-accent-primary/80' : 'text-content-muted/70')}>({date})</span>}
                  </a>
                );
              })}
            </nav>
          </aside>
        </div>
      </div>
    </>
  );
}

/** Standalone Changelog page rendering continuous release notes with a sticky right outline and scroll-spy active highlights. */
export default function ChangelogPage() {
  const { html, releases } = changelogData;
  const { version } = useParams<{ version?: string }>();

  const normalizedVersion = version ? (version.startsWith('v') ? version : `v${version}`) : undefined;

  if (normalizedVersion && !releases.some((r) => `v${r.version}` === normalizedVersion)) {
    return <NotFoundPage />;
  }

  return <ChangelogContent html={html} releases={releases} normalizedVersion={normalizedVersion} />;
}
