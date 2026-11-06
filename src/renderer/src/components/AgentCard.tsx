import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusDot, StatusKind } from './PixelBadge';
import { useHasTerminalDraft } from './terminalPool';
import { AgentMonogram } from './AgentMonogram';
import { AccentColorName } from '@/design/tokens';
import { AgentNameEditor } from './AgentNameEditor';

export interface AgentCardProps {
  name: string;
  accent: AccentColorName;
  status: StatusKind;
  /** This agent's pty, if it has one. Only used to notice that the USER has
   *  unsent text on its prompt — which holds the agent's queue, and otherwise
   *  looks identical to an idle agent with nothing to do. */
  ptyId?: string;
  project: string;
  action?: string;
  /** Context gauge: 0..8 segments filled (session context ÷ context limit). */
  progress?: number;
  /** Live context size (tokens) — shown in the gauge tooltip. */
  contextTokens?: number;
  /** Context-window limit (tokens) assumed for the agent's model. */
  contextLimit?: number;
  selected?: boolean;
  /** Your clone — gets a persistent accent frame + BOSS tag so it stands out.
   *  (`isGod` / the `god` agent id stay as-is internally; this is display only.) */
  isGod?: boolean;
  onClick?: () => void;
  /** Persists an inline display-name edit; identity and hive paths stay unchanged. */
  onRename?: (name: string) => Promise<{ ok: boolean; error?: string }>;
  /** Number of ledger tasks this agent is actively DOING — rendered as a blue
   *  sticky note stuck to the card. Clicking it opens the first task's detail. */
  doingCount?: number;
  onTaskNoteClick?: () => void;
  draggable?: boolean; // must sit on the <button> itself — Chromium won't start a drag on an ancestor from inside a form control
  /** Private note — rendered as the card's own row (v0.3.4) so it can never
   *  cover the context gauge. First line only; full text in the tooltip. */
  note?: string;
  /** Opens the note editor (the strip owns the editing overlay). When set, the
   *  card shows a small ✎ affordance on its note row. */
  onEditNote?: () => void;
}

const fmtK = (n: number): string => `${Math.round(n / 1000)}k`;

/**
 * v0.3.4 compact redesign: one identity row (name + status), one context line
 * (action while working, repo while idle — both in the tooltip), one note row,
 * and a slim gauge pinned to the bottom edge. Nothing overlaps anything.
 */
export function AgentCard({
  name, accent, status, ptyId, project, action, progress = 0,
  contextTokens, contextLimit, selected, isGod, onClick, onRename,
  doingCount = 0, onTaskNoteClick, draggable, note, onEditNote
}: AgentCardProps) {
  const { t } = useTranslation();
  const [hover, setHover] = useState(false);
  const typing = useHasTerminalDraft(ptyId);
  // Fork perso (Orca style): a borderless ROW, not a framed card. Selection is
  // a muted fill (identical on every agent, god included), hover a lighter one.
  // God is marked only by a quiet "boss" tag — no accent surface any more.

  // Context gauge as ONE thin grey fill (0..8 → 0..100%). It only takes a status
  // colour once the window is nearly full: amber from 6/8, red from 7/8.
  const pct = Math.min(8, Math.max(0, progress)) / 8 * 100;
  const gaugeColor = progress >= 7 ? 'var(--cth-status-blocked)'
    : progress >= 6 ? 'var(--cth-status-working)'
      : 'var(--cth-ink-500)';
  const gaugeTitle = contextTokens !== undefined && contextLimit
    ? t('agentCard.contextTitle', { used: fmtK(contextTokens), limit: fmtK(contextLimit), pct: Math.round((contextTokens / contextLimit) * 100) })
    : t('agentCard.contextGaugeTitle');

  const rowBackground = selected
    ? 'var(--cth-cream-200)'
    : (hover ? 'rgba(127, 127, 127, 0.08)' : 'transparent');

  // One context line: what it's DOING while working, WHERE it lives while idle.
  const infoLine = (status !== 'idle' && action) ? action : project;
  const noteFirstLine = (note ?? '').split('\n').find((l) => l.trim()) ?? '';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      draggable={draggable}
      // The fill is the visual answer to "which terminal is open"; this is the
      // same answer for a screen reader. Matches SidebarRow in fullscreen.
      aria-current={selected ? 'true' : undefined}
      className="cth-titlebar-nodrag"
      style={{
        width: '100%', minWidth: 0, boxSizing: 'border-box',
        display: 'flex', gap: 10, alignItems: 'flex-start',
        padding: 8, border: 'none', borderRadius: 'var(--cth-radius-md)',
        background: rowBackground, cursor: 'pointer', textAlign: 'left',
        position: 'relative',
        transition: 'background 120ms ease-out'
      }}
    >
      <AgentMonogram name={name} accent={accent} size={30} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        {/* Identity row: name (+ boss tag) · tasks chip · status dot. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, minHeight: 18 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
            {onRename ? (
              <AgentNameEditor name={name} onCommit={onRename} fontSize={13} />
            ) : (
              <span style={{
                fontFamily: 'var(--cth-font-ui)', fontSize: 13, fontWeight: 500, lineHeight: '18px',
                color: 'var(--cth-ink-900)',
                flex: 1, minWidth: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
              }}>{name}</span>
            )}
            {isGod && (
              <span style={{
                flexShrink: 0, fontSize: 10, lineHeight: '14px', padding: '0 5px',
                border: '1px solid var(--cth-ink-300)', borderRadius: 4,
                color: 'var(--cth-ink-700)'
              }}>{t('agentCard.boss')}</span>
            )}
          </span>
          {/* The ledger tasks this worker is actively DOING. Click → the first
              task's detail overlay. */}
          {doingCount > 0 && (
            <span
              role="button"
              title={doingCount === 1
                ? t('agentCard.doingTasks', { count: doingCount })
                : t('agentCard.doingTasksPlural', { count: doingCount })}
              onClick={(e) => { e.stopPropagation(); onTaskNoteClick?.(); }}
              style={{
                flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 11, lineHeight: '16px', padding: '0 6px',
                border: '1px solid var(--cth-ink-300)', borderRadius: 999,
                color: 'var(--cth-ink-700)', cursor: 'pointer'
              }}
            >✎ {doingCount}</span>
          )}
          {/* flexShrink:0 — truncation must land on the name, never on the status. */}
          <StatusDot status={typing ? 'typing' : status} />
        </div>

        {/* Context line: action while working, repo while idle. */}
        <div
          title={`${project}${action && status !== 'idle' ? ` — ${action}` : ''}`}
          style={{
            fontSize: 11.5, lineHeight: '16px',
            color: 'var(--cth-ink-700)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}
        >{infoLine}</div>

        {/* The private note row — god included. */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, minHeight: 16 }}
        >
          {noteFirstLine ? (
            <span
              title={note}
              style={{
                flex: 1, minWidth: 0, fontSize: 11.5, lineHeight: '16px',
                color: 'var(--cth-ink-500)', fontStyle: 'italic',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
              }}
            >{noteFirstLine}</span>
          ) : <span style={{ flex: 1 }} />}
          {onEditNote && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onEditNote(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onEditNote(); }
              }}
              title={note ? t('agentCard.editNote') : t('agentCard.addNote')}
              aria-label={t('agentCard.editNoteAria', { name })}
              style={{
                flexShrink: 0, width: 16, height: 16,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, lineHeight: 1, cursor: 'pointer',
                // Quiet until the row is hovered — discoverable, not noisy.
                color: hover ? 'var(--cth-ink-500)' : 'var(--cth-ink-300)'
              }}
            >✎</span>
          )}
        </div>

        {/* Context gauge — 3px, grey. */}
        <div style={{ marginTop: 2 }} title={gaugeTitle}>
          <div style={{
            height: 3, width: '100%', borderRadius: 2,
            background: 'var(--cth-ink-100)',
            overflow: 'hidden'
          }}>
            <div style={{ width: `${pct}%`, height: '100%', background: gaugeColor }} />
          </div>
        </div>
      </div>
    </div>
  );
}
