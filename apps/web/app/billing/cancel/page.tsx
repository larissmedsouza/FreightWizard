'use client';

import { useEffect, useState } from 'react';
import Icon from '../../components/ui/Icon';
import { appRootClass } from '../../components/ui/Panel';
import { buttonClass } from '../../components/ui/Button';

export default function BillingCancelPage() {
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem('fw_theme');
    if (savedTheme) setDarkMode(savedTheme === 'dark');
  }, []);

  return (
    <div data-theme={darkMode ? 'dark' : 'light'} className={`${appRootClass} flex items-center justify-center p-6`}>
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-fw-card border border-app-line text-app-accent">
          <Icon name="credit-card" size={24} />
        </span>
        <h1 className="mb-2 font-fw-display text-app-title font-light">No worries — you can upgrade anytime</h1>
        <a href="/pricing" className={`${buttonClass('primary', 'lg')} mt-4`}>
          Back to Pricing
        </a>
      </div>
    </div>
  );
}
