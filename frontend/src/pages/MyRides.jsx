import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import RideCard from '../components/RideCard';
import Loader from '../components/Loader';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

const ACTIVE = ['OPEN', 'LOCKED'];

/**
 * Every pool the user belongs to. Discovery deliberately hides rides that are
 * full or already departed, so without this page a rider would lose track of
 * their own ride the moment it filled up.
 */
export default function MyRides() {
  const [rides, setRides] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const { rides: results } = await api.listMyRides();
      setRides(results);
      setStatus('ready');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = rides.filter((ride) => ACTIVE.includes(ride.status));
  const past = rides.filter((ride) => !ACTIVE.includes(ride.status));

  return (
    <div className="container page">
      <header className="page__header">
        <div>
          <h1 className="page__title">My rides</h1>
          <p className="page__subtitle">Pools you have created or joined.</p>
        </div>
        <Link to="/rides/new" className="btn btn--primary">Create ride</Link>
      </header>

      {status === 'error' && <ErrorState message={error} onRetry={load} />}
      {status === 'loading' && <Loader label="Loading your rides…" />}

      {status === 'ready' &&
        (rides.length === 0 ? (
          <EmptyState
            title="You are not in any ride pool yet"
            description="Join an open pool, or create one and let others join you."
            action={<Link to="/rides" className="btn btn--primary">Find a ride</Link>}
          />
        ) : (
          <>
            {active.length > 0 && (
              <div className="grid">
                {active.map((ride) => (
                  <RideCard key={ride._id} ride={ride} />
                ))}
              </div>
            )}

            {past.length > 0 && (
              <>
                <h2 className="page__title" style={{ margin: 'var(--space-8) 0 var(--space-4)' }}>
                  Completed &amp; cancelled
                </h2>
                <div className="grid">
                  {past.map((ride) => (
                    <RideCard key={ride._id} ride={ride} />
                  ))}
                </div>
              </>
            )}
          </>
        ))}
    </div>
  );
}
