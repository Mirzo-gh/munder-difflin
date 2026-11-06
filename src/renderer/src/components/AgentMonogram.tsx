import type { AccentColorName } from '@/design/tokens';
import { monogramLetters } from './monogram';

export interface AgentMonogramProps {
  name: string;
  accent: AccentColorName;
  /** Side of the square, in px. */
  size?: number;
}

/** Dark square with the agent's two-letter monogram, tinted with its accent. */
export function AgentMonogram({ name, accent, size = 30 }: AgentMonogramProps) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Math.round(size * 0.23),
        background: 'var(--cth-monogram-bg)',
        color: `var(--cth-${accent})`,
        fontFamily: 'var(--cth-font-mono)',
        fontWeight: 600,
        fontSize: Math.round(size * 0.4),
        lineHeight: 1,
        userSelect: 'none'
      }}
    >
      {monogramLetters(name)}
    </div>
  );
}
