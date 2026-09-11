import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import './RideRequests.css';

/**
 * The admin's queue for a ride that screens its riders. Accepting seats the
 * rider server-side, so the parent is handed the refreshed ride.
 */
export default function RideRequests({ rideId, onRideUpdated }) {
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .listRideRequests(rideId)
      .then(({ requests: rows }) => {
        if (cancelled) return;
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
  }, [rideId, reloadKey]);

  const respond = async (requestId, accept) => {
    setBusyId(requestId);
    setError('');
    try {
      const result = accept
        ? await api.acceptRequest(rideId, requestId)
        : await api.rejectRequest(rideId, requestId);
      // Accepting changes the ride (a new member, possibly LOCKED).
      if (result.ride) onRideUpdated?.(result.ride);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err.message);
      // The queue may have moved on, so re-read it either way.
      setReloadKey((key) => key + 1);
    } finally {
      setBusyId(null);
    }
  };

  if (status === 'loading') return <p className="state">Loading requests…</p>;

  const pending = requests.filter((request) => request.status === 'PENDING');
  const answered = requests.filter((request) => request.status !== 'PENDING');

  return (
    <section className="card">
      <h2 className="ride-detail__heading">
        Join requests
        {pending.length > 0 && <span className="requests__count">{pending.length}</span>}
      </h2>

      {error && <p className="alert">{error}</p>}

      {pending.length === 0 && answered.length === 0 && (
        <p className="field__hint">No one has asked to join yet.</p>
      )}

      {pending.length > 0 && (
        <ul className="requests__list">
          {pending.map((request) => (
            <li key={request._id} className="requests__item">
              <div className="requests__who">
                <span className="requests__name">{request.rider?.name}</span>
                {request.message && <p className="requests__message">“{request.message}”</p>}
                <span className="requests__time">Asked {formatDateTime(request.createdAt)}</span>
              </div>
              <div className="requests__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={busyId === request._id}
                  onClick={() => respond(request._id, true)}
                >
                  <Check size={14} /> Accept
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={busyId === request._id}
                  onClick={() => respond(request._id, false)}
                >
                  <X size={14} /> Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {answered.length > 0 && (
        <ul className="requests__list requests__list--answered">
          {answered.map((request) => (
            <li key={request._id} className="requests__item">
              <span className="requests__name">{request.rider?.name}</span>
              <span className={`badge badge--${request.status.toLowerCase()}`}>{request.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
