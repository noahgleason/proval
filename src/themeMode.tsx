import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { applyScheme, resolveScheme, saveMode, savedMode, type Scheme, type ThemeMode } from './theme';

type ThemeState = {
  /** What you picked. */
  mode: ThemeMode;
  /** What's showing right now. */
  scheme: Scheme;
  setMode(mode: ThemeMode): void;
};

const ThemeContext = createContext<ThemeState>({ mode: 'system', scheme: 'light', setMode: () => {} });

export const useThemeMode = () => useContext(ThemeContext);

/** Light, dark, or following the device; remembered on this device. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme(); // updates live when the device switches
  const [mode, setModeState] = useState<ThemeMode>(savedMode);
  const scheme = resolveScheme(mode, system);

  useLayoutEffect(() => applyScheme(scheme), [scheme]);

  const value = useMemo(
    () => ({
      mode,
      scheme,
      setMode: (m: ThemeMode) => {
        saveMode(m);
        setModeState(m);
      },
    }),
    [mode, scheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Phones pick colors when the app starts, so a change there shows after reopening it. */
export const themeChangeNeedsRestart = Platform.OS !== 'web';
