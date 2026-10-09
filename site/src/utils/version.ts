declare const __SITE_VERSION__: string;

/** Latest semantic release version extracted directly from the root CHANGELOG.md at build time. */
export const SITE_VERSION = typeof __SITE_VERSION__ !== 'undefined' ? __SITE_VERSION__ : '0.0.0';

/** Canonical production domain origin used for absolute OpenGraph and Twitter card URLs. */
export const SITE_ORIGIN = 'https://vladislavprimakov.github.io';

/** Resolves an absolute canonical URL for social media preview cards. */
export function getAbsoluteUrl(relPath: string): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  const cleanRel = relPath.startsWith('/') ? relPath : `/${relPath}`;
  return `${SITE_ORIGIN}${base}${cleanRel}`;
}

/** Regex pattern matching semantic version release headers in CHANGELOG.md (e.g. '## [1.2.2] - 2026-10-08'). */
export const CHANGELOG_VERSION_REGEX = /^## \[(\d+\.\d+\.\d+)\]/gm;

/** Extracts semantic version strings from raw changelog markdown content. */
export function parseChangelogVersions(rawChangelog: string): string[] {
  return [...rawChangelog.matchAll(CHANGELOG_VERSION_REGEX)].map((m) => m[1]);
}
