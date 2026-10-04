import DE from 'country-flag-icons/react/3x2/DE';
import GB from 'country-flag-icons/react/3x2/GB';
import RU from 'country-flag-icons/react/3x2/RU';
import UA from 'country-flag-icons/react/3x2/UA';
import type React from 'react';
import { createContext, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { LocaleCommon as commonEn } from '@/locales/common-en';
import type { ProjectMeta, ProjectTag } from '@/types';
import { type CldrLocaleUnits, createFormat, type LocalizedFormatters } from './format';

/** Map of language codes to metadata descriptors (SSoT for supported locales). */
export const LANGUAGE_MAP = {
  en: { label: 'English', Flag: GB },
  ru: { label: 'Русский', Flag: RU },
  uk: { label: 'Українська', Flag: UA },
  de: { label: 'Deutsch', Flag: DE },
} as const;

/** Supported ISO 639-1 language codes across frontend visualization dashboards. */
export type Language = keyof typeof LANGUAGE_MAP;

/** Default fallback language when no prefix is specified in the URL path. */
export const DEFAULT_LANGUAGE: Language = 'en';

/** Canonical list of all supported ISO 639-1 language codes. */
export const SUPPORTED_LANGUAGE_CODES: Language[] = Object.keys(LANGUAGE_MAP) as Language[];

/** Non-default languages requiring a localized URL route prefix. */
export const NON_DEFAULT_LANGUAGES: Language[] = SUPPORTED_LANGUAGE_CODES.filter((code) => code !== DEFAULT_LANGUAGE);

/** Type schema for common UI dictionary. */
export type LocaleCommonDict = typeof commonEn;

/** Extracts active language code from URL pathname (e.g. '/ru/...' -> 'ru', '/...' -> 'en'). */
export function getLanguageFromPath(pathname: string): Language {
  const seg = pathname.replace(/^\//, '').split('/')[0] as Language;
  return seg in LANGUAGE_MAP ? seg : DEFAULT_LANGUAGE;
}

/** Formats a path into a localized path with proper language prefix, preserving query parameters and hash anchors. */
export function getLocalizedPath(rawPath: string, targetLang: Language): string {
  const [, pathname, suffix = ''] = rawPath.match(/^([^?#]*)(.*)$/) ?? [];
  const seg = pathname.split('/')[1] as Language;
  const cleanPath = seg in LANGUAGE_MAP ? pathname.slice(seg.length + 1) || '/' : pathname;
  const localized = targetLang === DEFAULT_LANGUAGE ? cleanPath : cleanPath === '/' ? `/${targetLang}` : `/${targetLang}${cleanPath}`;
  return `${localized}${suffix}`;
}

/** Context value contract provided by LocaleProvider. */
export interface LocaleContextValue {
  /** Current active language code. */
  lang: Language;
  /** Localized project catalog descriptors for the active language. */
  projects: ProjectMeta[];
  /** Translation namespaces. */
  t: {
    /** Common UI localized strings dictionary. */
    common: LocaleCommonDict;
  };
  /** Pre-bound localized formatters for the active language. */
  fmt: LocalizedFormatters;
  /** Switches current language via client navigation. */
  setLanguage: (targetLang: Language) => void;
  /** Prepends language prefix to a path. */
  getPath: (path: string) => string;
  /** Resolves localized human-readable label for a project category tag. */
  getTagLabel: (tag: ProjectTag) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** Props for LocaleProvider component. */
export interface LocaleProviderProps {
  lang: Language;
  common: LocaleCommonDict;
  cldr?: CldrLocaleUnits;
  projects: ProjectMeta[];
  children: React.ReactNode;
}

/** Context provider supplying localized common strings and language navigation helpers. */
export const LocaleProvider: React.FC<LocaleProviderProps> = ({ lang, common, cldr, projects, children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const setLanguage = (targetLang: Language) => {
    if (targetLang === lang) return;
    const search = typeof window !== 'undefined' ? window.location.search : location.search;
    const hash = typeof window !== 'undefined' ? window.location.hash : location.hash;
    const currentPath = `${location.pathname}${search}${hash}`;
    navigate(getLocalizedPath(currentPath, targetLang));
  };

  const getPath = (path: string) => getLocalizedPath(path, lang);

  const getTagLabel = (tag: ProjectTag) => common.tagNames[tag] || tag;

  const fmt = createFormat(lang, cldr);

  const value: LocaleContextValue = {
    lang,
    projects,
    t: {
      common,
    },
    fmt,
    setLanguage,
    getPath,
    getTagLabel,
  };

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

/** React hook accessing active language, navigation path resolver, and language switcher. */
export function useLanguage() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      lang: DEFAULT_LANGUAGE,
      setLanguage: () => {},
      getPath: (p: string) => p,
    };
  }
  return {
    lang: ctx.lang,
    setLanguage: ctx.setLanguage,
    getPath: ctx.getPath,
  };
}

/** React hook accessing localized common dictionary and taxonomy labels. */
export function useTranslation() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within a LocaleProvider');
  }
  return {
    t: ctx.t,
    getTagLabel: ctx.getTagLabel,
  };
}

/** React hook accessing pre-bound localized formatters for the active language. */
export function useFormat(): LocalizedFormatters {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useFormat must be used within a LocaleProvider');
  }
  return ctx.fmt;
}

/** React hook accessing localized project catalog descriptors. */
export function useCatalog(): ProjectMeta[] {
  const ctx = useContext(LocaleContext);
  return ctx?.projects ?? [];
}
