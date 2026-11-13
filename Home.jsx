import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from './api.js';
import { terms } from './seed.js';
import { SERVICES, useLoad, useTitle } from './util.js';
import { SOCIAL } from './config.js';
import { Axonometric } from './Icons.jsx';
import { Arrow, MentorCard, PostCard, SessionCard, ShortCard, Split, SubscribeForm, VideoPlayer } from './Bits.jsx';

const NEEDS = [['portfolio', 'my portfolio'], ['career', 'my career direction'], ['admissions', 'admissions']];
const STAGES = [['early', '1st–3rd year'], ['final', 'final year'], ['grad', 'practice already']];
const BRING = {
  portfolio: ['Your portfolio as a PDF (a rough draft is fine)', 'Where it is going: internship, job or a master’s', 'Two or three projects you are unsure about'],
  career: ['What you enjoy in studio, and what you avoid', 'Any internship or job offers you are weighing', 'Specialisations you are curious about'],
  admissions: ['Your shortlist of schools or programmes', 'Their application deadlines', 'A draft statement of purpose, if you have one'],
};
const NOTES = {
  early: 'Starting early helps: small changes now save a full rebuild later.',
  final: 'Bring your thesis direction too. It shapes both your portfolio and your next step.',
  grad: 'Mention your work experience, so your mentor can frame advice around it.',
};

function Finder() {
  const [need, setNeed] = useState('portfolio');
  const [stage, setStage] = useState('early');
  return (
    <div className="panel">
      <p className="muted" style={{ fontSize: 15, marginBottom: 16 }}>I want help with</p>
      <div className="choice-row" role="group" aria-label="What you need help with">
        {NEEDS.map(([id, label]) => <button key={id} type="button" className="choice" aria-pressed={need === id} onClick={() => setNeed(id)}>{label}</button>)}
      </div>
      <p className="muted" style={{ fontSize: 15, margin: '32px 0 16px' }}>and I am in</p>
      <div className="choice-row" role="group" aria-label="Your stage">
        {STAGES.map(([id, label]) => <button key={id} type="button" className="choice" aria-pressed={stage === id} onClick={() => setStage(id)}>{label}</button>)}
      </div>
      <div className="split" style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--line-2)' }}>
        <div style={{ flex: '1 1 240px' }} aria-live="polite">
          <p className="small muted">Start with</p>
          <p style={{ fontSize: 28, letterSpacing: '-0.02em', margin: '4px 0 10px' }}>{SERVICES[need].title}</p>
          <p style={{ fontSize: 15, color: 'var(--ink-2)' }}>{NOTES[stage]}</p>
        </div>
        <div style={{ flex: '1 1 240px' }}>
          <p className="small muted" style={{ marginBottom: 8 }}>Bring to your first session</p>
          <ul className="list-lines">{BRING[need].map((b) => <li key={b}>{b}</li>)}</ul>
        </div>
      </div>
      <Link to={`/mentors?category=${SERVICES[need].category}`} className="ul link row mt-32">See mentors for {SERVICES[need].title} <Arrow /></Link>
    </div>
  );
}

function StudioWord() {
  const [i, setI] = useState(0);
  const t = terms[i];
  return (
    <Split label={`Studio word (${i + 1}/${terms.length})`}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 48px', alignItems: 'baseline', borderTop: '1px solid var(--line)', paddingTop: 24 }} aria-live="polite">
        <p className="light" style={{ fontSize: 'clamp(32px, 4vw, 56px)', letterSpacing: '-0.03em', lineHeight: 1 }}>{t.word} <span className="muted" style={{ fontSize: 15, letterSpacing: 0 }}>{t.say}</span></p>
        <p style={{ flex: '1 1 320px', color: 'var(--ink-2)' }}>{t.meaning}</p>
        <button type="button" className="ul" style={{ minHeight: 44 }} onClick={() => setI((i + 1) % terms.length)}>Next word</button>
      </div>
    </Split>
  );
}

export default function Home() {
  useTitle('');
  const mentors = useLoad(api.listMentors);
  const sessions = useLoad(api.listSessions);
  const posts = useLoad(api.listPosts);
  const videos = useLoad(api.listVideos);

  const upcoming = (sessions.data || []).filter((s) => !s.starts_at || new Date(s.starts_at) > new Date());
  const session = upcoming.find((s) => s.featured) || upcoming[0];
  const fullVideos = (videos.data || []).filter((v) => v.kind === 'full');
  const featuredVideo = fullVideos.find((v) => v.featured) || fullVideos[0];
  const shorts = (videos.data || []).filter((v) => v.kind === 'short').slice(0, 4);

  return (
    <>
      <section className="wrap hero">
        <p className="label" style={{ marginBottom: 32 }}>Architecture mentorship</p>
        <h1 className="display">Build your architecture career with expert guidance.</h1>
        <div className="hero-aside">
          <div>
            <p className="lead">Personal mentorship for portfolio reviews, career guidance and architecture admissions, with practising architects and educators.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 32px', marginTop: 28 }}>
              <Link to="/signup" className="ul link row">Join as a student <Arrow /></Link>
              <Link to="/mentors" className="link muted">Explore mentors</Link>
            </div>
          </div>
        </div>
      </section>

      <figure className="wrap figure" style={{ margin: '0 auto' }}>
        <div className="frame"><Axonometric /></div>
        <figcaption>
          <span>Fig. 01 — Where a degree in architecture can lead.</span>
          <span>From the free talk, “Is architecture only about design?”</span>
        </figcaption>
      </figure>

      <Split label={<>Services <span className="faint">(03)</span></>}>
        <ol className="index">
          {Object.entries(SERVICES).map(([id, s], i) => (
            <li key={id}>
              <Link to={`/mentors?category=${s.category}`} className="row">
                <span className="no">0{i + 1}</span>
                <span className="t">{s.title}</span>
                <span className="d">{s.text}</span>
                <Arrow />
              </Link>
            </li>
          ))}
        </ol>
      </Split>

      <Split id="mentors" label="Mentors" aside={<>
        <p style={{ color: 'var(--ink-2)', maxWidth: '26ch' }}>Experienced architects and educators.</p>
        <Link to="/mentors" className="ul" style={{ alignSelf: 'flex-start', fontSize: 15 }}>View all mentors</Link>
      </>}>
        <div className="grid">{(mentors.data || []).slice(0, 3).map((m) => <MentorCard key={m.id} m={m} />)}</div>
        {mentors.data && !mentors.data.length && <p className="empty">Mentor profiles are on their way.</p>}
      </Split>

      {session && (
        <Split id="session" label="Free live session">
          <SessionCard s={session} big />
          <Link to={`/sessions/${session.slug || session.id}`} className="ul link row mt-32">Reserve your seat <Arrow /></Link>
        </Split>
      )}

      {(featuredVideo || shorts.length > 0) && (
        <Split id="watch" label="Watch" aside={<>
          <p style={{ color: 'var(--ink-2)', maxWidth: '26ch' }}>Talk recordings and short studio lessons.</p>
          {SOCIAL.youtube
            ? <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="ul link row" style={{ alignSelf: 'flex-start', fontSize: 15 }}>Subscribe on YouTube <Arrow /></a>
            : <Link to="/videos" className="ul" style={{ alignSelf: 'flex-start', fontSize: 15 }}>All videos</Link>}
        </>}>
          <div className="stack" style={{ gap: 48 }}>
            {featuredVideo && (
              <div>
                <VideoPlayer video={featuredVideo} />
                <p className="h-m mt-16">{featuredVideo.title}</p>
              </div>
            )}
            {shorts.length > 0 && (
              <div>
                <p className="small muted" style={{ marginBottom: 16 }}>Shorts</p>
                <div className="grid grid-shorts">{shorts.map((v) => <ShortCard key={v.id} v={v} />)}</div>
              </div>
            )}
          </div>
        </Split>
      )}

      <Split label="How it works">
        <ol className="steps">
          <li><span className="faint small">01</span><p className="t">Create your account</p><p className="d">Join as a student and add your academic and career goals.</p></li>
          <li><span className="faint small">02</span><p className="t">Choose your mentor</p><p className="d">Browse approved mentors and pick the right person for what you need.</p></li>
          <li><span className="faint small">03</span><p className="t">Request and schedule</p><p className="d">Send a request; once it is approved, fix a time that suits you both.</p></li>
        </ol>
      </Split>

      <Split id="finder" label="Not sure where to start?"><Finder /></Split>

      <Split id="journal" label="Journal" aside={<Link to="/journal" className="ul" style={{ alignSelf: 'flex-start', fontSize: 15 }}>All stories</Link>}>
        <div className="grid grid-wide">{(posts.data || []).slice(0, 2).map((p) => <PostCard key={p.id} p={p} />)}</div>
      </Split>

      <Split label="Community">
        <div className="split" style={{ gap: 48 }}>
          <div style={{ flex: '3 1 360px', minWidth: 0 }}>
            <p className="h-l">Ask. Share. Learn together.</p>
            <p style={{ margin: '12px 0 24px', fontSize: 15, color: 'var(--ink-2)' }}>Real questions and practical advice from architecture students, mentors and professionals. You get an email when someone answers.</p>
            <div className="actions"><Link to="/community/ask" className="ul link row">Ask a question <Arrow /></Link><Link to="/community" className="link muted">Browse questions</Link></div>
          </div>
          <div className="panel stack gap-16" style={{ flex: '2 1 260px', minWidth: 0, alignSelf: 'flex-start', padding: 32 }}>
            <p className="small muted">Write for the Journal</p>
            <p className="h-m">Students and architects are welcome to write for us.</p>
            <p style={{ fontSize: 15, color: 'var(--ink-2)' }}>Send a short idea: a lesson from a jury, an internship or a site visit.</p>
            <Link to="/write" className="ul link row" style={{ alignSelf: 'flex-start' }}>Submit your story <Arrow /></Link>
          </div>
        </div>
      </Split>

      <StudioWord />

      <section className="wrap" style={{ paddingTop: 'clamp(120px, 14vw, 220px)' }}>
        <p className="display" style={{ fontSize: 'clamp(40px, 6.4vw, 100px)', maxWidth: '14ch' }}>Move forward with clarity and confidence.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 48, marginTop: 'clamp(48px, 6vw, 80px)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 32px' }}>
            <Link to="/signup" className="ul link row">Join as a student <Arrow /></Link>
            <Link to="/signup?role=mentor" className="ul link">Become a mentor</Link>
          </div>
          <div style={{ flex: '0 1 420px', minWidth: 0 }}><SubscribeForm compact /></div>
        </div>
      </section>
    </>
  );
}
