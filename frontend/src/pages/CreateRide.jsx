import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import PlaceSearch from '../components/PlaceSearch';
import RouteMap from '../components/RouteMap';
import './CreateRide.css';

// Shown next to the vehicle picker. The server derives the real value.
const CAPACITY_HINT = { BIKE: '2 riders (you + 1 co-rider)', AUTO: '3 riders (you + 2 co-riders)', CAB: '3 riders (you + 2 co-riders)' };

/** datetime-local wants a local `YYYY-MM-DDTHH:mm`, not an ISO string. */
const localInputValue = (date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const EMPTY = {
  vehicleType: 'CAB',
  // Chosen from the place search: { name, coordinates: [lng, lat] }.
  pickup: null,
  drop: null,
  departureTime: '',
  // When true, riders apply and the admin accepts or rejects them.
  approvalRequired: false,
};

/** Creating a ride makes you its admin, and takes the first seat. */
export default function CreateRide() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [details, setDetails] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setDetails([]);

    if (!form.pickup || !form.drop) {
      setError('Choose both a pickup point and a destination');
      return;
    }

    setSubmitting(true);
    try {
      const { ride } = await api.createRide({
        vehicleType: form.vehicleType,
        pickupLocation: { name: form.pickup.name, coordinates: form.pickup.coordinates },
        dropLocation: { name: form.drop.name, coordinates: form.drop.coordinates },
        departureTime: new Date(form.departureTime).toISOString(),
        approvalRequired: form.approvalRequired,
      });
      navigate(`/rides/${ride._id}`);
    } catch (err) {
      setError(err.message);
      setDetails(err.details || []);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Create a ride pool</h1>
          <p className="page__subtitle">You become the ride admin and take the first seat.</p>
        </div>
      </header>

      <form className="card create-ride__form" onSubmit={handleSubmit}>
        {error && (
          <div className="alert">
            <p>{error}</p>
            {details.map((detail) => (
              <p key={detail.field}>{detail.field}: {detail.message}</p>
            ))}
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="vehicleType">Vehicle</label>
          <select id="vehicleType" className="field__select" value={form.vehicleType} onChange={update('vehicleType')}>
            <option value="BIKE">Bike</option>
            <option value="AUTO">Auto</option>
            <option value="CAB">Cab</option>
          </select>
          <span className="field__hint">Capacity: {CAPACITY_HINT[form.vehicleType]}</span>
        </div>

        <PlaceSearch
          id="pickup"
          label="Pickup point"
          value={form.pickup}
          onSelect={(place) => setForm((prev) => ({ ...prev, pickup: place }))}
          onClear={() => setForm((prev) => ({ ...prev, pickup: null }))}
          placeholder="e.g. Andheri Station"
          showUseMyLocation
        />

        <PlaceSearch
          id="drop"
          label="Destination"
          value={form.drop}
          onSelect={(place) => setForm((prev) => ({ ...prev, drop: place }))}
          onClear={() => setForm((prev) => ({ ...prev, drop: null }))}
          placeholder="e.g. BKC Tech Park"
        />

        {/* Confirms the route is the one they meant before the ride is created. */}
        {form.pickup && form.drop && (
          <div className="create-ride__preview">
            <RouteMap
              from={form.pickup.coordinates}
              to={form.drop.coordinates}
              fromName={form.pickup.name}
              toName={form.drop.name}
            />
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="departureTime">Departure time</label>
          <input
            id="departureTime"
            type="datetime-local"
            className="field__input"
            min={localInputValue(new Date())}
            value={form.departureTime}
            onChange={update('departureTime')}
            required
          />
          <span className="field__hint">Must be in the future.</span>
        </div>

        <div className="field create-ride__toggle">
          <label className="create-ride__check" htmlFor="approvalRequired">
            <input
              id="approvalRequired"
              type="checkbox"
              checked={form.approvalRequired}
              onChange={(event) =>
                setForm({ ...form, approvalRequired: event.target.checked })
              }
            />
            <span>
              <span className="field__label">Approve riders before they join</span>
              <span className="field__hint">
                Riders send a request with a short note, and you accept or reject each one.
                Leave this off to let anyone take a free seat instantly.
              </span>
            </span>
          </label>
        </div>

        <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create ride'}
        </button>
      </form>
    </div>
  );
}
