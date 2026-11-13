import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as platform from './platform.js';
import { timeAgo } from './util.js';

// Bell with unread count; polls once a minute while the tab is visible
export default function Notifications() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const load = () => platform.listNotifications().then(setItems).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <div className="bell" ref={box}>
      <button type="button" className="icon-btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}
        onClick={() => { setOpen(!open); if (!open && unread) platform.markNotificationsRead().then(load); }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
        {unread > 0 && <span className="dot" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          {!items.length && <p className="small muted" style={{ padding: 16 }}>Nothing new.</p>}
          {items.map((n) => (
            <Link key={n.id} to={n.link || '/dashboard'} className={`bell-item ${n.read_at ? '' : 'new'}`} onClick={() => setOpen(false)}>
              <span>{n.title}</span>
              {n.body && <span className="small muted">{n.body}</span>}
              <span className="small faint">{timeAgo(n.created_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
