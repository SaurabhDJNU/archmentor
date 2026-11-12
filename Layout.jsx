import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import * as api from './api.js';
import { SOCIAL } from './config.js';
import { Close, Instagram, LinkedIn, Search, WhatsApp, YouTube } from './Icons.jsx';

export function Brand({ size }) {
  return <span className="brand" style={size ? { fontSize: size } : undefined}><b>Arch</b><span>Mentor</span></span>;
}

export function Socials() {
  const items = [
    ['youtube', 'ArchMentor on YouTube', YouTube],
    ['instagram', 'ArchMentor on Instagram', Instagram],
    ['whatsapp', 'ArchMentor WhatsApp channel', WhatsApp],
    ['linkedin', 'ArchMentor on LinkedIn', LinkedIn],
  ].filter(([k]) => SOCIAL[k]);
  if (!items.length) return null;
  return (
    <div className="socials">
      {items.map(([k, label, Icon]) => (
        <a key={k} href={SOCIAL[k]} target="_blank" rel="noopener noreferrer" aria-label={label} className="icon-btn"><Icon /></a>
      ))}
    </div>
  );
}

function DemoBar() {
  const { refresh } = useAuth();
  if (!api.DEMO) return null;
  return (
    <div className="demo-bar" role="note">
      <div className="wrap">
        <span>Demo mode: data is saved only in this browser. Log in as <b>student@demo.archmentor</b>, <b>mentor@demo.archmentor</b> or <b>admin@demo.archmentor</b>, password <b>demo1234</b>.</span>
        <button type="button" onClick={() => { api.resetDemo(); refresh(); window.location.reload(); }}>Reset demo data</button>
      </div>
    </div>
  );
}

function Notice() {
  const [session, setSession] = useState(null);
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem('am_notice_hidden') === '1'; } catch { return false; }
  });
  useEffect(() => {
    api.listSessions().then((list) => {
      const upcoming = list.filter((s) => !s.starts_at || new Date(s.starts_at) > new Date());
      setSession(upcoming.find((s) => s.featured) || upcoming[0] || null);
    }).catch(() => {});
  }, []);
  if (hidden || !session) return null;
  const hide = () => { setHidden(true); try { sessionStorage.setItem('am_notice_hidden', '1'); } catch { /* ignore */ } };
  return (
    <div className="notice">
      <div className="wrap">
        <p style={{ padding: '8px 0' }}>Free live {session.kind ? session.kind.toLowerCase() : 'session'}: “{session.title}” <Link to={`/sessions#${session.id}`}>Reserve a seat</Link></p>
        <button type="button" className="icon-btn" aria-label="Dismiss notice" onClick={hide}><Close /></button>
      </div>
    </div>
  );
}

function Header() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="header">
      <div className="wrap">
        <Link to="/" aria-label="ArchMentor home"><Brand /></Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/mentors">Mentors</NavLink>
          <NavLink to="/sessions">Sessions</NavLink>
          <NavLink to="/journal">Journal</NavLink>
          <NavLink to="/videos">Videos</NavLink>
          <NavLink to="/ask">Ask</NavLink>
          {user ? (
            <>
              <NavLink to="/dashboard">{profile?.role === 'admin' ? 'Admin' : 'Dashboard'}</NavLink>
              <button type="button" className="muted" style={{ minHeight: 36 }} onClick={async () => { await api.signOut(); navigate('/'); }}>Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="muted">Log in</NavLink>
              <Link to="/signup" className="ul">Get started</Link>
            </>
          )}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link to="/journal?search=1" aria-label="Search the Journal" className="icon-btn" style={{ marginLeft: -12 }}><Search /></Link>
          <Socials />
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="wrap cols">
        <div>
          <p style={{ marginBottom: 10 }}><Brand size={18} /></p>
          <p className="muted" style={{ maxWidth: '32ch' }}>Helping architecture students learn from experienced mentors, explore career paths and make informed academic decisions.</p>
        </div>
        <nav aria-label="Explore">
          <span className="muted">Explore</span>
          <Link to="/mentors">Find mentors</Link>
          <Link to="/sessions">Live sessions</Link>
          <Link to="/videos">Videos</Link>
          <Link to="/journal">Journal</Link>
        </nav>
        <nav aria-label="Get involved">
          <span className="muted">Get involved</span>
          <Link to="/signup?role=mentor">Become a mentor</Link>
          <Link to="/ask">Ask a mentor</Link>
          <Link to="/write">Write for the Journal</Link>
          <Link to="/login">Log in</Link>
          <Link to="/signup">Create account</Link>
        </nav>
        <div className="stack gap-8 muted">
          <Socials />
          <span>© {new Date().getFullYear()} ArchMentor</span>
          <span>Built for the architecture student community.</span>
        </div>
      </div>
    </footer>
  );
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) { setTimeout(() => el.scrollIntoView(), 50); return; }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function Layout() {
  return (
    <>
      <a href="#main" className="sr-only">Skip to content</a>
      <ScrollToTop />
      <DemoBar />
      <Notice />
      <Header />
      <main id="main"><Outlet /></main>
      <Footer />
    </>
  );
}
