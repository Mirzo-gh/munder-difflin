import { CSSProperties, ReactNode } from 'react';
import { AccentColorName } from '@/design/tokens';

type Variant = 'default' | 'inset' | 'active' | 'terminal' | 'dialog';

export interface PixelPanelProps {
  variant?: Variant;
  title?: string;
  accent?: AccentColorName;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  noPadding?: boolean;
}

// Fork perso (Orca style): one 1px hairline, rounded corners, no stepped
// chrome. The variants only differ by fill and border strength.
const borderByVariant: Record<Variant, string> = {
  default:  'var(--cth-ink-100)',
  inset:    'var(--cth-ink-100)',
  active:   'var(--cth-ink-300)',
  terminal: 'var(--cth-ink-100)',
  dialog:   'var(--cth-ink-300)'
};

const fillByVariant: Record<Variant, string> = {
  default:  'var(--cth-cream-100)',
  inset:    'var(--cth-cream-200)',
  active:   'var(--cth-cream-100)',
  terminal: 'var(--cth-paper-100)',
  dialog:   'var(--cth-paper-100)'
};

export function PixelPanel({
  variant = 'default',
  title,
  accent,
  children,
  style,
  className,
  noPadding = false
}: PixelPanelProps) {
  const baseStyle: CSSProperties = {
    background: fillByVariant[variant],
    border: `1px solid ${variant === 'active' && accent ? `var(--cth-${accent})` : borderByVariant[variant]}`,
    borderRadius: 'var(--cth-radius-lg)',
    padding: noPadding ? 0 : 'var(--cth-space-3)',
    position: 'relative',
    boxSizing: 'border-box',
    ...style
  };

  return (
    <div className={className} style={baseStyle}>
      {title && (
        <div
          style={{
            margin: noPadding ? 0 : '-12px -12px 12px',
            padding: '10px 14px',
            color: 'var(--cth-ink-900)',
            fontFamily: 'var(--cth-font-ui)',
            fontSize: 13,
            fontWeight: 500,
            lineHeight: '18px',
            borderBottom: '1px solid var(--cth-ink-100)'
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
