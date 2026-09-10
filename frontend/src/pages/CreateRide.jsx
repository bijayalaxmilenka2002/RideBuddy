import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

// Shown next to the vehicle picker. The server derives the real value.
const CAPACITY_HINT = { BIKE: '2 riders (you + 1 co-rider)', AUTO: '3 riders (you + 2 co-riders)', CAB: '3 riders (you + 2 co-riders)' };

const EMPTY = {
  vehicleType: 'CAB',
  pickupName: '',
  pickupLng: '',
  pickupLat: '',
  dropName: '',
  dropLng: '',
  dropLat: '',
  departureTime: '',
};

/** Creating a ride makes you its admin, and takes the first seat. */
export default function CreateRide() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [details, setDetails] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Your browser does not support geolocation');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        setForm((prev) => ({
          ...prev,
          pickupLng: coords.longitude.toFixed(6),
          pickupLat: coords.latitude.toFixed(6),
        })),
      () => setError('Could not read your location')
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setDetails([]);
    setSubmitting(true);
    try {
      const { ride } = await api.createRide({
        vehicleType: form.vehicleType,
        pickupLocation: {
          name: form.pickupName,
          coordinates: [Number(form.pickupLng), Number(form.pickupLat)],
        },
        dropLocation: {
          name: form.dropName,
          coordinates: [Number(form.dropLng), Number(form.dropLat)],
        },
        departureTime: new Date(form.departureTime).toISOString(),
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

      <form className="card" style={{ maxWidth: 640 }} onSubmit={handleSubmit}>
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

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label" style={{ marginBottom: 'var(--space-3)' }}>Pickup</legend>
          <div className="field">
            <input className="field__input" placeholder="Pickup name" value={form.pickupName} onChange={update('pickupName')} required />
          </div>
          <div className="field" style={{ flexDirection: 'row', gap: 'var(--space-3)' }}>
            <input className="field__input" style={{ flex: 1 }} type="number" step="any" placeholder="Longitude" value={form.pickupLng} onChange={update('pickupLng')} required />
            <input className="field__input" style={{ flex: 1 }} type="number" step="any" placeholder="Latitude" value={form.pickupLat} onChange={update('pickupLat')} required />
          </div>
          <button type="button" className="btn btn--ghost" onClick={useMyLocation}>Use my current location</button>
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: 'var(--space-4) 0 0' }}>
          <legend className="field__label" style={{ marginBottom: 'var(--space-3)' }}>Destination</legend>
          <div className="field">
            <input className="field__input" placeholder="Destination name" value={form.dropName} onChange={update('dropName')} required />
          </div>
          <div className="field" style={{ flexDirection: 'row', gap: 'var(--space-3)' }}>
            <input className="field__input" style={{ flex: 1 }} type="number" step="any" placeholder="Longitude" value={form.dropLng} onChange={update('dropLng')} required />
            <input className="field__input" style={{ flex: 1 }} type="number" step="any" placeholder="Latitude" value={form.dropLat} onChange={update('dropLat')} required />
          </div>
        </fieldset>

        <div className="field">
          <label className="field__label" htmlFor="departureTime">Departure time</label>
          <input id="departureTime" type="datetime-local" className="field__input" value={form.departureTime} onChange={update('departureTime')} required />
        </div>

        <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create ride'}
        </button>
      </form>
    </div>
  );
}
