/**
 * The "+" menu of the Conversation view's input (Claude Code desktop style):
 * attach files, insert a slash command, or mention a floor agent.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COMMAND_GROUPS } from '@shared/claudeCommands';
import { useStore, type Agent } from '@/store/store';
import { Icon } from './Icon';
import { PixelBadge } from './PixelBadge';

type View = 'root' | 'commands' | 'agents';

const SLASH_COMMANDS = COMMAND_GROUPS.flatMap((g) => g.items.filter((c) => c.kind === 'slash'))
  .filter((c, i, all) => all.findIndex((d) => d.cmd === c.cmd) === i);
const EMPTY_AGENTS: Agent[] = [];

export function ChatPlusMenu({ selfId, onFiles, onInsert }: {
  selfId: string;
  onFiles: () => void;
  /** Insert text into the draft (the composer decides where and focuses it). */
  onInsert: (text: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('root');
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const agents = useStore((s) => s.agents) ?? EMPTY_AGENTS;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (view !== 'root') { setView('root'); setQuery(''); } else setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey, true); };
  }, [open, view]);

  const toggle = () => { setOpen((o) => !o); setView('root'); setQuery(''); };
  const pick = (fn: () => void) => { setOpen(false); setView('root'); setQuery(''); fn(); };

  const q = query.trim().toLowerCase();
  const commands = useMemo(
    () => SLASH_COMMANDS.filter((c) => !q || c.cmd.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)),
    [q]
  );
  const mentionable = agents.filter((a) => a.id !== selfId && !a.archived && (!q || a.name.toLowerCase().includes(q)));

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={toggle}
        title={t('conversation.plusMenu')}
        aria-label={t('conversation.plusMenu')}
        aria-haspopup="menu"
        aria-expanded={open}
        className="cth-chat-iconbtn"
        style={{
          width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: open ? 'var(--cth-cream-200)' : 'transparent', color: 'var(--cth-ink-700)'
        }}
      >
        <Icon name="plus" />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 20,
            width: view === 'root' ? 240 : 320, maxHeight: 360, display: 'flex', flexDirection: 'column',
            background: 'var(--cth-paper-100)', borderRadius: 10, overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18), inset 0 0 0 1px var(--cth-ink-300)',
            fontFamily: 'var(--cth-font-ui)', fontSize: 13, color: 'var(--cth-ink-900)'
          }}
        >
          {view === 'root' ? (
            <div style={{ padding: 4, display: 'flex', flexDirection: 'column' }}>
              <MenuItem glyph={<Icon name="folder" />} label={t('conversation.plusFiles')} onClick={() => pick(onFiles)} />
              <MenuItem glyph="/" label={t('conversation.plusCommands')} chevron onClick={() => setView('commands')} />
              <MenuItem glyph="@" label={t('conversation.plusMention')} chevron onClick={() => setView('agents')} />
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', boxShadow: 'inset 0 -1px 0 var(--cth-ink-100)' }}>
                <button
                  type="button"
                  onClick={() => { setView('root'); setQuery(''); }}
                  aria-label={t('conversation.plusBack')}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 4px', color: 'var(--cth-ink-500)', fontSize: 14 }}
                >‹</button>
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    if (view === 'commands' && commands[0]) pick(() => onInsert(`${commands[0].cmd} `));
                    if (view === 'agents' && mentionable[0]) pick(() => onInsert(`@${mentionable[0].name} `));
                  }}
                  placeholder={t('conversation.plusSearch')}
                  style={{
                    flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
                    fontFamily: 'var(--cth-font-ui)', fontSize: 13, color: 'var(--cth-ink-900)'
                  }}
                />
              </div>
              <div style={{ overflowY: 'auto', padding: 4, display: 'flex', flexDirection: 'column' }}>
                {view === 'commands' && commands.map((c) => (
                  <button
                    key={c.cmd}
                    type="button"
                    role="menuitem"
                    className="cth-chat-menuitem"
                    onClick={() => pick(() => onInsert(`${c.cmd} `))}
                    title={c.usage}
                    style={itemStyle}
                  >
                    <span style={{ fontFamily: 'var(--cth-font-mono)', fontWeight: 600, flexShrink: 0 }}>{c.cmd}</span>
                    <span style={{ color: 'var(--cth-ink-500)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.desc}</span>
                  </button>
                ))}
                {view === 'agents' && mentionable.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="menuitem"
                    className="cth-chat-menuitem"
                    onClick={() => pick(() => onInsert(`@${a.name} `))}
                    style={itemStyle}
                  >
                    <span aria-hidden="true" style={{
                      width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700,
                      background: `var(--cth-${a.accent})`, color: 'var(--cth-on-accent)'
                    }}>{a.name.trim().slice(0, 1).toUpperCase()}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                    <PixelBadge status={a.status} />
                  </button>
                ))}
                {((view === 'commands' && !commands.length) || (view === 'agents' && !mentionable.length)) && (
                  <div style={{ padding: '10px 8px', color: 'var(--cth-ink-500)', fontSize: 12 }}>{t('conversation.plusNothing')}</div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const itemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0,
  padding: '6px 8px', border: 'none', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
  background: 'transparent', fontFamily: 'var(--cth-font-ui)', fontSize: 13, color: 'var(--cth-ink-900)'
};

function MenuItem({ glyph, label, chevron, onClick }: {
  glyph: React.ReactNode; label: string; chevron?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" role="menuitem" className="cth-chat-menuitem" onClick={onClick} style={itemStyle}>
      <span style={{
        width: 18, display: 'inline-flex', justifyContent: 'center', flexShrink: 0,
        fontFamily: 'var(--cth-font-mono)', fontWeight: 700, color: 'var(--cth-ink-700)'
      }}>{glyph}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {chevron && <span style={{ color: 'var(--cth-ink-500)' }}>›</span>}
    </button>
  );
}
