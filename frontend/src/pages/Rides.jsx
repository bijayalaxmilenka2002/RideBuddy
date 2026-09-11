import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Crosshair, X } from 'lucide-react';
import { api } from '../lib/api';
import PlaceSearch from '../components/PlaceSearch';
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
  // Either a GPS fix or a place picked from the map search.
  const [near, setNear] = useState(null);
  const [nearPlace, setNearPlace] = useState(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [locating, setLocating] = useState(false);
  // What is typed, and the debounced value actually sent to the API.
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [before, setBefore] = useState('');

  // Wait for a pause in typing rather than querying on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQ(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Bumped to force a refetch (the retry button, or after a failed join).
  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((key) => key + 1);

  /**
   * State is only touched in the promise callbacks, and a superseded request
   * is ignored - otherwise switching the filter quickly can let a slow earlier
   * response overwrite the newer results.
   */
  useEffect(() => {
    let cancelled = false;
    api
      .listRides({
        vehicleType,
        ...(q ? { q } : {}),
        // datetime-local gives a local time; the API parses it as a date.
        ...(before ? { to: new Date(before).toISOString() } : {}),
        // The API takes GeoJSON order and does the distance search server-side.
        ...(near ? { lng: near.lng, lat: near.lat, radiusKm } : {}),
      })
      .then(({ rides: results }) => {
        if (cancelled) return;
        setRides(results);
        setError('');
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
  }, [vehicleType, q, before, near, radiusKm, reloadKey]);

  const findNearMe = () => {
    if (!navigator.geolocation) {
      setError('Your browser does not support location search');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setNear({ lng: coords.longitude, lat: coords.latitude });
        setNearPlace({ name: 'My current location', coordinates: [coords.longitude, coords.latitude] });
        setLocating(false);
      },
      () => {
        setError('Could not read your location. Check the browser permission.');
        setLocating(false);
      }
    );
  };

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
          <input
            type="search"
            className="field__input rides__search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search pickup or destination…"
            aria-label="Search by place"
          />

          <input
            type="datetime-local"
            className="field__input"
            value={before}
            onChange={(event) => setBefore(event.target.value)}
            aria-label="Departing before"
            title="Departing before"
          />

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
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setNear(null);
                  setNearPlace(null);
                }}
              >
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

      {/* Search around a place instead of your own position. */}
      {near ? (
        <p className="rides__near-note">
          Showing rides starting within {radiusKm} km of <strong>{nearPlace?.name || 'your location'}</strong>.
        </p>
      ) : (
        <div className="rides__near-picker">
          <PlaceSearch
            id="nearPlace"
            label="Or find rides near a place"
            value={nearPlace}
            onSelect={(place) => {
              setNearPlace(place);
              setNear({ lng: place.coordinates[0], lat: place.coordinates[1] });
            }}
            onClear={() => {
              setNearPlace(null);
              setNear(null);
            }}
            placeholder="e.g. Koramangala, Bengaluru"
          />
        </div>
      )}

      {status === 'error' && <ErrorState message={error} onRetry={load} />}
      {status === 'loading' && <Loader label="Loading rides…" />}

      {status === 'ready' && (
        <>
          {error && <p className="alert">{error}</p>}
          {rides.length === 0 ? (
            <EmptyState
              title={
                near
                  ? `No open rides within ${radiusKm} km`
                  : q || before
                    ? 'No rides match that search'
                    : 'No open rides right now'
              }
              description={
                near || q || before
                  ? 'Try a wider radius, a different place, or a later time.'
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
