import { use, useEffect } from 'react';
import { useParams } from 'react-router';
import NotFoundPage from '@/pages/NotFoundPage';
import { cn } from '@/utils/cn';
import { usePath, useTranslation } from '@/utils/provider';
import { type ChangelogRelease, parseChangelogReleases, SITE_VERSION } from '@/utils/version';
import { SECTION_DATA_ATTR, scrollToSection, useScrollSpy } from '@/utils/viewport';

interface ChangelogData {
  html: string;
  releases: ChangelogRelease[];
}

let changelogPromise: Promise<ChangelogData> | null = null;

function loadChangelog(): Promise<ChangelogData> {
  if (!changelogPromise) {
    changelogPromise = Promise.all([import('../../../CHANGELOG.md?raw'), import('marked')]).then(async ([rawMod, markedMod]) => {
      const changelogRaw = rawMod.default;
      const releases = parseChangelogReleases(changelogRaw);

      const marked = new markedMod.Marked({ gfm: true });
      marked.use({
        renderer: {
          heading({ text, depth }) {
            if (depth === 2) {
              const match = text.match(/\[(\d+\.\d+\.\d+)\]/);
              if (match) {
                const id = `v${match[1]}`;
                return `<h2 id="${id}" ${SECTION_DATA_ATTR}="${id}">${text}</h2>\n`;
              }
              const slug = text
                .toLowerCase()
                .replace(/[^\w]+/g, '-')
                .replace(/^-|-$/g, '');
              return `<h2 id="${slug}">${text}</h2>\n`;
            }
            return `<h${depth}>${text}</h${depth}>\n`;
          },
        },
      });

      const html = await marked.parse(changelogRaw);
      return { html, releases };
    });
  }
  return changelogPromise;
}

interface ChangelogContentProps {
  html: string;
  releases: ChangelogRelease[];
  normalizedVersion?: string;
}

function ChangelogContent({ html, releases, normalizedVersion }: ChangelogContentProps) {
  const { t } = useTranslation();
  const { getHref } = usePath();

  const activeId = useScrollSpy(
    (id) => (id ? getHref(`/changelog/${id}`) : getHref('/changelog')),
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
                const targetHref = getHref(`/changelog/${id}`);

                return (
                  <a
                    key={ver}
                    href={targetHref}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection(id, 'smooth');
                      history.replaceState(null, '', targetHref + window.location.search);
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
  const { html, releases } = use(loadChangelog());
  const { version } = useParams<{ version?: string }>();

  const normalizedVersion = version ? (version.startsWith('v') ? version : `v${version}`) : undefined;

  if (normalizedVersion && !releases.some((r) => `v${r.version}` === normalizedVersion)) {
    return <NotFoundPage />;
  }

  return <ChangelogContent html={html} releases={releases} normalizedVersion={normalizedVersion} />;
}
