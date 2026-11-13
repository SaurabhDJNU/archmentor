import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import * as api from './api.js';
import { SOCIAL } from './config.js';
import { Close, Instagram, LinkedIn, Search, WhatsApp, YouTube } from './Icons.jsx';
import Notifications from './Notifications.jsx';
import InstallApp from './InstallApp.jsx';
import { T, Img } from './Content.jsx';

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
        <span>Demo mode: data stays in this browser, no real emails or payments. Log in as <b>student@</b>, <b>mentor@</b>, <b>professional@</b>, <b>staff@</b>, <b>finance@</b> or <b>admin@demo.archmentor</b>, password <b>demo1234</b>.</span>
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
        <p style={{ padding: '8px 0' }}>Free live session: “{session.title}” <Link to={`/sessions/${session.slug || session.id}`}>Reserve a seat</Link></p>
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
          <NavLink to="/portfolio">Portfolio review</NavLink>
          <NavLink to="/community">Community</NavLink>
          <NavLink to="/journal">Journal</NavLink>
          <NavLink to="/opportunities">Opportunities</NavLink>
          {user ? (
            <>
              <NavLink to={['admin', 'staff'].includes(profile?.role) ? '/staff' : '/dashboard'}>{['admin', 'staff'].includes(profile?.role) ? 'Workspace' : 'Dashboard'}</NavLink>
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
          {user && <Notifications />}
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
          <p className="muted" style={{ maxWidth: '32ch' }}><T k="footer.about" block>Helping architecture students learn from experienced mentors, explore career paths and make informed academic decisions.</T></p>
        </div>
        <nav aria-label="Explore">
          <span className="muted">Explore</span>
          <Link to="/mentors">Find mentors</Link>
          <Link to="/sessions">Live sessions</Link>
          <Link to="/community">Community</Link>
          <Link to="/portfolio">Portfolio review</Link>
          <Link to="/opportunities">Opportunities</Link>
          <Link to="/resources">Resources</Link>
          <Link to="/videos">Videos</Link>
          <Link to="/journal">Journal</Link>
        </nav>
        <nav aria-label="Get involved">
          <span className="muted">Get involved</span>
          <Link to="/signup?role=mentor">Become a mentor</Link>
          <Link to="/community/ask">Ask the community</Link>
          <Link to="/write">Write for the Journal</Link>
          <Link to="/support">Contact &amp; support</Link>
          <Link to="/login">Log in</Link>
          <Link to="/staff/login">Team sign-in</Link>
        </nav>
        <div className="stack gap-8 muted">
          <Socials />
          <InstallApp compact />
          <span>© {new Date().getFullYear()} ArchMentor</span>
          <span><Link to="/legal/privacy">Privacy</Link> · <Link to="/legal/terms">Terms</Link> · <Link to="/legal/refunds">Refunds</Link></span>
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

// Page rise between routes + sections that reveal as they scroll into view (see styles.css → motion)
const REVEAL = '.split, .grid > *, .card-line, .panel, .stats > *, .index li, .steps li, .mentor-card, figure, .grid-2 > *, .grid-3 > *';
function RouteFade({ children }) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    const seen = new WeakSet();
    const scan = () => {
      document.querySelectorAll(`#main ${REVEAL.split(', ').join(', #main ')}`).forEach((el) => {
        if (seen.has(el) || el.closest('.staff-main') || el.closest('.rv:not(.in)')) return;
        seen.add(el);
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.92) return;          // already on screen: leave it alone
        const sib = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0;
        el.style.setProperty('--d', `${Math.min(sib, 5) * 70}ms`);
        el.classList.add('rv'); io.observe(el);
      });
    };
    scan();
    const mo = new MutationObserver(() => scan());
    mo.observe(document.getElementById('main'), { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [pathname]);
  return <div key={pathname.split('/').slice(0, 3).join('/')} className="route-fade">{children}</div>;
}

function useHeaderShadow() {
  useEffect(() => {
    const h = document.querySelector('.header');
    const on = () => h?.classList.toggle('scrolled', window.scrollY > 8);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
}

export default function Layout() {
  useHeaderShadow();
  return (
    <>
      <a href="#main" className="sr-only">Skip to content</a>
      <ScrollToTop />
      <DemoBar />
      <Notice />
      <Header />
      <main id="main"><RouteFade><Outlet /></RouteFade></main>
      <Footer />
    </>
  );
}

// Shown instead of the site when a production build has no Supabase settings (fails closed).
export function NotConfigured() {
  return (
    <div className="wrap page-top" style={{ maxWidth: 680 }}>
      <p style={{ marginBottom: 24 }}><Brand /></p>
      <h1 className="h-l">This site is not connected yet.</h1>
      <p className="lead mt-24">The database settings are missing from this build, so nothing is shown and nothing is saved. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your hosting settings and deploy again (README → Go live).</p>
      <p className="small muted mt-24">For a preview with sample data instead, set <code>VITE_DEMO_MODE=true</code>.</p>
    </div>
  );
}
