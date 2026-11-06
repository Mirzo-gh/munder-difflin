// Design tokens — single source of truth. Mirrors tokens.css for non-styled consumers (Pixi).
// Any change here must also update tokens.css.

export const colors = {
  // Fork perso: Orca light palette (mirrors tokens.css :root; dark lives in CSS only)
  cream: {
    50: 0xffffff,
    100: 0xffffff,
    200: 0xf5f5f5,
    300: 0xe5e5e5
  },
  paper: {
    100: 0xfafafa,
    200: 0xf5f5f5
  },
  ink: {
    900: 0x0a0a0a,
    700: 0x525252,
    500: 0x737373,
    300: 0xd4d4d4,
    100: 0xe5e5e5
  },
  accent: {
    coral: 0xff667f,
    coralLight: 0xffedf0,
    mint: 0x00d294,
    mintLight: 0xe0faf2,
    sky: 0x00bcfe,
    skyLight: 0xe0f7ff,
    lemon: 0xfcbb00,
    lemonLight: 0xfff7e0,
    lilac: 0xa685ff,
    lilacLight: 0xf4f0ff,
    peach: 0xff8b1a,
    peachLight: 0xfff1e3
  },
  status: {
    idle: 0xa1a1a1,
    thinking: 0x00a6e0,
    working: 0xedb200,
    blocked: 0xfb2c36,
    success: 0x00c758,
    ghost: 0xa1a1a1
  },
  world: {
    grassLight: 0xd4eab0,
    grassDark: 0xb5d589,
    woodLight: 0xe5c896,
    woodDark: 0xc9a66b,
    path: 0xe8d8b0,
    wall: 0x8b6f47
  }
} as const;

export const space = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64
} as const;

export const type = {
  display: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Geeza Pro", "Noto Naskh Arabic", "Segoe UI Historic", sans-serif',
  ui: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Geeza Pro", "Noto Naskh Arabic", "Segoe UI Historic", sans-serif',
  mono: '"SF Mono", ui-monospace, SFMono-Regular, Menlo, "JetBrains Mono", Consolas, "PingFang SC", "Microsoft YaHei", "Noto Sans Mono CJK SC", "Noto Sans CJK SC", "Geeza Pro", "Noto Naskh Arabic", "Segoe UI Historic", monospace'
} as const;

export const tileSize = 32; // px — the world is built from 32×32 tiles

export type AccentColorName =
  | 'coral' | 'mint' | 'sky' | 'lemon' | 'lilac' | 'peach';

export const accentByName: Record<AccentColorName, number> = {
  coral: colors.accent.coral,
  mint:  colors.accent.mint,
  sky:   colors.accent.sky,
  lemon: colors.accent.lemon,
  lilac: colors.accent.lilac,
  peach: colors.accent.peach
};

export const accentLightByName: Record<AccentColorName, number> = {
  coral: colors.accent.coralLight,
  mint:  colors.accent.mintLight,
  sky:   colors.accent.skyLight,
  lemon: colors.accent.lemonLight,
  lilac: colors.accent.lilacLight,
  peach: colors.accent.peachLight
};

// Convert 0xRRGGBB to "#RRGGBB"
export function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0').toUpperCase();
}
