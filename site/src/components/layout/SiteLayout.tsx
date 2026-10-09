import type React from 'react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ChevronDownIcon, GithubIcon, LogoIcon, MenuIcon, MonitorIcon, MoonIcon, SunIcon } from '@/components/icons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/Sheet';
import { cn } from '@/utils/cn';
import { LANGUAGE_MAP, SUPPORTED_LANGUAGE_CODES, useCatalog, useLanguage, usePath, useTheme, useTranslation } from '@/utils/provider';
import { SITE_VERSION } from '@/utils/version';

const FLAG_STYLE = 'w-4 h-3 rounded-xs shadow-xs border border-border-subtle/80 shrink-0';

interface BrandGroupProps {
  onNavigate?: () => void;
  hideLabelOnMobile?: boolean;
  hideVersionOnMobile?: boolean;
}

/** Brand logo, site title, and changelog version badge link. */
const BrandGroup: React.FC<BrandGroupProps> = ({ onNavigate, hideLabelOnMobile, hideVersionOnMobile }) => {
  const { getPath } = usePath();
  const { t } = useTranslation();
  const location = useLocation();
  const changelogPath = getPath('/changelog');
  const isChangelogActive = location.pathname === changelogPath || location.pathname.startsWith(`${changelogPath}/`);

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Link to={getPath('/')} onClick={onNavigate} className="flex items-center gap-2 group">
        <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-blue-600 via-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform shrink-0">
          <LogoIcon className="w-5 h-5 text-white" />
        </div>
        <span className={cn('font-bold text-lg leading-none text-content-primary tracking-tight group-hover:text-accent-primary transition-colors', hideLabelOnMobile && 'hidden lg:inline')}>
          {t.common.graphs}
        </span>
      </Link>

      <Link
        to={changelogPath}
        onClick={onNavigate}
        className={cn('nav-pill', isChangelogActive ? 'nav-pill-active' : 'nav-pill-idle', hideVersionOnMobile && 'hidden md:inline-flex')}
        aria-label={`${t.common.changelog} (v${SITE_VERSION})`}
      >
        v{SITE_VERSION}
      </Link>
    </div>
  );
};

interface ActionControlsProps {
  className?: string;
  showGitHubLabel?: boolean;
}

/** Action controls group: Theme cycling -> Language switcher -> GitHub repository link. */
const ActionControls: React.FC<ActionControlsProps> = ({ className, showGitHubLabel }) => {
  const { theme, toggleTheme } = useTheme();
  const { lang, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const CurrentFlag = LANGUAGE_MAP[lang].Flag;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        type="button"
        onClick={toggleTheme}
        className="btn-subtle p-2 text-content-secondary hover:text-content-primary cursor-pointer"
        aria-label={`Theme: ${theme}`}
        title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}
      >
        {theme === 'system' && <MonitorIcon className="w-4 h-4 text-accent-primary" />}
        {theme === 'light' && <SunIcon className="w-4 h-4 text-amber-500" />}
        {theme === 'dark' && <MoonIcon className="w-4 h-4 text-sky-400" />}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="btn-subtle text-content-primary group cursor-pointer" aria-label={t.common.selectLanguage}>
            <CurrentFlag className={FLAG_STYLE} aria-hidden="true" />
            <span className="uppercase font-bold tracking-wider">{lang}</span>
            <ChevronDownIcon className="w-3.5 h-3.5 text-content-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          {SUPPORTED_LANGUAGE_CODES.map((code) => {
            const item = LANGUAGE_MAP[code];
            const ItemFlag = item.Flag;
            return (
              <DropdownMenuItem key={code} onClick={() => setLanguage(code)} className={cn(code === lang && 'bg-accent-primary/10 text-accent-primary font-bold')}>
                <ItemFlag className={FLAG_STYLE} aria-hidden="true" />
                <span>{item.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <a
        href="https://github.com/VladislavPrimakov/graphs"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-subtle p-2 text-content-muted hover:text-content-primary flex items-center gap-1.5"
        aria-label={t.common.viewOnGitHub}
      >
        <GithubIcon className="w-4 h-4 shrink-0" />
        <span className={cn(!showGitHubLabel && 'hidden sm:inline')}>GitHub</span>
      </a>
    </div>
  );
};

/** Application shell layout providing sticky navigation bar, slide-out drawer overlay, header section pills, and language switcher dropdown. */
export const SiteLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { getPath } = usePath();
  const { t } = useTranslation();
  const projects = useCatalog();

  const navLinks = projects.map((p) => {
    const path = getPath(`/${p.id}`);
    const isActive = location.pathname === path || location.pathname.startsWith(`${path}/`);
    return { name: p.title, path, isActive };
  });

  return (
    <>
      {/* Sticky Navigation Header */}
      <header id="site-header" className="sticky top-0 z-50 glass-bar px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => setOpen((v) => !v)} className="btn-subtle p-2 text-content-muted hover:text-content-primary cursor-pointer" aria-label={t.common.toggleNavigation}>
              <MenuIcon className="w-5 h-5" />
            </button>

            <BrandGroup hideLabelOnMobile={true} hideVersionOnMobile={true} />
          </div>

          <div id="header-section-nav" className="flex-1 flex items-center justify-center min-w-0 max-w-full overflow-hidden" />

          <ActionControls className="hidden md:flex shrink-0" />
        </div>
      </header>

      {/* Slide-out Navigation Drawer Overlay */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-full md:w-80 p-4 flex flex-col gap-4">
          <SheetHeader className="px-1 mb-0 flex items-center justify-between">
            <BrandGroup onNavigate={() => setOpen(false)} />
            <SheetClose className="-mr-1" />
          </SheetHeader>

          {/* Drawer Action Controls: Left-aligned with natural spacing */}
          <div className="px-1">
            <ActionControls showGitHubLabel={true} />
          </div>

          {/* Projects Catalog */}
          <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
            <SheetTitle className="px-2">{t.common.projects}</SheetTitle>
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    link.isActive ? 'bg-surface-elevated text-accent-primary font-semibold shadow-xs' : 'text-content-secondary hover:text-content-primary hover:bg-surface-elevated/60',
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Page Content */}
      <main className="flex-1 w-full min-w-0 overflow-x-clip px-6 py-6">{children}</main>
    </>
  );
};
