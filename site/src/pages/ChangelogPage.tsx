import { use, useEffect } from 'react';
import { useParams } from 'react-router';
import NotFoundPage from '@/pages/NotFoundPage';
import { cn } from '@/utils/cn';
import { usePath, useTranslation } from '@/utils/provider';
import { SECTION_DATA_ATTR, useScrollSpy } from '@/utils/useScrollSpy';
import { parseChangelogVersions, SITE_VERSION } from '@/utils/version';

interface ChangelogData {
  html: string;
  versions: string[];
}

let changelogPromise: Promise<ChangelogData> | null = null;

function loadChangelog(): Promise<ChangelogData> {
  if (!changelogPromise) {
    changelogPromise = Promise.all([import('../../../CHANGELOG.md?raw'), import('marked')]).then(async ([rawMod, markedMod]) => {
      const changelogRaw = rawMod.default;
      const versions = parseChangelogVersions(changelogRaw);

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
      return { html, versions };
    });
  }
  return changelogPromise;
}

interface ChangelogContentProps {
  html: string;
  versions: string[];
  normalizedVersion?: string;
}

function ChangelogContent({ html, versions, normalizedVersion }: ChangelogContentProps) {
  const { t } = useTranslation();
  const { getHref } = usePath();

  const activeId = useScrollSpy({
    initialId: normalizedVersion,
    getHref: (id) => (id ? getHref(`/changelog/${id}`) : getHref('/changelog')),
    resolveTitle: (id) => {
      const ver = (id || normalizedVersion || `v${SITE_VERSION}`).replace(/^v/, '');
      return `${t.common.changelog} (v${ver})`;
    },
  });

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
          <div className="hidden lg:block w-36 shrink-0 pointer-events-none" aria-hidden="true" />

          {/* Main changelog document */}
          <div className="max-w-5xl w-full min-w-0">
            <div className="card bg-surface-card/60 p-6 shadow-sm">
              {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized static build markdown content */}
              <div className="changelog-markdown text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </div>

          {/* Right sticky outline TOC (desktop) */}
          <aside className="hidden lg:block w-36 shrink-0 sticky top-24">
            <div className="text-[11px] font-bold text-content-muted uppercase tracking-wider mb-2.5 px-3">{t.common.releases}</div>
            <nav className="flex flex-col border-l border-border-subtle text-xs">
              {versions.map((ver) => {
                const id = `v${ver}`;
                const isActive = activeId === id;
                const targetHref = getHref(`/changelog/${id}`);

                return (
                  <a
                    key={ver}
                    href={targetHref}
                    onClick={(e) => {
                      const target = document.getElementById(id);
                      if (target) {
                        e.preventDefault();
                        target.scrollIntoView({ behavior: 'smooth' });
                        history.replaceState(null, '', targetHref + window.location.search);
                        document.title = `${t.common.changelog} (v${ver})`;
                      }
                    }}
                    className={cn(
                      'px-3 py-1.5 font-mono transition-all',
                      isActive
                        ? 'border-l-2 border-accent-primary -ml-0.5 font-bold text-accent-primary bg-accent-glow/20 rounded-r'
                        : 'text-content-muted hover:text-content-primary hover:border-l hover:border-border-muted -ml-px',
                    )}
                  >
                    {id}
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
  const { html, versions } = use(loadChangelog());
  const { version } = useParams<{ version?: string }>();

  let normalizedVersion = version ? (version.startsWith('v') ? version : `v${version}`) : undefined;
  if (!normalizedVersion && typeof window !== 'undefined' && window.location.hash) {
    const hash = window.location.hash.slice(1).replace(/^v-/, 'v');
    if (versions.some((v) => `v${v}` === hash)) {
      normalizedVersion = hash;
    }
  }

  if (normalizedVersion && !versions.some((v) => `v${v}` === normalizedVersion)) {
    return <NotFoundPage />;
  }

  return <ChangelogContent html={html} versions={versions} normalizedVersion={normalizedVersion} />;
}
