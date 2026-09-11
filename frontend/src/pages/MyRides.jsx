import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import RideCard from '../components/RideCard';
import Loader from '../components/Loader';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import './MyRides.css';

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

  const [requests, setRequests] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((key) => key + 1);

  useEffect(() => {
    let cancelled = false;
    // Both lists make up "my rides", so fetch them together and fail together.
    Promise.all([api.listMyRides(), api.listMyRequests()])
      .then(([{ rides: results }, { requests: rows }]) => {
        if (cancelled) return;
        setRides(results);
        setRequests(rows);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const active = rides.filter((ride) => ACTIVE.includes(ride.status));
  const past = rides.filter((ride) => !ACTIVE.includes(ride.status));
  // A request only matters until it is answered or the rider is on board.
  const openRequests = requests.filter((request) => request.status === 'PENDING');
  const closedRequests = requests.filter((request) => request.status !== 'PENDING');

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

      {status === 'ready' && requests.length > 0 && (
        <section className="card myrides__requests">
          <h2 className="myrides__heading">
            Your join requests
            {openRequests.length > 0 && (
              <span className="myrides__count">{openRequests.length} waiting</span>
            )}
          </h2>
          <ul className="myrides__request-list">
            {[...openRequests, ...closedRequests].map((request) => (
              <li key={request._id} className="myrides__request">
                <div className="myrides__request-route">
                  <Link to={`/rides/${request.ride?._id}`} className="myrides__request-link">
                    {request.ride?.pickupLocation?.name} → {request.ride?.dropLocation?.name}
                  </Link>
                  {request.ride?.departureTime && (
                    <span className="myrides__request-time">
                      Departs {formatDateTime(request.ride.departureTime)}
                    </span>
                  )}
                </div>
                <span className={`badge badge--${request.status.toLowerCase()}`}>
                  {request.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {status === 'ready' &&
        (rides.length === 0 && requests.length === 0 ? (
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
