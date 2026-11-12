import { Link, useSearchParams } from 'react-router-dom';
import * as api from './api.js';
import { SERVICES, useLoad, useTitle } from './util.js';
import { ErrorMsg, Loading, MentorCard } from './Bits.jsx';

export default function Mentors() {
  useTitle('Mentors');
  const [params, setParams] = useSearchParams();
  const service = params.get('service') || '';
  const { data, error, loading } = useLoad(api.listMentors);
  const list = (data || []).filter((m) => !service || (m.specialties || []).includes(service));

  return (
    <div className="wrap page-top">
      <p className="label" style={{ marginBottom: 24 }}>Mentors</p>
      <h1 className="h-xl" style={{ maxWidth: '18ch' }}>Learn from architects and educators who have been where you are.</h1>

      <div className="choice-row mt-48" role="group" aria-label="Filter by service">
        <button type="button" className="choice" aria-pressed={!service} onClick={() => setParams({})}>All</button>
        {Object.entries(SERVICES).map(([id, s]) => (
          <button key={id} type="button" className="choice" aria-pressed={service === id} onClick={() => setParams({ service: id })}>{s.title}</button>
        ))}
      </div>

      <div className="mt-48">
        {loading && <Loading />}
        <ErrorMsg error={error} />
        {!loading && !list.length && <p className="empty">No mentors listed for this yet. <Link to="/mentors" className="ul">See all mentors</Link></p>}
        <div className="grid">{list.map((m) => <MentorCard key={m.id} m={m} />)}</div>
      </div>

      <div className="panel mt-48" style={{ marginTop: 'var(--gap-section)', display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="h-m">Are you an architect or educator?</p>
          <p style={{ color: 'var(--ink-2)', marginTop: 6 }}>Give an hour to a student. Apply and we will review your profile.</p>
        </div>
        <Link to="/signup?role=mentor" className="btn">Become a mentor</Link>
      </div>
    </div>
  );
}
