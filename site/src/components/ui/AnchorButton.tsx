import type React from 'react';
import { useState } from 'react';
import { CheckIcon, LinkIcon } from '@/components/icons';
import { cn } from '@/utils/cn';
import { useLanguage, useTranslation } from '@/utils/locales';

/** Props for the section deep-link copy button. */
export interface AnchorButtonProps {
  /** Target section canonical identifier. */
  sectionId: string;
  /** Optional project slug. */
  projectSlug?: string;
  /** Optional additional CSS class names. @default '' */
  className?: string;
}

/** Interactive button for copying direct deep links to sections. */
export const AnchorButton: React.FC<AnchorButtonProps> = ({ sectionId, projectSlug, className }) => {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();
  const { getHref } = useLanguage();

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!sectionId) return;
    const href = projectSlug ? getHref(`/${projectSlug}/${sectionId}`) : `${window.location.pathname.replace(/\/+$/, '')}/${sectionId}`;
    const url = `${window.location.origin}${href}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Fallback for environments where clipboard permissions are restricted
      });
  };

  return (
    <button type="button" onClick={handleCopy} className={cn('anchor-btn group', className)} aria-label={`${t.common.copyLink}: /${sectionId}`}>
      {copied ? (
        <>
          <CheckIcon className="w-3.5 h-3.5 text-status-success shrink-0" />
          <span className="text-status-success font-semibold">{t.common.copied}!</span>
        </>
      ) : (
        <>
          <LinkIcon className="w-3.5 h-3.5 text-content-dim group-hover:text-accent-primary shrink-0 transition-colors" />
          <span>/{sectionId}</span>
        </>
      )}
    </button>
  );
};
