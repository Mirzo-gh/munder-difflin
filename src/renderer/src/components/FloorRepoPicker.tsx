import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelPanel } from './PixelPanel';
import { PixelButton } from './PixelButton';
import { Icon } from './Icon';

interface FloorRepo {
  repoRoot: string;
  agentCount: number;
  open: boolean;
}

// Same one-shot flag HivePicker sets before its relaunch: binding a floor
// reloads this window, and choosing a repo already means "work in the current
// hive", so the reload must not land on the hive picker. Cleared if no reload
// follows. App.tsx reads + clears it on mount.
const SKIP_HIVE_PICKER_KEY = 'cth.skipHivePickerOnce';

function folderName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/**
 * FloorRepoPicker — shown by a window that is not bound to a repo yet (a new
 * window, or the first launch after per-repo floors). One window = one repo:
 * picking one binds THIS window and main reloads it onto that repo's floor. If
 * the repo is already open elsewhere, main focuses that window instead.
 */
export function FloorRepoPicker() {
  const { t } = useTranslation();
  const [repos, setRepos] = useState<FloorRepo[] | null>(null);
  const [busy, setBusy] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    window.cth.listFloorRepos()
      .then((list) => { if (!cancelled) setRepos(list); })
      .catch(() => { if (!cancelled) setRepos([]); });
    return () => { cancelled = true; };
  }, []);

  const choose = async (path: string) => {
    if (!path || busy) return;
    setNotice(undefined);
    setBusy(path);
    const undo = (message?: string) => {
      try { window.localStorage.removeItem(SKIP_HIVE_PICKER_KEY); } catch { /* noop */ }
      setNotice(message);
      setBusy(undefined);
    };
    try {
      try { window.localStorage.setItem(SKIP_HIVE_PICKER_KEY, '1'); } catch { /* noop */ }
      const res = await window.cth.chooseFloorRepo(path);
      // Success reloads the window; a return means it did not happen.
      if (!res.ok) undo(res.focused ? t('floor.alreadyOpen') : res.error);
    } catch (e) {
      undo(e instanceof Error ? e.message : String(e));
    }
  };

  const browse = async () => {
    setNotice(undefined);
    try {
      const res = await window.cth.chooseFolder();
      if (res.ok) void choose(res.path);
      else if (res.error !== 'cancelled') setNotice(res.error);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--cth-cream-200)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 32
    }}>
      <div style={{ width: 560, maxWidth: '94vw' }}>
        <PixelPanel variant="dialog" title={t('floor.pickTitle')} noPadding>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 12, lineHeight: '19px', color: 'var(--cth-ink-700)' }}>
              {t('floor.pickHint')}
            </p>

            {repos && repos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                {repos.map((r) => (
                  <button
                    key={r.repoRoot}
                    onClick={() => void choose(r.repoRoot)}
                    disabled={!!busy}
                    title={r.repoRoot}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      background: 'var(--cth-paper-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
                      border: 'none', cursor: busy ? 'default' : 'pointer', textAlign: 'left',
                      opacity: busy && busy !== r.repoRoot ? 0.5 : 1
                    }}
                  >
                    <Icon name="folder" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--cth-font-ui)', fontSize: 12, fontWeight: 600, color: 'var(--cth-ink-900)' }}>
                        {folderName(r.repoRoot)}
                      </div>
                      <div style={{
                        fontFamily: 'var(--cth-font-mono)', fontSize: 11, color: 'var(--cth-ink-500)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'rtl', textAlign: 'left'
                      }}>
                        {/* rtl keeps the END of a long path visible when it is
                            truncated; <bdi> keeps the path itself left-to-right
                            so its leading "/" stays in front. */}
                        <bdi>{r.repoRoot}</bdi>
                      </div>
                    </div>
                    {r.open && (
                      <span style={{
                        fontSize: 11, padding: '1px 6px', flexShrink: 0,
                        color: 'var(--cth-ink-900)', background: 'var(--cth-mint-light)',
                        boxShadow: 'inset 0 0 0 1px var(--cth-mint)'
                      }}>{t('floor.openBadge')}</span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--cth-ink-500)', flexShrink: 0 }}>
                      {t('floor.agents', { count: r.agentCount })}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {notice && (
              <p role="status" style={{ margin: 0, fontSize: 12, color: 'var(--cth-ink-700)' }}>
                {notice}
              </p>
            )}

            <div>
              <PixelButton variant="secondary" size="md" onClick={() => void browse()} disabled={!!busy}>
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <Icon name="folder" /> {t('floor.chooseFolder')}
                </span>
              </PixelButton>
            </div>
          </div>
        </PixelPanel>
      </div>
    </div>
  );
}
