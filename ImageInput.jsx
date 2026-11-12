import { useRef, useState } from 'react';
import * as api from './api.js';

// Pick, paste (Ctrl+V), drag-and-drop or link an image. Calls onChange(url).
export default function ImageInput({ id, label, value, onChange, shape = 'wide' }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [over, setOver] = useState(false);
  const [showLink, setShowLink] = useState(false);

  const handle = async (file) => {
    if (!file) return;
    setBusy(true); setErr('');
    try { onChange(await api.uploadImage(file)); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const fromClipboard = (e) => {
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (file) { e.preventDefault(); handle(file); }
  };

  const ratio = shape === 'portrait' ? '4 / 5' : shape === 'square' ? '1 / 1' : '16 / 9';
  return (
    <div className="image-input">
      {label && <span className="small muted" id={`${id}-label`}>{label}</span>}
      <div
        className={`drop ${over ? 'over' : ''}`}
        style={{ aspectRatio: ratio, maxWidth: shape === 'wide' ? '100%' : 280 }}
        tabIndex={0}
        role="group"
        aria-labelledby={label ? `${id}-label` : undefined}
        aria-describedby={`${id}-help`}
        onPaste={fromClipboard}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle([...e.dataTransfer.files].find((f) => f.type.startsWith('image/'))); }}
      >
        {value && <img src={value} alt="" />}
        {!value && !busy && (
          <span className="drop-hint" id={`${id}-help`}>
            Drop an image here, click here and press <b>Ctrl + V</b> to paste,<br />or use the button below.
          </span>
        )}
        {busy && <span className="drop-hint" role="status">Uploading…</span>}
      </div>
      <input ref={fileRef} id={id} type="file" accept="image/*" className="sr-only" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="actions" style={{ marginTop: 6 }}>
        <button type="button" className="ul" onClick={() => fileRef.current?.click()} disabled={busy}>{value ? 'Replace image' : 'Upload image'}</button>
        {value && <button type="button" className="ul" onClick={() => onChange('')}>Remove</button>}
        <button type="button" className="small muted" style={{ minHeight: 44 }} onClick={() => setShowLink(!showLink)}>{showLink ? 'Hide link' : 'Use a link instead'}</button>
      </div>
      {showLink && (
        <div className="field" style={{ marginTop: 4 }}>
          <label htmlFor={`${id}-url`}>Image link</label>
          <input id={`${id}-url`} type="url" value={value?.startsWith('data:') ? '' : value || ''} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />
        </div>
      )}
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}
