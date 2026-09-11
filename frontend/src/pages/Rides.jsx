import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Crosshair, X } from 'lucide-react';
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
  // When set, discovery is restricted to pools starting near this point.
  const [near, setNear] = useState(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [locating, setLocating] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const { rides: results } = await api.listRides({
        vehicleType,
        // The API takes GeoJSON order and does the distance search server-side.
        ...(near ? { lng: near.lng, lat: near.lat, radiusKm } : {}),
      });
      setRides(results);
      setStatus('ready');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }, [vehicleType, near, radiusKm]);

  const findNearMe = () => {
    if (!navigator.geolocation) {
      setError('Your browser does not support location search');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setNear({ lng: coords.longitude, lat: coords.latitude });
        setLocating(false);
      },
      () => {
        setError('Could not read your location. Check the browser permission.');
        setLocating(false);
      }
    );
  };

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
        <div className="rides__controls">
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

          {near ? (
            <>
              <select
                className="field__select"
                value={radiusKm}
                onChange={(event) => setRadiusKm(Number(event.target.value))}
                aria-label="Search radius"
              >
                <option value={2}>Within 2 km</option>
                <option value={5}>Within 5 km</option>
                <option value={10}>Within 10 km</option>
                <option value={25}>Within 25 km</option>
              </select>
              <button type="button" className="btn btn--ghost" onClick={() => setNear(null)}>
                <X size={14} /> Clear
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={findNearMe}
              disabled={locating}
            >
              <Crosshair size={14} />
              {locating ? 'Locating…' : 'Near me'}
            </button>
          )}

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
              title={near ? `No open rides within ${radiusKm} km` : 'No open rides right now'}
              description={
                near
                  ? 'Try a wider radius, or create a ride and let others join you.'
                  : 'Nobody is pooling on this route yet. Create a ride and let others join you.'
              }
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
