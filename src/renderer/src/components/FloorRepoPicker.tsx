import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelPanel } from './PixelPanel';
import { PixelButton } from './PixelButton';
import { Icon } from './Icon';

interface FloorRepo {
  repoRoot: string;
  agentCount: number;
  open: boolean;
  /** The repo's linked harness; null = not linked yet (one is adopted/created). */
  harness: string | null;
}

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

  // A repo of another harness switches the whole app; with other floors open it
  // asks first (they close) — `confirm` holds that pending choice.
  const [confirm, setConfirm] = useState<{ path: string; harness: string; closes: number } | undefined>();

  const choose = async (path: string, confirmSwitch = false) => {
    if (!path || busy) return;
    setNotice(undefined);
    setConfirm(undefined);
    setBusy(path);
    try {
      const res = await window.cth.chooseFloorRepo(path, confirmSwitch ? { confirmSwitch: true } : undefined);
      // Success reloads the window (or relaunches on a harness switch).
      if (res.ok) return;
      setBusy(undefined);
      if (res.switchHarness) setConfirm({ path, harness: res.switchHarness, closes: res.closes ?? 0 });
      else setNotice(res.focused ? t('floor.alreadyOpen') : res.error);
    } catch (e) {
      setBusy(undefined);
      setNotice(e instanceof Error ? e.message : String(e));
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
                    {r.harness && (
                      <span title={r.harness} style={{ fontSize: 11, color: 'var(--cth-ink-500)', flexShrink: 0 }}>
                        {t('floor.harnessLabel', { name: folderName(r.harness) })}
                      </span>
                    )}
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

            {confirm && (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 10px',
                background: 'var(--cth-coral-light)', boxShadow: 'inset 0 0 0 1px var(--cth-coral)'
              }}>
                <span style={{ fontSize: 12, color: 'var(--cth-ink-900)' }}>
                  {t('floor.switchConfirm', { harness: folderName(confirm.harness), count: confirm.closes })}
                </span>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <PixelButton variant="ghost" size="md" onClick={() => setConfirm(undefined)}>{t('floor.switchCancel')}</PixelButton>
                  <PixelButton variant="primary" size="md" onClick={() => void choose(confirm.path, true)}>{t('floor.switchGo')}</PixelButton>
                </div>
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
