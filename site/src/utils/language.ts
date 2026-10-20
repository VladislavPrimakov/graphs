/** Supported ISO 639-1 language codes across frontend visualization dashboards. */
export const SUPPORTED_LANGUAGES = ['en', 'ru', 'uk', 'de'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** Default fallback language when no prefix is specified in the URL path. */
export const DEFAULT_LANGUAGE: Language = 'en';

/** Canonical list of all supported ISO 639-1 language codes. */
export const SUPPORTED_LANGUAGE_CODES: Language[] = [...SUPPORTED_LANGUAGES];

/** Non-default languages requiring a localized URL route prefix. */
export const NON_DEFAULT_LANGUAGES: Language[] = SUPPORTED_LANGUAGE_CODES.filter((code) => code !== DEFAULT_LANGUAGE);
