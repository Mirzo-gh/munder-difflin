import { PixelPanel } from '@/components/PixelPanel';
import { useResolvedGodName } from '@/hooks/useResolvedGodName';

/**
 * Loader shown on the empty floor while the god agent is clocking in on
 * launch. Replaces the "add agent" prompt so a returning user doesn't see the
 * empty-floor call-to-action before god has booted.
 *
 * Rendered while `agentCount === 0` — before the store has god's live agent
 * object (and so before `agent.name` exists anywhere to read) — so this reads
 * the persisted name directly, the same way useHive.ts's spawn effect does,
 * rather than assuming the default.
 */
export function MichaelBooting() {
  const godName = useResolvedGodName();
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none'
    }}>
      <div style={{ pointerEvents: 'auto', width: 360 }}>
        <PixelPanel variant="dialog" title="Clocking in" noPadding>
          <div style={{
            padding: 20,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14
          }}>
            {/* Loading dots — staggered soft pulse. */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--cth-ink-500)',
                    animation: 'cth-blink 1.2s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`
                  }}
                />
              ))}
            </div>
            <p style={{
              margin: 0, fontSize: 13, lineHeight: '20px', textAlign: 'center',
              color: 'var(--cth-ink-700)'
            }}>
              {godName} is settling into the corner office and getting the floor
              ready. Hang tight…
            </p>
          </div>
        </PixelPanel>
      </div>
    </div>
  );
}
