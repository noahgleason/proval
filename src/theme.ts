import { Appearance, Platform } from 'react-native';

// Bone paper, ink, and one ultramarine signal. Approve/deny colors are the
// only other hues, so status always reads at a glance.
const light = {
  bg: '#F4F2EE',
  card: '#FFFFFF',
  ink: '#16141A',
  /** Text and icons on an ink-filled button. */
  onInk: '#FFFFFF',
  onInkMuted: 'rgba(255,255,255,0.75)',
  muted: '#86827C',
  line: '#E4E0D9',
  brand: '#3A2BF5',
  brandSoft: '#E8E6FE',
  approve: '#14995A',
  approveSoft: '#E1F3E9',
  deny: '#E0443F',
  denySoft: '#FBE6E5',
  pending: '#A8741A',
  pendingSoft: '#F6EDDB',
  scrim: 'rgba(22,20,26,0.55)',
};

// Same roles at night: warm near-black paper, ink turns light, and the signal colors are lifted
// so they still read on dark (brand keeps white text on it legible, 4:1).
const dark: typeof light = {
  bg: '#131216',
  card: '#1C1B21',
  ink: '#F2F0EC',
  onInk: '#16141A',
  onInkMuted: 'rgba(22,20,26,0.65)',
  muted: '#9A95A3',
  line: '#2E2C34',
  brand: '#7467FF',
  brandSoft: '#25224A',
  approve: '#3DBE7E',
  approveSoft: '#17301F',
  deny: '#F0645F',
  denySoft: '#3A1D1F',
  pending: '#E0A84E',
  pendingSoft: '#33281A',
  scrim: 'rgba(0,0,0,0.6)',
};

export type Scheme = 'light' | 'dark';
/** What you picked: follow the device, or always light / dark. */
export type ThemeMode = 'system' | Scheme;
type Palette = typeof light;
export const palettes: Record<Scheme, Palette> = { light, dark };

const MODE_KEY = 'proval.theme';

export function savedMode(): ThemeMode {
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (m === 'light' || m === 'dark' || m === 'system') return m;
  } catch {}
  return 'system';
}

export function saveMode(mode: ThemeMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {}
}

export function resolveScheme(mode: ThemeMode, system: string | null | undefined): Scheme {
  if (mode !== 'system') return mode;
  return system === 'dark' ? 'dark' : 'light';
}

/** Web: puts a palette's colors on the page as CSS variables, which every style below points at. */
export function applyScheme(scheme: Scheme) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(palettes[scheme])) root.style.setProperty(`--c-${k}`, v);
  root.style.colorScheme = scheme; // scrollbars and form controls follow
  root.style.backgroundColor = palettes[scheme].bg;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', palettes[scheme].bg);
}

const startScheme = resolveScheme(savedMode(), Appearance.getColorScheme());

/**
 * The colors every style uses. On the web each one is a CSS variable, so switching themes repaints
 * instantly without re-rendering. Phones pick the palette when the app starts.
 */
export const colors: Palette =
  Platform.OS === 'web'
    ? (Object.fromEntries(Object.keys(light).map((k) => [k, `var(--c-${k})`])) as Palette)
    : palettes[startScheme];

// Set the variables before anything draws, so there's no flash of the wrong theme.
applyScheme(startScheme);

/** Colors for things drawn on top of photos, which look the same in both themes. */
export const onPhoto = { pill: 'rgba(255,255,255,0.92)', ink: '#16141A' };

export const radius = { sm: 10, md: 16, lg: 26, pill: 999 };

export const type = {
  display: { fontSize: 30, fontWeight: '800', letterSpacing: -1.2 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
} as const;
