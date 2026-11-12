import { Link } from 'react-router-dom';
import { useTitle } from './util.js';

export default function NotFound() {
  useTitle('Page not found');
  return (
    <div className="wrap hero">
      <p className="label" style={{ marginBottom: 24 }}>404</p>
      <h1 className="h-xl">This page is not on the drawings.</h1>
      <Link to="/" className="ul link mt-32">Back to the home page</Link>
    </div>
  );
}
