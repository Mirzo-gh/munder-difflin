import { useEffect, useRef, useState } from 'react';

export interface SidebarSplitterProps {
  /** Current width of the agent column (left side), in px. */
  width: number;
  /** Called with the new width, clamped to [min, max]. */
  onChange: (px: number) => void;
  /** Containing viewport width — keeps room for the terminal on the right. */
  viewportWidth: number;
  min?: number;
  max?: number;
  /** Width restored on double-click. */
  defaultWidth?: number;
}

/**
 * Vertical drag handle between the agent column (left) and the terminal
 * (right). Drag right → wider column. Cursor + pixel-stripe affordance.
 */
export function SidebarSplitter({
  width, onChange, viewportWidth, min = 200, max = 420, defaultWidth = 260
}: SidebarSplitterProps) {
  const startRef = useRef<{ clientX: number; width: number } | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!startRef.current) return;
      // The column sits on the inline-start side: in an RTL document the row is
      // mirrored, so a LEFT drag grows it there.
      const rtl = document.documentElement.dir === 'rtl';
      const dx = e.clientX - startRef.current.clientX;
      const delta = rtl ? -dx : dx; // drag away from the column = grow it
      const clampMax = Math.min(max, Math.max(min, viewportWidth - 360));
      const next = Math.min(clampMax, Math.max(min, startRef.current.width + delta));
      onChange(next);
    };
    const onUp = () => {
      startRef.current = null;
      setActive(false);
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    if (active) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'ew-resize';
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [active, viewportWidth, min, max, onChange]);

  return (
    <div
      onMouseDown={(e) => {
        startRef.current = { clientX: e.clientX, width };
        setActive(true);
        e.preventDefault();
      }}
      onDoubleClick={() => onChange(defaultWidth)}
      title="Drag to resize · double-click to reset"
      style={{
        width: 10,
        cursor: 'ew-resize',
        flexShrink: 0,
        position: 'relative',
        background: active ? 'var(--cth-cream-300)' : 'transparent'
      }}
    >
      {/* The visible 2px stripe with hash marks in the middle */}
      <div style={{
        position: 'absolute',
        top: 0, bottom: 0, left: 4,
        width: 2,
        background: active ? 'var(--cth-ink-900)' : 'var(--cth-ink-300)'
      }} />
      <div style={{
        position: 'absolute',
        top: '50%', left: 2, transform: 'translateY(-50%)',
        width: 6, height: 24,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
      }}>
        <span style={{ height: 2, background: 'var(--cth-ink-900)' }} />
        <span style={{ height: 2, background: 'var(--cth-ink-900)' }} />
        <span style={{ height: 2, background: 'var(--cth-ink-900)' }} />
      </div>
    </div>
  );
}
