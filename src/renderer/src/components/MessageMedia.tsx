/**
 * Media in Conversation-view messages (Claude Code desktop style):
 * - thumbnails for the images you attached, with a click-to-enlarge viewer;
 * - file chips for the other attachments (click → show in folder);
 * - a clickable preview card for each Claude artifact an agent links to.
 * Parsing lives in @shared/messageMedia.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { artifactHost, baseName, dirName, findArtifactLinks, type ArtifactLink, type AttachedFile } from '@shared/messageMedia';
import { useWorkspaceImage } from '@/hooks/useWorkspaceImage';
import { Icon } from './Icon';

const THUMB_H = 96;
const THUMB_MAX_W = 160;

/** A full-window look at one image. Click anywhere or Esc to close. */
function ImageViewer({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return createPortal(
    <div
      role="dialog"
      aria-label={name}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, cursor: 'zoom-out',
        background: 'rgba(0,0,0,0.72)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24
      }}
    >
      <img
        src={url}
        alt={name}
        style={{ maxWidth: '100%', maxHeight: 'calc(100% - 32px)', objectFit: 'contain', borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
      />
      <div style={{ color: '#fff', fontSize: 12, fontFamily: 'var(--cth-font-mono)', opacity: 0.85 }}>{name}</div>
    </div>,
    document.body
  );
}

const thumbBox: React.CSSProperties = {
  height: THUMB_H, minWidth: 56, maxWidth: THUMB_MAX_W, borderRadius: 8, overflow: 'hidden',
  boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)', background: 'var(--cth-cream-200)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: 0, border: 'none', cursor: 'zoom-in', flexShrink: 0
};

/** One thumbnail from an image URL already in memory (data: / blob:). */
function Thumb({ url, name }: { url: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" title={name} onClick={() => setOpen(true)} style={thumbBox} className="cth-msg-thumb">
        <img src={url} alt={name} draggable={false} style={{ height: THUMB_H, maxWidth: THUMB_MAX_W, objectFit: 'cover', display: 'block' }} />
      </button>
      {open && <ImageViewer url={url} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

/** A thumbnail for an image attached by path: bytes come over IPC (the
 *  renderer cannot load file:// URLs). A file that is gone shows as a chip. */
function PathThumb({ file }: { file: AttachedFile }) {
  const img = useWorkspaceImage(dirName(file.path), baseName(file.path));
  if (img.status === 'ready') return <Thumb url={img.url} name={file.name} />;
  if (img.status === 'loading') {
    return <span aria-busy style={{ ...thumbBox, width: THUMB_H, cursor: 'default' }} />;
  }
  return <FileChip file={file} missing />;
}

function FileChip({ file, missing }: { file: AttachedFile; missing?: boolean }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      title={missing ? t('conversation.media.missing', { path: file.path }) : file.path}
      onClick={() => { void window.cth.revealPath(file.path); }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%',
        padding: '4px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: 'var(--cth-paper-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
        color: missing ? 'var(--cth-ink-500)' : 'var(--cth-ink-900)',
        fontFamily: 'var(--cth-font-mono)', fontSize: 12, lineHeight: '16px'
      }}
    >
      <Icon name={file.image ? 'image' : 'folder'} />
      <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 200 }}>{file.name}</span>
    </button>
  );
}

/** What you attached to a message: image thumbnails first, then file chips. */
export function MessageAttachments({ files, imageUrls, align = 'end' }: {
  files?: AttachedFile[]; imageUrls?: string[]; align?: 'start' | 'end';
}) {
  const { t } = useTranslation();
  const images = (files ?? []).filter((f) => f.image);
  const others = (files ?? []).filter((f) => !f.image);
  if (!images.length && !others.length && !imageUrls?.length) return null;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      alignItems: align === 'end' ? 'flex-end' : 'flex-start', maxWidth: '100%'
    }}>
      {(images.length > 0 || !!imageUrls?.length) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: align === 'end' ? 'flex-end' : 'flex-start' }}>
          {imageUrls?.map((u, i) => <Thumb key={`inline-${i}`} url={u} name={t('conversation.media.image', { n: i + 1 })} />)}
          {images.map((f) => <PathThumb key={f.path} file={f} />)}
        </div>
      )}
      {others.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: align === 'end' ? 'flex-end' : 'flex-start' }}>
          {others.map((f) => <FileChip key={f.path} file={f} />)}
        </div>
      )}
    </div>
  );
}

/** A thumbnail for an attachment still in the composer (before sending). */
export function ComposerThumb({ path, name }: { path: string; name: string }) {
  const img = useWorkspaceImage(dirName(path), baseName(path));
  if (img.status !== 'ready') return <Icon name="image" />;
  return (
    <img
      src={img.url}
      alt={name}
      draggable={false}
      style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4, display: 'block', flexShrink: 0 }}
    />
  );
}

function ArtifactCard({ link }: { link: ArtifactLink }) {
  const { t } = useTranslation();
  const open = () => { void window.cth.openExternal(link.url); };
  return (
    <button
      type="button"
      onClick={open}
      title={link.url}
      className="cth-artifact-card"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 360,
        padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'start',
        background: 'var(--cth-paper-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
        color: 'var(--cth-ink-900)', fontFamily: 'var(--cth-font-ui)'
      }}
    >
      <span aria-hidden style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--cth-cream-200)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-100)',
        color: 'var(--cth-ink-700)'
      }}>
        <Icon name="code" size={1} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span style={{ fontWeight: 600, fontSize: '0.95em', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {link.title ?? t('conversation.media.artifact')}
        </span>
        <span style={{ fontSize: '0.8em', color: 'var(--cth-ink-500)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {t('conversation.media.artifactKind')} · {artifactHost(link.url)}
        </span>
      </span>
      <span style={{ fontSize: '0.8em', color: 'var(--cth-ink-700)', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {t('conversation.media.open')} ↗
      </span>
    </button>
  );
}

/** One card per Claude artifact linked in an agent's reply. */
export function ArtifactCards({ text }: { text: string }) {
  const links = findArtifactLinks(text);
  if (!links.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
      {links.map((l) => <ArtifactCard key={l.url} link={l} />)}
    </div>
  );
}
