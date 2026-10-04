declare const __SITE_VERSION__: string;

/** Latest semantic release version extracted directly from the root CHANGELOG.md at build time. */
export const SITE_VERSION = typeof __SITE_VERSION__ !== 'undefined' ? __SITE_VERSION__ : '0.0.0';
