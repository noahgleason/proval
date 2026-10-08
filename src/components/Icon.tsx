import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { ReactionId } from '../types';
import { colors } from '../theme';

/**
 * One stroke-based icon set (24px grid, round caps) so every glyph in the app
 * shares the same weight and corner language. No emoji anywhere.
 */
const ICONS = {
  cards: (
    <>
      <Path d="M8.5 3.5h9a2.5 2.5 0 0 1 2.5 2.5v11" />
      <Rect x={4} y={7} width={12} height={14} rx={2.5} />
    </>
  ),
  send: (
    <>
      <Path d="M12 15V4" />
      <Path d="M7.5 8.5 12 4l4.5 4.5" />
      <Path d="M5 14v3.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V14" />
    </>
  ),
  list: (
    <>
      <Path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <Path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" strokeWidth={2.6} />
    </>
  ),
  grid: (
    <>
      <Rect x={4} y={4} width={7} height={7} rx={1.8} />
      <Rect x={13} y={4} width={7} height={7} rx={1.8} />
      <Rect x={4} y={13} width={7} height={7} rx={1.8} />
      <Rect x={13} y={13} width={7} height={7} rx={1.8} />
    </>
  ),
  rows: (
    <>
      <Rect x={4} y={4.5} width={16} height={6} rx={1.8} />
      <Rect x={4} y={13.5} width={16} height={6} rx={1.8} />
    </>
  ),
  check: <Path d="M5 12.5 9.5 17 19 7.5" />,
  x: <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  image: (
    <>
      <Rect x={3} y={4} width={18} height={16} rx={2.5} />
      <Circle cx={9} cy={10} r={1.6} />
      <Path d="m21 15.5-4.5-4.5L7 20.5" />
    </>
  ),
  clock: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 7.5V12l3 2" />
    </>
  ),
  undo: (
    <>
      <Path d="M9 13.5 4.5 9 9 4.5" />
      <Path d="M4.5 9H14a5.5 5.5 0 0 1 0 11h-3" />
    </>
  ),
  refresh: (
    <>
      <Path d="M19.5 11a7.5 7.5 0 1 0-2.2 5.5" />
      <Path d="M20 4.5V11h-6.5" />
    </>
  ),
  inbox: (
    <>
      <Path d="M3.5 13.5h4.5l1.5 2.5h5l1.5-2.5h4.5" />
      <Path d="M6 5h12l2.5 8.5V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-4.5z" />
    </>
  ),
  eye: (
    <>
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <Circle cx={12} cy={12} r={3} />
    </>
  ),
  users: (
    <>
      <Circle cx={9} cy={8.5} r={3.5} />
      <Path d="M3 19.5a6 6 0 0 1 12 0" />
      <Path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.2a6 6 0 0 1 3.5 5.3" />
    </>
  ),
  userPlus: (
    <>
      <Circle cx={10} cy={8.5} r={3.5} />
      <Path d="M4 19.5a6 6 0 0 1 12 0" />
      <Path d="M19 8v6M16 11h6" />
    </>
  ),
  search: (
    <>
      <Circle cx={11} cy={11} r={6.5} />
      <Path d="m16 16 4 4" />
    </>
  ),
  bubble: <Path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4 19.5l1.4-4.4A7.5 7.5 0 1 1 20 11.5z" />,
  share: (
    <>
      <Path d="M21 3.5 10 14" />
      <Path d="M21 3.5 14.5 20.5 10 14 3.5 9.5z" />
    </>
  ),
  bookmark: <Path d="M6.5 4h11v16.5L12 16.5l-5.5 4z" />,
  dots: <Path d="M5.5 12h.01M12 12h.01M18.5 12h.01" strokeWidth={3} />,
  // Reactions
  heart: <Path d="M12 19.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10z" />,
  alert: (
    <>
      <Path d="M10.3 4.6 3.2 17a2 2 0 0 0 1.7 3h14.2a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0z" />
      <Path d="M12 10v3.5M12 16.8h.01" />
    </>
  ),
  swap: (
    <>
      <Path d="M5 8h13l-3.5-3.5" />
      <Path d="M19 16H6l3.5 3.5" />
    </>
  ),
  sliders: (
    <>
      <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <Circle cx={15} cy={7} r={2} />
      <Circle cx={9} cy={17} r={2} />
    </>
  ),
  crop: (
    <>
      <Path d="M7 3v12.5A1.5 1.5 0 0 0 8.5 17H21" />
      <Path d="M3 7h12.5A1.5 1.5 0 0 1 17 8.5V21" />
    </>
  ),
  trash: (
    <>
      <Path d="M4 7h16M9.5 3.5h5" />
      <Path d="M6 7l.9 11.6A2 2 0 0 0 8.9 20.5h6.2a2 2 0 0 0 2-1.9L18 7" />
    </>
  ),
};

export type IconName = keyof typeof ICONS;

export const REACTION_ICON: Record<ReactionId, IconName> = {
  obsessed: 'heart',
  last_resort: 'alert',
  better_one: 'swap',
  edit_first: 'sliders',
  crop_me: 'crop',
  delete_it: 'trash',
};

type Props = { name: IconName; size?: number; color?: string; weight?: number };

export function Icon({ name, size = 22, color = colors.ink, weight = 1.8 }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name]}
    </Svg>
  );
}

/** Brand mark: a frame with its corner folded into a check — "cleared to post". */
export function LogoMark({ size = 28, color = colors.ink, accent = colors.brand }: { size?: number; color?: string; accent?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M24 4H9a5 5 0 0 0-5 5v14a5 5 0 0 0 5 5h14a5 5 0 0 0 5-5V12" stroke={color} strokeWidth={3} strokeLinecap="round" />
      <Path d="M11 15.5l4.5 4.5L29 5.5" stroke={accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
