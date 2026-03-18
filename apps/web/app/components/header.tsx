'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const Icon = ({ name, className = "w-5 h-5", style }: { name: string; className?: string; style?: React.CSSProperties }) => (
  <img src={`/icons/${name}.svg`} alt={name} className={className} style={style} />
);

type Language = 'en' | 'pt' | 'nl';

interface HeaderProps {
  session: string | null;
  user?: { email: string; name: string } | null;
  darkMode: boolean;
  language: Language;
  onToggleTheme: () => void;
  onChangeLanguage: (lang: Language) => void;
  onDisconnect?: () => void;
}

const langLabels: Record<Language, string> = { en: 'EN', pt: 'PT', nl: 'NL' };

const navItems = [
  { href: '/dashboard', label: { en: 'Inbox', pt: 'Caixa de Entrada', nl: 'Inbox' }, icon: 'Dashboard_analytics_total email' },
  { href: '/analytics', label: { en: 'Analytics', pt: 'Analytics', nl: 'Analytics' }, icon: 'Dashboard_analyrtics_AI Insights' },
  { href: '/team', label: { en: 'Team', pt: 'Equipa', nl: 'Team' }, icon: 'Dashboard_email_team' },
  { href: '/documents', label: { en: 'Documents', pt: 'Documentos', nl: 'Documenten' }, icon: 'Dashboard_documents' },
];

export default function Header({ session, user, darkMode, language, onToggleTheme, onChangeLanguage, onDisconnect }: HeaderProps) {
  const pathname = usePathname();
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const theme = darkMode ? {
    card: 'bg-[#0a0a1a]',
    cardBorder: 'border-white/5',
    text: 'text-white',
    textMuted: 'text-gray-400',
    hover: 'hover:bg-white/5',
    iconFilter: { filter: 'brightness(0) invert(1)' },
    activeNav: 'bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 border border-[#5200FF]/40 text-white',
    inactiveNav: 'text-gray-400 hover:text-white border border-transparent hover:border-white/10',
  } : {
    card: 'bg-white/90 backdrop-blur-sm',
    cardBorder: 'border-slate-200/50',
    text: 'text-slate-900',
    textMuted: 'text-slate-600',
    hover: 'hover:bg-slate-100/50',
    iconFilter: { filter: 'brightness(0) saturate(100%) invert(19%) sepia(96%) saturate(5765%) hue-rotate(268deg) brightness(102%) contrast(101%)' },
    activeNav: 'bg-gradient-to-r from-[#9E14FB]/10 to-[#1BA1FF]/10 border border-[#5200FF]/30 text-slate-900',
    inactiveNav: 'text-slate-500 hover:text-slate-900 border border-transparent hover:border-slate-200',
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <header className={`${theme.card} border-b ${theme.cardBorder} px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm`}>
      {/* Logo */}
      <Link href={session ? `/dashboard?session=${session}` : '/'} className="flex items-center gap-2 flex-shrink-0">
        <img src="/icons/webpage_main_logo_white.svg" alt="FreightWizard"
          className={`h-6 w-6 object-contain ${darkMode ? '' : 'brightness-0'}`} />
        <span className="text-base font-bold">FreightWizard</span>
      </Link>

      {/* Nav Links — only show when logged in */}
      {user && (
        <nav className="flex items-center gap-1 mx-4">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={`${item.href}?session=${session}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${isActive(item.href) ? theme.activeNav : theme.inactiveNav}`}
            >
              <Icon name={item.icon} className="w-3.5 h-3.5"
                style={isActive(item.href) ? (darkMode ? { filter: 'brightness(0) invert(1)' } : theme.iconFilter) : theme.iconFilter} />
              {item.label[language]}
            </Link>
          ))}
        </nav>
      )}

      {/* Right side controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Language picker */}
        <div className="relative">
          <button
            onClick={() => setLangMenuOpen(!langMenuOpen)}
            className={`px-3 py-1.5 text-sm ${theme.textMuted} border ${theme.cardBorder} rounded-full ${theme.hover} flex items-center gap-1`}
          >
            {langLabels[language]} <span className="text-xs">▼</span>
          </button>
          {langMenuOpen && (
            <div className={`absolute top-full right-0 mt-2 ${theme.card} border ${theme.cardBorder} rounded-xl shadow-xl z-50 overflow-hidden min-w-16`}>
              {(['en', 'pt', 'nl'] as Language[]).map(l => (
                <button key={l} onClick={() => { onChangeLanguage(l); setLangMenuOpen(false); }}
                  className={`w-full px-4 py-2 text-left text-sm ${theme.hover} ${language === l ? 'text-[#9E14FB] font-medium' : theme.textMuted}`}>
                  {langLabels[l]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button onClick={onToggleTheme} className={`p-2 rounded-full ${theme.hover} border ${theme.cardBorder}`}>
          <Icon name={darkMode ? 'Dashboard_sun_light_mode' : 'Dashboard_moon_dark_mode'} className="w-4 h-4"
            style={theme.iconFilter} />
        </button>

        {/* User info + disconnect */}
        {user ? (
          <>
            <span className={`text-sm ${theme.textMuted} hidden lg:block max-w-36 truncate`}>{user.email}</span>
            {onDisconnect && (
              <button onClick={onDisconnect}
                className="text-sm text-red-400 border border-red-400/30 px-3 py-1.5 rounded-full hover:bg-red-400/10 transition">
                {language === 'pt' ? 'Desconectar' : language === 'nl' ? 'Ontkoppelen' : 'Disconnect'}
              </button>
            )}
          </>
        ) : (
          <Link href="/" className={`text-sm ${theme.textMuted} border ${theme.cardBorder} px-3 py-1.5 rounded-full ${theme.hover}`}>
            ← Home
          </Link>
        )}
      </div>
    </header>
  );
}