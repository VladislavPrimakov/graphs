import { Link } from 'react-router';
import { usePath, useTranslation } from '@/utils/provider';

/** Bare 404 error page presenting a message and a single localized link to the catalog root. */
export default function NotFoundPage() {
  const { getPath } = usePath();
  const { t } = useTranslation();
  const homePath = getPath('/');

  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center">
      <title>{`404 — ${t.common.pageNotFound}`}</title>
      <meta name="description" content={t.common.pageNotFoundDescription} />

      <div className="space-y-4 max-w-md">
        <h1 className="text-5xl sm:text-6xl font-mono font-bold tracking-tight text-accent-primary">404</h1>
        <p className="text-base text-content-secondary leading-relaxed">{t.common.pageNotFoundDescription}</p>
        <div className="pt-2">
          <Link to={homePath} className="btn-accent px-5 py-2.5 text-sm font-semibold">
            {t.common.goHome} &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
