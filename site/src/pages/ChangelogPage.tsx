import { use } from 'react';
import { cn } from '@/utils/cn';
import { useTranslation } from '@/utils/locales';
import { useScrollSpy } from '@/utils/useScrollSpy';
import { SITE_VERSION } from '@/utils/version';

interface ChangelogData {
  html: string;
  versions: string[];
}

let changelogPromise: Promise<ChangelogData> | null = null;

function loadChangelog(): Promise<ChangelogData> {
  if (!changelogPromise) {
    changelogPromise = Promise.all([import('../../../CHANGELOG.md?raw'), import('marked')]).then(async ([rawMod, markedMod]) => {
      const changelogRaw = rawMod.default;
      const versionHeaderRegex = /^## \[(\d+\.\d+\.\d+)\]/gm;
      const versions = [...changelogRaw.matchAll(versionHeaderRegex)].map((m) => m[1]);

      const marked = new markedMod.Marked({ gfm: true });
      marked.use({
        renderer: {
          heading({ text, depth }) {
            if (depth === 2) {
              const match = text.match(/\[([^\]]+)\]/);
              const id = match ? `v-${match[1]}` : text.toLowerCase().replace(/[^\w]+/g, '-');
              return `<h2 id="${id}" data-anchor-section="${id}">${text}</h2>\n`;
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

/** Standalone Changelog page rendering continuous release notes with a sticky right outline and scroll-spy active highlights. */
export default function ChangelogPage() {
  const { html, versions } = use(loadChangelog());
  const { t } = useTranslation();

  const spiedActiveId = useScrollSpy();
  const activeId = spiedActiveId;

  return (
    <>
      <title>{`${t.common.changelog} (v${SITE_VERSION})`}</title>
      <meta name="description" content={`Release history and changelog for Graphs (v${SITE_VERSION})`} />

      <div className="max-w-7xl mx-auto py-4 sm:py-6">
        <div className="flex gap-8 items-start justify-center">
          {/* Left balance spacer to guarantee pixel-perfect viewport centering on desktop */}
          <div className="hidden lg:block w-36 shrink-0 pointer-events-none" aria-hidden="true" />

          {/* Main changelog document */}
          <div className="max-w-5xl w-full min-w-0">
            <div className="card bg-surface-card/60 p-6 sm:p-8 shadow-sm">
              {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized static build markdown content */}
              <div className="changelog-markdown text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </div>

          {/* Right sticky outline TOC (desktop) */}
          <aside className="hidden lg:block w-36 shrink-0 sticky top-24">
            <div className="text-[11px] font-bold text-content-muted uppercase tracking-wider mb-2.5 px-3">{t.common.releases}</div>
            <nav className="flex flex-col border-l border-border-subtle text-xs">
              {versions.map((ver) => {
                const id = `v-${ver}`;
                const isActive = activeId === id;

                return (
                  <a
                    key={ver}
                    href={`#${id}`}
                    className={cn(
                      'px-3 py-1.5 font-mono transition-all',
                      isActive
                        ? 'border-l-2 border-accent-primary -ml-0.5 font-bold text-accent-primary bg-accent-glow/20 rounded-r'
                        : 'text-content-muted hover:text-content-primary hover:border-l hover:border-border-muted -ml-px',
                    )}
                  >
                    v{ver}
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
