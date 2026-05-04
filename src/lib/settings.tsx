'use client';
import { createContext, useContext, useState, useEffect } from 'react';

interface Settings {
  accent: 'violet' | 'emerald' | 'amber' | 'sky';
  density: 'compact' | 'cozy' | 'comfortable';
  privacy: boolean;
}

interface SettingsCtx {
  settings: Settings;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

const ACCENTS: Record<string, string> = {
  violet:  '#a78bfa',
  emerald: '#5fd39a',
  amber:   '#f5b754',
  sky:     '#6ec1f0',
};

const defaults: Settings = { accent: 'violet', density: 'cozy', privacy: false };

const Ctx = createContext<SettingsCtx>({ settings: defaults, update: () => {} });

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaults);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('lifeos-settings');
      if (raw) setSettings(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    const hex = ACCENTS[settings.accent] ?? ACCENTS.violet;
    document.documentElement.style.setProperty('--accent', hex);
    document.documentElement.style.setProperty('--accent-soft', hex + '1f');
    document.body.dataset.density = settings.density;
    document.body.dataset.privacy = settings.privacy ? 'on' : 'off';
  }, [settings]);

  const update: SettingsCtx['update'] = (key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('lifeos-settings', JSON.stringify(next));
      return next;
    });
  };

  return <Ctx.Provider value={{ settings, update }}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);
