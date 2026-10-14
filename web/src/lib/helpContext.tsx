import React from 'react';
import { formatDynamic, type DynamicContext } from './dynamicHelp';

export type HelpLevel = 'brief' | 'detailed';

const STORAGE_KEY = 'changeover.helpLevel.v1';

interface HelpContextValue {
  level: HelpLevel;
  setLevel: (l: HelpLevel) => void;
  dynamic: DynamicContext;
  setDynamic: (next: DynamicContext) => void;
}

const HelpContext = React.createContext<HelpContextValue | null>(null);

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [level, setLevelState] = React.useState<HelpLevel>(() => {
    if (typeof window === 'undefined') return 'brief';
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === 'detailed' ? 'detailed' : 'brief';
  });

  const [dynamic, setDynamic] = React.useState<DynamicContext>({});

  const setLevel = React.useCallback((l: HelpLevel) => {
    setLevelState(l);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, l);
    }
  }, []);

  const value = React.useMemo(
    () => ({ level, setLevel, dynamic, setDynamic }),
    [level, setLevel, dynamic]
  );

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

export function useHelpLevel(): HelpLevel {
  const ctx = React.useContext(HelpContext);
  if (!ctx) throw new Error('useHelpLevel must be used within HelpProvider');
  return ctx.level;
}

export function useHelpToggle(): HelpContextValue {
  const ctx = React.useContext(HelpContext);
  if (!ctx) throw new Error('useHelpToggle must be used within HelpProvider');
  return ctx;
}

export function useDynamicHelp(): (key: string) => string | null {
  const ctx = React.useContext(HelpContext);
  if (!ctx) throw new Error('useDynamicHelp must be used within HelpProvider');
  return React.useCallback(
    (key: string) => formatDynamic(key, ctx.dynamic),
    [ctx.dynamic]
  );
}
