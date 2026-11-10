/**
 * Chat-style rendering of an agent's Claude Code session, shown in the sidebar's
 * Terminal tab instead of the raw xterm (which stays one click away).
 *
 * Source of truth is the session's JSONL transcript, polled incrementally over
 * `window.cth.agentConversation` (main reads only the appended bytes). The raw
 * PTY keeps running underneath: anything interactive the TUI asks for (a
 * permission prompt, a picker) is answered in the raw view — the banner below
 * points there when the agent is blocked.
 */
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Agent } from '@/store/store';
import { MarkdownPreview } from '@/markdown/MarkdownPreview';
import { foldConversation, type ConversationEntry } from '@shared/conversation';
import { Icon } from './Icon';

const POLL_MS = 900;
/** Within this many px of the bottom counts as "following" the conversation. */
const STICK_PX = 48;

export interface ConversationViewProps {
  agent: Agent;
  /** Switch the tab to the raw terminal (for prompts the TUI needs answered). */
  onShowRaw: () => void;
}

interface ConvState {
  entries: ConversationEntry[];
  path: string | null;
  offset: number;
  truncated: boolean;
  /** True once the first poll answered (so "nothing yet" is not a flash). */
  loaded: boolean;
}

const INITIAL: ConvState = { entries: [], path: null, offset: -1, truncated: false, loaded: false };

export function ConversationView({ agent, onShowRaw }: ConversationViewProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<ConvState>(INITIAL);
  const stateRef = useRef(state);
  stateRef.current = state;
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);

  // Poll the transcript. A self-rescheduling timeout, not an interval, so a slow
  // read never stacks requests.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setState(INITIAL);
    const tick = async () => {
      const cur = stateRef.current;
      try {
        const res = await window.cth.agentConversation(agent.id, cur.offset, cur.path);
        if (!alive) return;
        if (!res) {
          if (!cur.loaded) setState((s) => ({ ...s, loaded: true }));
        } else {
          setState((s) => {
            const fresh = res.reset || res.path !== s.path;
            const base = fresh ? [] : s.entries;
            return {
              entries: foldConversation(base, res.items),
              path: res.path,
              offset: res.offset,
              truncated: fresh ? res.truncated : s.truncated,
              loaded: true
            };
          });
        }
      } catch { /* main busy / window tearing down — try again next tick */ }
      if (alive) timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [agent.id]);

  // Keep the newest message in view while the user is following along.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && followRef.current) el.scrollTop = el.scrollHeight;
  }, [state.entries]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    followRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
  };

  const busy = agent.status === 'working' || agent.status === 'thinking';
  const blocked = agent.status === 'blocked';

  return (
    <div style={{
      flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--cth-paper-100)', fontFamily: 'var(--cth-font-ui)'
    }}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
          padding: '12px 12px 4px', display: 'flex', flexDirection: 'column', gap: 10
        }}
      >
        {state.truncated && (
          <div style={eventStyle}>{t('conversation.olderHidden')}</div>
        )}
        {state.loaded && state.entries.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 8, textAlign: 'center', color: 'var(--cth-ink-500)',
            fontSize: 13, padding: 16
          }}>
            <div>{state.path ? t('conversation.empty') : t('conversation.noTranscript')}</div>
            <button type="button" onClick={onShowRaw} style={linkButton}>{t('conversation.showRaw')}</button>
          </div>
        )}
        {state.entries.map((e) => (
          <EntryView key={e.id} entry={e} accent={agent.accent} cwd={agent.worktreePath ?? agent.cwd} />
        ))}
        {busy && state.entries.length > 0 && (
          <div style={{ ...eventStyle, textAlign: 'left' }}>
            {t('conversation.working')}
          </div>
        )}
      </div>
      {blocked && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
          background: 'var(--cth-lemon-light)', boxShadow: 'inset 0 1px 0 var(--cth-ink-900)',
          fontSize: 12, color: 'var(--cth-ink-900)', flexShrink: 0
        }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            {agent.blockReason?.summary ?? t('conversation.needsInput')}
          </span>
          <button type="button" onClick={onShowRaw} style={{ ...linkButton, fontWeight: 600 }}>
            {t('conversation.answerInTerminal')}
          </button>
        </div>
      )}
    </div>
  );
}

const eventStyle: React.CSSProperties = {
  alignSelf: 'stretch', textAlign: 'center', fontSize: 11, color: 'var(--cth-ink-500)',
  fontFamily: 'var(--cth-font-mono)'
};

const linkButton: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  color: 'var(--cth-ink-900)', textDecoration: 'underline', fontSize: 12,
  fontFamily: 'var(--cth-font-ui)'
};

const EntryView = memo(function EntryView({ entry, accent, cwd }: {
  entry: ConversationEntry; accent: Agent['accent']; cwd?: string;
}) {
  const { t } = useTranslation();
  switch (entry.kind) {
    case 'user':
      return (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{
            maxWidth: '85%', padding: '8px 12px', borderRadius: 12,
            background: `var(--cth-${accent}-light)`, boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
            color: 'var(--cth-ink-900)', fontSize: 13, lineHeight: '19px',
            whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'
          }}>
            {entry.text}
            {entry.images ? (
              <div style={{ marginTop: entry.text ? 4 : 0, fontSize: 11, color: 'var(--cth-ink-500)' }}>
                {t('conversation.images', { count: entry.images })}
              </div>
            ) : null}
          </div>
        </div>
      );
    case 'assistant':
      return (
        <div style={{ color: 'var(--cth-ink-900)', fontSize: 13, lineHeight: '20px', overflowWrap: 'anywhere', minWidth: 0 }}>
          <MarkdownPreview source={entry.text} variant="card" root={cwd} />
        </div>
      );
    case 'thinking':
      return (
        <Collapsible label={t('conversation.thinking')} muted>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--cth-ink-500)', fontStyle: 'italic' }}>
            {entry.text}
          </div>
        </Collapsible>
      );
    case 'tool': {
      const pending = entry.result === undefined;
      return (
        <Collapsible
          label={
            <>
              <span style={{ fontWeight: 600 }}>{entry.name}</span>
              {entry.summary && (
                <span style={{
                  color: 'var(--cth-ink-500)', overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', minWidth: 0
                }}> {entry.summary}</span>
              )}
              <span style={{ marginLeft: 'auto', flexShrink: 0, color: entry.isError ? 'var(--cth-danger)' : 'var(--cth-ink-500)' }}>
                {pending ? '…' : entry.isError ? '✕' : '✓'}
              </span>
            </>
          }
          boxed
        >
          {entry.input && <pre style={preStyle}>{entry.input}</pre>}
          {entry.result !== undefined && entry.result !== '' && (
            <pre style={{ ...preStyle, color: entry.isError ? 'var(--cth-danger)' : 'var(--cth-ink-700)' }}>
              {entry.result}
            </pre>
          )}
        </Collapsible>
      );
    }
    case 'event':
      return <div style={eventStyle}>— {entry.text} —</div>;
  }
});

const preStyle: React.CSSProperties = {
  margin: '6px 0 0', padding: 8, maxHeight: 280, overflow: 'auto',
  background: 'var(--cth-cream-100)', borderRadius: 6,
  fontFamily: 'var(--cth-font-mono)', fontSize: 11, lineHeight: '16px',
  whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--cth-ink-700)'
};

function Collapsible({ label, children, boxed, muted }: {
  label: React.ReactNode; children: React.ReactNode; boxed?: boolean; muted?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={boxed ? {
      borderRadius: 8, boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
      background: 'var(--cth-cream-50)', padding: '5px 8px', minWidth: 0
    } : { minWidth: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%', minWidth: 0,
          background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
          fontFamily: 'var(--cth-font-mono)', fontSize: 11,
          color: muted ? 'var(--cth-ink-500)' : 'var(--cth-ink-900)'
        }}
      >
        <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }}>▸</span>
        {label}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

/** Two-way switch shown above the Terminal tab body. */
export function TerminalModeSwitch({ mode, onChange }: {
  mode: 'conversation' | 'raw'; onChange: (m: 'conversation' | 'raw') => void;
}) {
  const { t } = useTranslation();
  const opt = (m: 'conversation' | 'raw', label: string) => (
    <button
      type="button"
      onClick={() => onChange(m)}
      aria-pressed={mode === m}
      style={{
        border: 'none', cursor: 'pointer', padding: '3px 10px', borderRadius: 6,
        fontFamily: 'var(--cth-font-ui)', fontSize: 11,
        background: mode === m ? 'var(--cth-paper-100)' : 'transparent',
        boxShadow: mode === m ? 'inset 0 0 0 1px var(--cth-ink-900)' : 'none',
        color: mode === m ? 'var(--cth-ink-900)' : 'var(--cth-ink-500)'
      }}
    >{label}</button>
  );
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
      background: 'var(--cth-cream-100)', boxShadow: 'inset 0 -1px 0 var(--cth-ink-300)', flexShrink: 0
    }}>
      <Icon name="terminal" />
      {opt('conversation', t('conversation.modeConversation'))}
      {opt('raw', t('conversation.modeRaw'))}
    </div>
  );
}
