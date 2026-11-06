// Line icons, drawn on a 24×24 grid and displayed at 16px × `size`.
// Fork perso (Orca style): one stroke weight, round caps and joins, no fill,
// monochrome via `currentColor` — an icon is always the colour of the text it
// sits beside (on a primary button's inverted fill too). Shapes follow Lucide
// (ISC licence, see assets/ATTRIBUTION.md); paths are hand-written here, no
// icon dependency. Add to the library by extending `paths` below.

import { CSSProperties } from 'react';

export type IconName =
  | 'gear' | 'plus' | 'x' | 'check' | 'arrow-right' | 'pause' | 'play'
  | 'bell' | 'folder' | 'terminal' | 'code' | 'web' | 'mcp' | 'sparkle'
  | 'expand' | 'minimize' | 'clock' | 'ledger' | 'info' | 'sidebar'
  | 'image' | 'edit' | 'git';

/** A full circle of radius 10 centred on the grid (rings for clock/info/web). */
const RING = 'M22 12a10 10 0 1 1-20 0a10 10 0 0 1 20 0z';

/** One stroked path per icon (several subpaths allowed, separated by `M`). */
const paths: Record<IconName, string> = {
  gear:
    'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' +
    'M15 12a3 3 0 1 1-6 0a3 3 0 0 1 6 0z',
  plus: 'M5 12h14M12 5v14',
  x: 'M18 6L6 18M6 6l12 12',
  check: 'M20 6L9 17l-5-5',
  'arrow-right': 'M5 12h14M12 5l7 7-7 7',
  pause:
    'M7 4h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z' +
    'M15 4h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
  play: 'M6 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L7.5 3.64A1 1 0 0 0 6 4.5z',
  bell:
    'M10.27 21a2 2 0 0 0 3.46 0' +
    'M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33z',
  folder:
    'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z',
  terminal: 'M4 17l6-6-6-6M12 19h8',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  web: RING + 'M12 2a14.5 14.5 0 0 0 0 20a14.5 14.5 0 0 0 0-20M2 12h20',
  // A plug — "connect a tool to the agent", which is what an MCP server is.
  mcp: 'M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z',
  sparkle:
    'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z' +
    'M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  expand: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3',
  minimize: 'M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3',
  clock: RING + 'M12 6v6l4 2',
  // Ruled page — the trigger-history ledger.
  ledger:
    'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z' +
    'M14 2v4a2 2 0 0 0 2 2h4M8 13h8M8 17h5M8 9h2',
  info: RING + 'M12 16v-4M12 8h.01',
  // Panel outline with a left rail — the standard sidebar toggle. Deliberately
  // not `minimize`/`expand`, which sit in the same toolbar meaning fullscreen.
  sidebar: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 3v18',
  image:
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z' +
    'M11 9a2 2 0 1 1-4 0a2 2 0 0 1 4 0zM21 15l-3.09-3.09a2 2 0 0 0-2.82 0L6 21',
  // Square with a pen crossing its top-right corner.
  edit:
    'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' +
    'M18.38 2.63a1 1 0 0 1 3 3l-9.02 9.01a2 2 0 0 1-.85.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.85z',
  // Branch graph: a trunk, two commits and one branch arcing off.
  git:
    'M6 3v12' +
    'M21 6a3 3 0 1 1-6 0a3 3 0 0 1 6 0z' +
    'M9 18a3 3 0 1 1-6 0a3 3 0 0 1 6 0z' +
    'M18 9a9 9 0 0 1-9 9'
};

export interface IconProps {
  name: IconName;
  size?: number; // integer scale: 1 = 16px, 2 = 32px, ...
  style?: CSSProperties;
}

export function Icon({ name, size = 1, style }: IconProps) {
  const dim = 16 * size;
  return (
    <svg
      viewBox="0 0 24 24"
      width={dim}
      height={dim}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden
    >
      <path d={paths[name]} />
    </svg>
  );
}
