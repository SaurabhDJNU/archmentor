import { useSearchParams } from 'react-router-dom';
import { rupees } from './money.js';

export const Status = ({ s, label }) => <span className={`status ${s}`}>{label || String(s || '').replace(/_/g, ' ')}</span>;
export const Money = ({ p }) => <span className="num">{rupees(p)}</span>;

export function Tabs({ tabs, active, setActive }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={active === id} onClick={() => setActive(id)}>{label}</button>)}
    </div>
  );
}

// Tab kept in the address (?tab=…) so links from emails and reloads land in the right place
export function useTab(first) {
  const [params, setParams] = useSearchParams();
  return [params.get('tab') || first, (t) => setParams(t === first ? {} : { tab: t }, { replace: true })];
}

export function Stat({ label, value, note }) {
  return (
    <div className="stat">
      <p className="small muted">{label}</p>
      <p className="stat-v">{value}</p>
      {note && <p className="small faint">{note}</p>}
    </div>
  );
}

export function Skeleton({ lines = 3 }) {
  return <div className="skeleton" aria-hidden="true">{Array.from({ length: lines }, (_, i) => <span key={i} style={{ width: `${90 - i * 17}%` }} />)}</div>;
}
