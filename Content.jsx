import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as platform from './platform.js';
import { useAuth } from './auth.jsx';
import ImageInput from './ImageInput.jsx';

// Every heading, paragraph and picture wrapped in <T> or <Img> can be changed on the page itself
// by staff with the "content.manage" permission (and the main admin). Changes are saved in the
// database (site_content) and recorded in the audit log; "Reset" goes back to the original text.
const Ctx = createContext({ content: {}, editing: false, canEdit: false, save: async () => {}, reset: async () => {} });
export const useContent = () => useContext(Ctx);

export function ContentProvider({ children }) {
  const { user } = useAuth();
  const [content, setContent] = useState({});
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(() => { platform.loadSiteContent().then(setContent).catch(() => {}); }, []);
  useEffect(() => {
    if (!user) { setCanEdit(false); setEditing(false); return; }
    platform.myPermissions().then((p) => setCanEdit(p['content.manage'] === true)).catch(() => setCanEdit(false));
  }, [user?.id]);
  const save = useCallback(async (key, patch) => {
    await platform.saveSiteContent(key, patch);
    setContent((c) => ({ ...c, [key]: { ...(c[key] || {}), key, ...patch } }));
  }, []);
  const reset = useCallback(async (key) => {
    await platform.resetSiteContent(key);
    setContent((c) => { const n = { ...c }; delete n[key]; return n; });
  }, []);
  return (
    <Ctx.Provider value={{ content, editing: editing && canEdit, canEdit, setEditing, save, reset }}>
      {children}
      {canEdit && <EditBar editing={editing} setEditing={setEditing} />}
    </Ctx.Provider>
  );
}

function EditBar({ editing, setEditing }) {
  return (
    <div className={`edit-bar ${editing ? 'on' : ''}`} role="region" aria-label="Page editing">
      {editing && <span className="small">Click any outlined text to change it · pictures have a “Change” button · saved automatically</span>}
      <button type="button" className="btn" onClick={() => setEditing(!editing)}>{editing ? 'Done editing' : 'Edit text & images'}</button>
    </div>
  );
}

// Editable text. Children are the original text (used until someone changes it).
export function T({ k, children, as: Tag = 'span', className, style, block }) {
  const { content, editing, save, reset } = useContent();
  const original = typeof children === 'string' ? children : '';
  const value = content[k]?.text_value ?? original;
  const ref = useRef(null);
  const [state, setState] = useState('');
  if (!editing) return <Tag className={className} style={style}>{value}</Tag>;
  const commit = async () => {
    const next = (ref.current?.innerText || '').replace(/\u00a0/g, ' ').trim();
    if (next === value) return;
    setState('saving');
    try {
      if (!next || next === original) await reset(k); else await save(k, { text_value: next });
      setState('saved'); setTimeout(() => setState(''), 1200);
    } catch (e) { setState(e.message); }
  };
  return (
    <Tag
      ref={ref}
      className={`${className || ''} editable ${state === 'saving' ? 'saving' : ''} ${block ? 'block' : ''}`}
      style={{ ...style, whiteSpace: 'pre-line' }}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={`Edit text: ${k}`}
      title={content[k] ? 'Changed text — clear it all to go back to the original' : 'Click to edit'}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { ref.current.innerText = value; ref.current.blur(); }
        if (e.key === 'Enter' && !block && !e.shiftKey) { e.preventDefault(); ref.current.blur(); }
      }}
      onBlur={commit}
    >{value}</Tag>
  );
}

// Editable picture. `fallback` is what shows until an image is set (for example an original line drawing).
export function Img({ k, src = '', alt = '', className, style, fallback = null, shape = 'wide' }) {
  const { content, editing, save, reset } = useContent();
  const [open, setOpen] = useState(false);
  const url = content[k]?.image_url || src;
  const altText = content[k]?.text_value || alt;
  const shown = url ? <img src={url} alt={altText} className={className} style={style} loading="lazy" /> : fallback;
  if (!editing) return shown;
  return (
    <div className="editable-img">
      {shown || <div className="editable-empty">No picture</div>}
      <div className="editable-img-tools">
        <button type="button" className="btn" onClick={() => setOpen(true)}>Change picture</button>
        {content[k] && <button type="button" className="btn-ghost" onClick={() => reset(k)}>Reset</button>}
      </div>
      {open && (
        <div className="modal-back" role="dialog" aria-modal="true" aria-label="Change picture" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="h-m">Change picture</p>
            <p className="small muted">Paste (Ctrl+V), drop, upload or link an image you have the rights to use.</p>
            <ImageInput id={`img-${k}`} shape={shape} value={url} onChange={async (u) => { await save(k, { image_url: u }); }} />
            <div className="field"><label htmlFor={`alt-${k}`}>Description for screen readers</label>
              <input id={`alt-${k}`} defaultValue={altText} onBlur={(e) => save(k, { image_url: content[k]?.image_url || url || null, text_value: e.target.value })} /></div>
            <button type="button" className="btn" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
