import DE from 'country-flag-icons/react/3x2/DE';
import GB from 'country-flag-icons/react/3x2/GB';
import RU from 'country-flag-icons/react/3x2/RU';
import UA from 'country-flag-icons/react/3x2/UA';
import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { useHref, useLocation, useNavigate } from 'react-router';
import type { LocaleCommon as commonEn } from '@/locales/common-en';
import type { ProjectMeta, ProjectTag } from '@/types';
import { getThemeColors, type ResolvedTheme, type ThemeColors, type ThemeSetting } from '../styles/tokens';
import { type CldrLocaleUnits, createFormat, type LocalizedFormatters } from './format';

/* -------------------------------------------------------------------------- */
/* 1. Constants, Types & Events                                               */
/* -------------------------------------------------------------------------- */

/** Custom DOM event name dispatched when color theme setting changes in the active tab. */
const THEME_CHANGE_EVENT = 'graphs-theme-change';

/** Custom DOM event name dispatched when active language setting changes in the active tab. */
const LANG_CHANGE_EVENT = 'graphs-lang-change';

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

/** Context value contract provided by AppProvider. */
export interface AppContextValue {
  /** Active color theme mode preference ('system' | 'dark' | 'light'). */
  theme: ThemeSetting;
  /** Effective concrete theme applied to DOM and canvases ('dark' | 'light'). */
  resolvedTheme: ResolvedTheme;
  /** Resolved theme colors token palette for the active concrete theme. */
  tokens: ThemeColors;
  /** Sets and persists the theme mode in browser storage. */
  setTheme: (targetTheme: ThemeSetting) => void;
  /** Cycles through available theme modes (system -> light -> dark -> system). */
  toggleTheme: () => void;

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
  /** Switches current language and navigates to the localized URL. */
  setLanguage: (targetLang: Language) => void;
  /** Prepends language prefix to an app-relative path (for React Router Link/Navigate). */
  getPath: (path: string) => string;
  /** Resolves absolute browser URL path with language prefix and router basename (for history.replaceState, <a>, and clipboard). */
  getHref: (path: string) => string;
  /** Resolves localized human-readable label for a project category tag. */
  getTagLabel: (tag: ProjectTag) => string;
}

/** Props for AppProvider / LocaleProvider component. */
export interface AppProviderProps {
  lang: Language;
  common: LocaleCommonDict;
  cldr?: CldrLocaleUnits;
  projects: ProjectMeta[];
  children: React.ReactNode;
}

/* -------------------------------------------------------------------------- */
/* 2. External Store Synchronization (Theme & OS Preference)                  */
/* -------------------------------------------------------------------------- */

/**
 * Subscribes to browser storage changes (cross-tab sync) and local dispatch events (intra-tab sync)
 * for reactive theme setting updates via useSyncExternalStore.
 */
function subscribeTheme(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
  };
}

/** Reads active theme mode setting from browser localStorage with 'system' fallback. */
function getThemeSnapshot(): ThemeSetting {
  if (typeof window === 'undefined') return 'system';
  const saved = localStorage.getItem('theme');
  return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : 'system';
}

/** Returns static server/SSG theme snapshot ('system') to guarantee clean client hydration. */
function getServerThemeSnapshot(): ThemeSetting {
  return 'system';
}

/** Subscribes to operating system theme preference changes via window.matchMedia. */
function subscribeSystemTheme(callback: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', callback);
  return () => {
    media.removeEventListener('change', callback);
  };
}

/** Reads current operating system theme preference ('dark' | 'light') from window.matchMedia. */
function getSystemThemeSnapshot(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Returns static server/SSG theme baseline ('dark') for consistent initial layout. */
function getServerSystemThemeSnapshot(): ResolvedTheme {
  return 'dark';
}

/* -------------------------------------------------------------------------- */
/* 3. Routing & Language Resolution Utilities                                 */
/* -------------------------------------------------------------------------- */

/** Resolves the user's preferred language from browser settings matching supported site languages. */
export function resolveBrowserLanguage(): Language {
  if (typeof navigator === 'undefined' || !navigator.languages) {
    return DEFAULT_LANGUAGE;
  }
  for (const tag of navigator.languages) {
    const code = tag.split('-')[0].toLowerCase();
    if (SUPPORTED_LANGUAGE_CODES.includes(code as Language)) {
      return code as Language;
    }
  }
  return DEFAULT_LANGUAGE;
}

/** Extracts active language code from URL pathname (e.g. '/ru/...' -> 'ru', '/...' -> 'en'). */
export function getLanguageFromPath(pathname: string): Language {
  const start = pathname.startsWith('/') ? 1 : 0;
  const slashIdx = pathname.indexOf('/', start);
  const seg = (slashIdx === -1 ? pathname.slice(start) : pathname.slice(start, slashIdx)) as Language;
  return seg in LANGUAGE_MAP ? seg : DEFAULT_LANGUAGE;
}

/** Formats a path into a localized path with proper language prefix, preserving query parameters and hash anchors. */
export function getLocalizedPath(rawPath: string, targetLang: Language): string {
  const qIdx = rawPath.search(/[?#]/);
  const pathname = qIdx === -1 ? rawPath : rawPath.slice(0, qIdx);
  const suffix = qIdx === -1 ? '' : rawPath.slice(qIdx);

  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const secondSlash = normalized.indexOf('/', 1);
  const firstSeg = (secondSlash === -1 ? normalized.slice(1) : normalized.slice(1, secondSlash)) as Language;

  const cleanPath = firstSeg in LANGUAGE_MAP ? (secondSlash === -1 ? '/' : normalized.slice(secondSlash)) : normalized;
  const localized = targetLang === DEFAULT_LANGUAGE ? cleanPath : cleanPath === '/' ? `/${targetLang}` : `/${targetLang}${cleanPath}`;

  return `${localized}${suffix}`;
}

/** Resolves the full browser pathname including query string search and hash anchor. */
export function getFullCurrentPath(pathname: string): string {
  if (typeof window === 'undefined') return pathname;
  const search = window.location.search || '';
  const hash = window.location.hash || '';
  return `${pathname}${search}${hash}`;
}

/* -------------------------------------------------------------------------- */
/* 4. Unified Application Context Provider                                    */
/* -------------------------------------------------------------------------- */

const AppContext = createContext<AppContextValue | null>(null);

/**
 * Unified application context provider coordinating locale dictionary resolution,
 * theme management (system/dark/light), first-visit auto-detection, and storage persistence.
 */
export const AppProvider: React.FC<AppProviderProps> = ({ lang, common, cldr, projects, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const rootHref = useHref('/');
  const basePrefix = rootHref === '/' ? '' : rootHref.replace(/\/+$/, '');

  // Theme state synchronized with localStorage and OS preference via useSyncExternalStore
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);
  const systemTheme = useSyncExternalStore(subscribeSystemTheme, getSystemThemeSnapshot, getServerSystemThemeSnapshot);

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;
  const tokens = getThemeColors(resolvedTheme);

  // Sync theme with document class and ensure default key is initialized in localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!localStorage.getItem('theme')) {
      localStorage.setItem('theme', 'system');
    }

    const isDark = resolvedTheme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
  }, [resolvedTheme]);

  const setTheme = (targetTheme: ThemeSetting) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', targetTheme);
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    }
  };

  const toggleTheme = () => {
    const cycleMap: Record<ThemeSetting, ThemeSetting> = {
      system: 'light',
      light: 'dark',
      dark: 'system',
    };
    setTheme(cycleMap[theme]);
  };

  // Language synchronization, first-visit browser detection, and cross-tab storage persistence
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let stored = localStorage.getItem('lang') as Language | null;
    if (!stored || !(stored in LANGUAGE_MAP)) {
      stored = resolveBrowserLanguage();
      localStorage.setItem('lang', stored);
    }

    if (stored !== lang) {
      navigate(getLocalizedPath(getFullCurrentPath(location.pathname), stored), { replace: true });
    }

    const handleSync = () => {
      const updated = localStorage.getItem('lang') as Language | null;
      if (updated && updated in LANGUAGE_MAP && updated !== lang) {
        navigate(getLocalizedPath(getFullCurrentPath(location.pathname), updated));
      }
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener(LANG_CHANGE_EVENT, handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener(LANG_CHANGE_EVENT, handleSync);
    };
  }, [lang, location.pathname, navigate]);

  const setLanguage = (targetLang: Language) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lang', targetLang);
      window.dispatchEvent(new Event(LANG_CHANGE_EVENT));
    }
    if (targetLang === lang) return;
    navigate(getLocalizedPath(getFullCurrentPath(location.pathname), targetLang));
  };

  const getPath = (path: string) => getLocalizedPath(path, lang);
  const getHref = (path: string) => `${basePrefix}${getLocalizedPath(path, lang)}`;
  const getTagLabel = (tag: ProjectTag) => common.tagNames[tag] || tag;
  const fmt = createFormat(lang, cldr);

  const value: AppContextValue = {
    theme,
    resolvedTheme,
    tokens,
    setTheme,
    toggleTheme,
    lang,
    projects,
    t: {
      common,
    },
    fmt,
    setLanguage,
    getPath,
    getHref,
    getTagLabel,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

/* -------------------------------------------------------------------------- */
/* 5. Application Hooks                                                       */
/* -------------------------------------------------------------------------- */

/** React hook accessing theme mode, resolved theme, theme color tokens, and theme controls. */
export function useTheme() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    return {
      theme: 'system' as ThemeSetting,
      resolvedTheme: 'dark' as ResolvedTheme,
      tokens: getThemeColors('dark'),
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return {
    theme: ctx.theme,
    resolvedTheme: ctx.resolvedTheme,
    tokens: ctx.tokens,
    setTheme: ctx.setTheme,
    toggleTheme: ctx.toggleTheme,
  };
}

/** React hook accessing active language and language switcher. */
export function useLanguage() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    return {
      lang: DEFAULT_LANGUAGE,
      setLanguage: () => {},
    };
  }
  return {
    lang: ctx.lang,
    setLanguage: ctx.setLanguage,
  };
}

/** React hook resolving localized application paths and hrefs. */
export function usePath() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    return {
      getPath: (p: string) => p,
      getHref: (p: string) => p,
    };
  }
  return {
    getPath: ctx.getPath,
    getHref: ctx.getHref,
  };
}

/** React hook accessing localized common dictionary and taxonomy labels. */
export function useTranslation() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within an AppProvider');
  }
  return {
    t: ctx.t,
    getTagLabel: ctx.getTagLabel,
  };
}

/** React hook accessing pre-bound localized formatters for the active language. */
export function useFormat(): LocalizedFormatters {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useFormat must be used within an AppProvider');
  }
  return ctx.fmt;
}

/** React hook accessing localized project catalog descriptors. */
export function useCatalog(): ProjectMeta[] {
  const ctx = useContext(AppContext);
  return ctx?.projects ?? [];
}
