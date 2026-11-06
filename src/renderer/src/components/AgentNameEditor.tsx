import { useEffect, useRef, useState } from 'react';
import { isComposingKey } from '@shared/imeGuard';

export interface AgentNameEditorProps {
  name: string;
  onCommit: (name: string) => Promise<{ ok: boolean; error?: string }>;
  /** Cards render names in their established all-caps display style. */
  uppercase?: boolean;
  fontSize?: number | string;
}

/** Inline display-name editor shared by the floor card and agent detail header. */
export function AgentNameEditor({
  name,
  onCommit,
  uppercase = false,
  fontSize = 13
}: AgentNameEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string>();
  const committing = useRef(false);
  const cancelling = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [editing, name]);

  const beginEditing = () => {
    setDraft(name);
    setError(undefined);
    setEditing(true);
  };

  const commit = async () => {
    if (committing.current || cancelling.current) return;
    const nextName = draft.trim();
    if (!nextName) {
      setError('Name is required');
      return;
    }
    if (nextName === name) {
      setEditing(false);
      return;
    }

    committing.current = true;
    setError(undefined);
    try {
      const result = await onCommit(nextName);
      if (result.ok) setEditing(false);
      else setError(result.error ?? 'Could not rename agent');
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : 'Could not rename agent');
    } finally {
      committing.current = false;
    }
  };

  if (editing) {
    return (
      <input
        autoFocus
        draggable={false}
        value={draft}
        aria-label={`Rename ${name}`}
        title={error}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onBlur={() => { void commit(); }}
        onKeyDown={(event) => {
          event.stopPropagation();
          // Still stop propagation for a composition key: it belongs to this
          // input's IME, not to a global hotkey.
          if (isComposingKey(event)) return;
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit();
          } else if (event.key === 'Escape') {
            cancelling.current = true;
            setEditing(false);
            queueMicrotask(() => { cancelling.current = false; });
          }
        }}
        style={{
          width: '100%', minWidth: 0, height: 22, padding: '1px 6px', boxSizing: 'border-box',
          outline: 'none',
          background: 'var(--cth-cream-300)',
          border: `1px solid var(--cth-${error ? 'status-blocked' : 'ink-300'})`,
          borderRadius: 'var(--cth-radius-sm)',
          fontFamily: 'var(--cth-font-ui)', fontSize, fontWeight: 500,
          color: 'var(--cth-ink-900)', textTransform: uppercase ? 'uppercase' : undefined
        }}
      />
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, minWidth: 0, flex: 1 }}>
      <span
        onDoubleClick={(event) => { event.stopPropagation(); beginEditing(); }}
        title={`${name} — double-click to rename`}
        style={{
          fontFamily: 'var(--cth-font-ui)', fontSize, fontWeight: 500, lineHeight: '18px',
          color: 'var(--cth-ink-900)',
          minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}
      >{uppercase ? name.toUpperCase() : name}</span>
      <button
        type="button"
        draggable={false}
        aria-label={`Rename ${name}`}
        title={`Rename ${name}`}
        onClick={(event) => { event.stopPropagation(); beginEditing(); }}
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          flexShrink: 0, width: 14, height: 14, padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', background: 'transparent', cursor: 'text',
          color: 'var(--cth-ink-500)', fontFamily: 'var(--cth-font-ui)', fontSize: 11, lineHeight: 1
        }}
      >✎</button>
    </span>
  );
}
