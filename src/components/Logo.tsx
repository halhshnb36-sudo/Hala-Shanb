import { logoSrc, useSettings } from '@/lib/settings';

/** The brand logo. Uses the logo uploaded in Admin > Settings, or the bundled Hala Shanb logo by default. */
export function Logo({ className = '', priority = false }: { className?: string; priority?: boolean }) {
  const { settings } = useSettings();
  return (
    <img
      src={logoSrc(settings)}
      alt={`شعار ${settings.site_name}`}
      width={500}
      height={500}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
    />
  );
}
