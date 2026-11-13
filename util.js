import { useEffect, useState } from 'react';

// Marketing groups on the home page; each links to mentors with services in that category.
export const SERVICES = {
  portfolio: { title: 'Portfolio Review', category: 'Portfolio', text: 'Practical feedback on your portfolio, its presentation and the story your projects tell.' },
  career: { title: 'Career Guidance', category: 'Career', text: 'Career paths, specialisations, internships and your next step in architecture.' },
  admissions: { title: 'Admissions Mentoring', category: 'Admissions', text: 'Choosing universities, preparing applications and writing your statement.' },
};

export function fmtDate(iso, withTime = false) {
  if (!iso) return '';
  const d = new Date(iso);
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  if (withTime) Object.assign(opts, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  return d.toLocaleString('en-IN', opts);
}

// Accepts a YouTube URL or a bare id and returns the id.
export function youtubeId(input = '') {
  const s = String(input).trim();
  if (!s) return '';
  const m = s.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(s) ? s : '';
}

export const ytThumb = (id) => (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '');
export const ytUrl = (id, short) => (id ? (short ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`) : '');

export function slugify(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 80);
}

export function initials(name = '') {
  return name.replace(/^dr\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

// Small hook for async loads: const { data, error, loading, reload } = useLoad(fn, [deps])
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    Promise.resolve()
      .then(fn)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function useTitle(title) {
  useEffect(() => { document.title = title ? `${title} · ArchMentor` : 'ArchMentor · Architecture mentorship'; }, [title]);
}

export async function share({ title, url }) {
  try {
    if (navigator.share) { await navigator.share({ title, url }); return 'shared'; }
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch { return 'cancelled'; }
}

export function toCsv(rows) {
  if (!rows?.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => `"${String(Array.isArray(v) ? v.join('; ') : v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- added for v2
const IST = { timeZone: 'Asia/Kolkata' };
export function fmtSessionTime(starts, ends) {
  if (!starts) return 'Date to be announced';
  const s = new Date(starts);
  const date = s.toLocaleDateString('en-IN', { ...IST, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const t = (d) => d.toLocaleTimeString('en-IN', { ...IST, hour: 'numeric', minute: '2-digit' }).toUpperCase();
  return `${date} · ${t(s)}${ends ? ` – ${t(new Date(ends))}` : ''} IST`;
}
export function dateParts(iso) {
  if (!iso) return { month: 'TBA', day: '–' };
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString('en-IN', { ...IST, month: 'long' }).toUpperCase(),
    day: d.toLocaleDateString('en-IN', { ...IST, day: 'numeric' }),
  };
}
export const fmtPrice = (p) => (!p ? 'Free' : `₹${Number(p).toLocaleString('en-IN')}`);
export const ROLE_LABEL = { student: 'Student', mentor: 'Mentor', professional: 'Professional', admin: 'Team' };
export function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(iso);
}
export function passwordProblems(pw = '') {
  const out = [];
  if (pw.length < 8) out.push('at least 8 characters');
  if (!/[A-Z]/.test(pw)) out.push('one uppercase letter');
  if (!/[0-9]/.test(pw)) out.push('one number');
  return out;
}
