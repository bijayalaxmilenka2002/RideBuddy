import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container page">
      <div className="state">
        <p style={{ fontWeight: 600, color: 'var(--color-text)' }}>Page not found</p>
        <p style={{ marginTop: 'var(--space-2)' }}>That route does not exist.</p>
        <Link to="/" className="btn btn--primary" style={{ marginTop: 'var(--space-4)' }}>
          Back home
        </Link>
      </div>
    </div>
  );
}
