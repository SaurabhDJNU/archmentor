import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from './api.js';
import { useTitle } from './util.js';

export default function Unsubscribe() {
  useTitle('Unsubscribe');
  const [params] = useSearchParams();
  const token = params.get('t');
  const [state, setState] = useState('working');
  const once = useRef(false);
  useEffect(() => {
    if (!token) { setState('missing'); return; }
    if (once.current) return;
    once.current = true;
    api.unsubscribe(token).then((done) => setState(done ? 'done' : 'gone')).catch(() => setState('error'));
  }, [token]);
  const text = {
    working: 'Removing you from the list…',
    done: 'You are unsubscribed. You will not get any more newsletter emails from us.',
    gone: 'This email address is already unsubscribed.',
    missing: 'This unsubscribe link is incomplete. Please use the link from the bottom of our email.',
    error: 'Something went wrong. Please try the link again in a minute.',
  }[state];
  return (
    <div className="wrap hero">
      <p className="label" style={{ marginBottom: 24 }}>Email preferences</p>
      <h1 className="h-l" role="status">{text}</h1>
      <Link to="/" className="ul link mt-32">Back to the home page</Link>
    </div>
  );
}
