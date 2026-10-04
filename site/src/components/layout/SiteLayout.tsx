import type React from 'react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ChevronDownIcon, GithubIcon, LogoIcon, MenuIcon } from '@/components/icons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/Sheet';
import { cn } from '@/utils/cn';
import { LANGUAGE_MAP, SUPPORTED_LANGUAGE_CODES, useCatalog, useLanguage, useTranslation } from '@/utils/locales';
import { SITE_VERSION } from '@/utils/version';

const FLAG_STYLE = 'w-4 h-3 rounded-xs shadow-xs border border-border-subtle/80 shrink-0';

/** Application shell layout providing sticky navigation bar, slide-out drawer overlay, header section pills, and language switcher dropdown. */
export const SiteLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { lang, setLanguage, getPath } = useLanguage();
  const { t } = useTranslation();
  const projects = useCatalog();

  const navLinks = projects.map((p) => {
    const path = getPath(`/${p.id}`);
    const isActive = location.pathname === path || location.pathname.startsWith(`${path}/`);
    return { name: p.title, path, isActive };
  });

  const changelogPath = getPath('/changelog');
  const isChangelogActive = location.pathname === changelogPath;
  const CurrentFlag = LANGUAGE_MAP[lang].Flag;

  return (
    <>
      {/* Sticky Navigation Header */}
      <header className="sticky top-0 z-50 glass-bar px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          {/* Left: Sidebar Toggle, Logo & Version Pill */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button type="button" onClick={() => setOpen((v) => !v)} className="btn-subtle p-2 text-content-muted hover:text-content-primary cursor-pointer" aria-label={t.common.toggleNavigation}>
              <MenuIcon className="w-5 h-5" />
            </button>

            <Link to={getPath('/')} className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-blue-600 via-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform shrink-0">
                <LogoIcon className="w-5 h-5 text-white" />
              </div>
              <span className="hidden lg:inline font-bold text-lg leading-none text-content-primary tracking-tight group-hover:text-accent-primary transition-colors">{t.common.graphs}</span>
            </Link>

            <Link to={changelogPath} className={cn('nav-pill', isChangelogActive ? 'nav-pill-active' : 'nav-pill-idle')} aria-label={`${t.common.changelog} (v${SITE_VERSION})`}>
              v{SITE_VERSION}
            </Link>
          </div>

          {/* Center: Dynamic Section Navigation Portal Slot */}
          <div id="header-section-nav" className="flex-1 flex items-center justify-center min-w-0 max-w-full overflow-hidden" />

          {/* Right Action Controls: Language, GitHub */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Language Selector Dropdown (Radix DropdownMenu) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="btn-subtle text-content-primary group" aria-label={t.common.selectLanguage}>
                  <CurrentFlag className={FLAG_STYLE} aria-hidden="true" />
                  <span className="uppercase font-bold tracking-wider">{lang}</span>
                  <ChevronDownIcon className="w-3.5 h-3.5 text-content-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                {SUPPORTED_LANGUAGE_CODES.map((code) => {
                  const item = LANGUAGE_MAP[code];
                  const ItemFlag = item.Flag;
                  const isSelected = code === lang;
                  return (
                    <DropdownMenuItem key={code} onClick={() => setLanguage(code)} className={cn(isSelected && 'bg-accent-primary/10 text-accent-primary font-bold')}>
                      <ItemFlag className={FLAG_STYLE} aria-hidden="true" />
                      <span>{item.label}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* GitHub */}
            <a
              href="https://github.com/VladislavPrimakov/graphs"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-subtle p-2 text-content-muted hover:text-content-primary"
              aria-label={t.common.viewOnGitHub}
            >
              <GithubIcon className="w-4 h-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
        </div>
      </header>

      {/* Slide-out Navigation Drawer Overlay (Radix Dialog Sheet) */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 sm:w-80 p-4">
          <SheetHeader className="px-2">
            <SheetTitle>{t.common.projects}</SheetTitle>
            <SheetClose className="-mr-1" />
          </SheetHeader>
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
        </SheetContent>
      </Sheet>

      {/* Main Page Content */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">{children}</main>
    </>
  );
};
