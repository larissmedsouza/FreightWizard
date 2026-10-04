import Link from 'next/link';

/** Settings sub-navigation (Integrations / Billing): underline tabs, not pills. */
export default function SettingsTabs({ active, session }: { active: 'integrations' | 'billing'; session: string | null }) {
  const tabs = [
    { key: 'integrations', label: 'Integrations', href: `/settings/integrations?session=${session}` },
    { key: 'billing', label: 'Billing', href: `/billing?session=${session}` },
  ] as const;
  return (
    <nav className="flex border-b border-app-line" aria-label="Settings">
      {tabs.map(t => {
        const on = t.key === active;
        return on ? (
          <span key={t.key} aria-current="page" className="relative px-3 py-2 text-app-ui font-medium text-app-ink">
            {t.label}
            <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 bg-app-accent-fill" />
          </span>
        ) : (
          <Link key={t.key} href={t.href} className="px-3 py-2 text-app-ui text-app-ink-2 transition-colors hover:text-app-ink">
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
