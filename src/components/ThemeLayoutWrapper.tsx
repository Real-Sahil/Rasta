/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language } from '../types';
import { translations } from '../data/locales';

export type ThemeMode = 'light' | 'dark';

interface MobilityThemeContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  isRtl: boolean;
  t: typeof translations['en'];
  // Alignment utilities for map controls and overlay panels
  alignEndClass: string;
  alignStartClass: string;
  mapControlCornerClass: string;
  floatingActionCornerClass: string;
  cardDirectionClass: string;
}

const MobilityThemeContext = createContext<MobilityThemeContextType | undefined>(undefined);

export const MobilityThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('rasta_lang');
    return (saved as Language) || 'en';
  });

  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('rasta_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const isRtl = language === 'ur' || language === 'pa' || language === 'ar';

  // Apply RTL and HTML attributes dynamically
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
    root.setAttribute('lang', language);

    if (isRtl) {
      root.classList.add('rtl-layout');
    } else {
      root.classList.remove('rtl-layout');
    }

    localStorage.setItem('rasta_lang', language);
  }, [language, isRtl]);

  // Apply Theme Mode dynamically to HTML root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('rasta_theme', theme);
  }, [theme]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
  };

  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  const t = translations[language] || translations.en;

  // Dynamic layout alignments that shift automatically with RTL
  const alignEndClass = isRtl ? 'text-left' : 'text-right';
  const alignStartClass = isRtl ? 'text-right' : 'text-left';
  // Floating controls like zoom and compass: placed on opposite of main drawer
  const mapControlCornerClass = isRtl ? 'left-4 top-20' : 'right-4 top-20';
  const floatingActionCornerClass = isRtl ? 'left-4 bottom-24' : 'right-4 bottom-24';
  const cardDirectionClass = isRtl ? 'flex-row-reverse text-right' : 'flex-row text-left';

  return (
    <MobilityThemeContext.Provider
      value={{
        language,
        setLanguage,
        theme,
        setTheme,
        toggleTheme,
        isRtl,
        t,
        alignEndClass,
        alignStartClass,
        mapControlCornerClass,
        floatingActionCornerClass,
        cardDirectionClass
      }}
    >
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className={`min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 ${
          isRtl ? 'font-urdu' : 'font-sans'
        }`}
      >
        {children}
      </div>
    </MobilityThemeContext.Provider>
  );
};

export const useMobilityTheme = (): MobilityThemeContextType => {
  const context = useContext(MobilityThemeContext);
  if (!context) {
    throw new Error('useMobilityTheme must be used within a MobilityThemeProvider');
  }
  return context;
};
