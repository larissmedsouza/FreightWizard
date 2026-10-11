'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from './Icon';

import { API_URL } from '@/app/lib/api';

export type Language = 'en' | 'pt' | 'nl';

/** Top navigation, shared by every logged-in page. Order is the product's main flow. */
export const APP_NAV = [
  { href: '/overview', label: { en: 'Overview', pt: 'Visão Geral', nl: 'Overzicht' } },
  { href: '/dashboard', label: { en: 'Inbox', pt: 'Caixa de Entrada', nl: 'Inbox' } },
  { href: '/shipments', label: { en: 'Shipments', pt: 'Embarques', nl: 'Zendingen' } },
  { href: '/quotes', label: { en: 'Quotes', pt: 'Cotações', nl: 'Offertes' } },
  { href: '/rates', label: { en: 'Rates', pt: 'Tarifas', nl: 'Tarieven' } },
  { href: '/analytics', label: { en: 'Analytics', pt: 'Analytics', nl: 'Analytics' } },
  { href: '/team', label: { en: 'Team', pt: 'Equipa', nl: 'Team' } },
  { href: '/documents', label: { en: 'Documents', pt: 'Documentos', nl: 'Documenten' } },
];

const langLabels: Record<Language, string> = { en: 'EN', pt: 'PT', nl: 'NL' };

/**
 * Dark navy bar in both light and dark mode (tokens: app-bar-*). The active
 * item gets an indigo-300 underline (7.3:1 on the bar), not a pill.
 * Optional pieces keep each page's existing controls: settings link, email,
 * disconnect, and an extra slot for page-specific links.
 */
export default function TopBar({
  session,
  user,
  darkMode,
  language,
  onToggleTheme,
  onChangeLanguage,
  onDisconnect,
  showSettings = true,
  showEmail = true,
  alert = false,
  extra,
  showNav = true,
}: {
  session: string | null;
  user?: { email: string; name?: string } | null;
  darkMode: boolean;
  language: Language;
  onToggleTheme: () => void;
  onChangeLanguage: (lang: Language) => void;
  onDisconnect?: () => void;
  showSettings?: boolean;
  showEmail?: boolean;
  /** Red dot on the settings icon (billing / integration attention). */
  alert?: boolean;
  extra?: ReactNode;
  showNav?: boolean;
}) {
  const pathname = usePathname() || '';
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  // Internal (staff/test) accounts: plan set in Supabase, read from the server.
  const [internal, setInternal] = useState(false);
  useEffect(() => {
    if (!session) { setInternal(false); return; }
    let live = true;
    fetch(`${API_URL}/api/billing/subscription?session=${session}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live) setInternal(d?.plan === 'internal'); })
      .catch(() => {});
    return () => { live = false; };
  }, [session]);

  const isActive = (href: string) => (href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href));
  const withSession = (href: string) => (session ? `${href}?session=${session}` : href);
  const settingsActive = pathname.startsWith('/settings');

  const iconBtn = 'relative flex size-8 items-center justify-center rounded-fw-btn border border-app-bar-line text-app-bar-muted transition-colors hover:bg-app-bar-hover hover:text-app-bar-ink';

  return (
    <header className="sticky top-0 z-40 border-b border-app-bar-line bg-app-bar-bg font-fw-sans text-app-bar-ink">
      <div className="flex h-12 items-center gap-4 px-4 lg:px-6">
        <Link href={session ? withSession('/overview') : '/'} className="flex flex-shrink-0 items-center" aria-label="FreightWizard">
          <img src="/icons/freightwizard_logo_white.png" alt="FreightWizard" className="h-5 w-auto" />
        </Link>

        {showNav && (user || session) && (
          <nav className="flex h-full min-w-0 flex-1 items-stretch overflow-x-auto" aria-label="Main">
            {APP_NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={withSession(item.href)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex flex-shrink-0 items-center px-3 text-app-ui transition-colors ${
                    active ? 'font-medium text-app-bar-ink' : 'text-app-bar-muted hover:text-app-bar-ink'
                  }`}
                >
                  {item.label[language]}
                  {active && <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 bg-app-bar-rule" />}
                </Link>
              );
            })}
          </nav>
        )}
        {!(showNav && (user || session)) && <div className="flex-1" />}

        <div className="flex flex-shrink-0 items-center gap-2">
          {extra}

          <div className="relative">
            <button
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              aria-expanded={langMenuOpen}
              className="flex h-8 items-center gap-1 rounded-fw-btn border border-app-bar-line px-2.5 font-fw-mono text-app-mono text-app-bar-muted transition-colors hover:bg-app-bar-hover hover:text-app-bar-ink"
            >
              {langLabels[language]} <Icon name="chevron" size={12} />
            </button>
            {langMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-16 overflow-hidden rounded-fw-card border border-app-bar-line bg-app-bar-bg shadow-app-pop">
                {(['en', 'pt', 'nl'] as Language[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => { onChangeLanguage(l); setLangMenuOpen(false); }}
                    className={`block w-full px-4 py-2 text-left font-fw-mono text-app-mono hover:bg-app-bar-hover ${language === l ? 'text-app-bar-rule' : 'text-app-bar-muted'}`}
                  >
                    {langLabels[l]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={onToggleTheme} className={iconBtn} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={darkMode ? 'Light mode' : 'Dark mode'}>
            <Icon name={darkMode ? 'sun' : 'moon'} size={16} />
          </button>

          {showSettings && session && (
            <Link
              href={withSession('/settings/integrations')}
              title="Settings"
              aria-label="Settings"
              className={`${iconBtn} ${settingsActive ? 'border-app-bar-rule text-app-bar-ink' : ''}`}
            >
              <Icon name="settings" size={16} />
              {alert && <span aria-hidden className="absolute right-0.5 top-0.5 size-2 rounded-full bg-app-danger-dot" />}
            </Link>
          )}

          {internal && (
            <span title="Internal account: no plan limits" className="rounded-fw-btn border border-app-bar-rule px-1.5 py-0.5 font-fw-mono text-app-mono-xs uppercase text-app-bar-ink">Internal</span>
          )}

          {showEmail && user && (
            <span className="hidden max-w-40 truncate text-app-ui-sm text-app-bar-muted xl:block">{user.email}</span>
          )}

          {onDisconnect && user && (
            <button
              onClick={onDisconnect}
              className="flex h-8 items-center gap-1.5 rounded-fw-btn border border-app-bar-line px-2.5 text-app-ui-sm text-app-bar-muted transition-colors hover:bg-app-bar-hover hover:text-app-bar-ink"
            >
              <Icon name="logout" size={15} />
              <span className="hidden lg:inline">{language === 'pt' ? 'Desconectar' : language === 'nl' ? 'Ontkoppelen' : 'Disconnect'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
