import { Link } from 'react-router-dom';
import { useTitle } from './util.js';
import { T, Img } from './Content.jsx';

export default function NotFound() {
  useTitle('Page not found');
  return (
    <div className="wrap hero">
      <p className="label" style={{ marginBottom: 24 }}>404</p>
      <h1 className="h-xl"><T k="notfound.title">This page is not on the drawings.</T></h1>
      <Link to="/" className="ul link mt-32">Back to the home page</Link>
    </div>
  );
}
