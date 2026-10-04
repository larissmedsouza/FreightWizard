'use client';

import { useState, useEffect } from 'react';
import TopBar, { type Language } from './ui/TopBar';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

interface HeaderProps {
  session: string | null;
  user?: { email: string; name: string } | null;
  darkMode: boolean;
  language: Language;
  onToggleTheme: () => void;
  onChangeLanguage: (lang: Language) => void;
  onDisconnect?: () => void;
}

/**
 * Settings-area header: the shared TopBar plus the integration health check
 * (red dot on the settings icon when SERPRO errors or its certificate expires
 * within 30 days).
 */
export default function Header({ session, user, darkMode, language, onToggleTheme, onChangeLanguage, onDisconnect }: HeaderProps) {
  const [integrationAlert, setIntegrationAlert] = useState(false);

  useEffect(() => {
    if (!session) return;
    fetch(`${API_URL}/api/settings/integrations?session=${session}`)
      .then(r => r.json())
      .then(data => {
        const s = data.integration?.serproStatus;
        const expiry = data.integration?.serproCertExpiry;
        const expiringSoon = expiry ? (new Date(expiry).getTime() - Date.now()) / 86400000 < 30 : false;
        setIntegrationAlert((s === 'error') || (s === 'connected' && expiringSoon));
      }).catch(() => {});
  }, [session]);

  return (
    <TopBar
      session={session}
      user={user}
      darkMode={darkMode}
      language={language}
      onToggleTheme={onToggleTheme}
      onChangeLanguage={onChangeLanguage}
      onDisconnect={onDisconnect}
      alert={integrationAlert}
    />
  );
}
