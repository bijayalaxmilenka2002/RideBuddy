import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import RideCard from '../components/RideCard';
import Loader from '../components/Loader';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

/** Ride discovery. Only OPEN rides with a free seat come back from the API. */
export default function Rides() {
  const navigate = useNavigate();
  const [rides, setRides] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [joiningId, setJoiningId] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const { rides: results } = await api.listRides({ vehicleType });
      setRides(results);
      setStatus('ready');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }, [vehicleType]);

  useEffect(() => {
    load();
  }, [load]);

  const handleJoin = async (ride) => {
    setJoiningId(ride._id);
    setError('');
    try {
      await api.joinRide(ride._id);
      navigate(`/rides/${ride._id}`);
    } catch (err) {
      setError(err.message);
      load(); // the ride may have filled up since the list was fetched
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="container page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Available ride pools</h1>
          <p className="page__subtitle">Join an open pool, or start your own.</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <select
            className="field__select"
            value={vehicleType}
            onChange={(event) => setVehicleType(event.target.value)}
            aria-label="Filter by vehicle"
          >
            <option value="">All vehicles</option>
            <option value="BIKE">Bike</option>
            <option value="AUTO">Auto</option>
            <option value="CAB">Cab</option>
          </select>
          <Link to="/rides/new" className="btn btn--primary">Create ride</Link>
        </div>
      </header>

      {status === 'error' && <ErrorState message={error} onRetry={load} />}
      {status === 'loading' && <Loader label="Loading rides…" />}

      {status === 'ready' && (
        <>
          {error && <p className="alert">{error}</p>}
          {rides.length === 0 ? (
            <EmptyState
              title="No open rides right now"
              description="Nobody is pooling on this route yet. Create a ride and let others join you."
              action={<Link to="/rides/new" className="btn btn--primary">Create a ride</Link>}
            />
          ) : (
            <div className="grid">
              {rides.map((ride) => (
                <RideCard
                  key={ride._id}
                  ride={ride}
                  onJoin={handleJoin}
                  joining={joiningId === ride._id}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
