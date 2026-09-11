import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import ChatPanel from '../components/ChatPanel';
import Loader from '../components/Loader';
import ErrorState from '../components/ErrorState';
import { formatDateTime, formatFare, pluralize } from '../lib/format';
import './RideDetail.css';

export default function RideDetail() {
  const { id } = useParams();
  const [ride, setRide] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [fareInput, setFareInput] = useState('');
  const [busy, setBusy] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((key) => key + 1);

  useEffect(() => {
    let cancelled = false;
    api
      .getRide(id)
      .then(({ ride: result }) => {
        if (cancelled) return;
        setRide(result);
        setFareInput(result.totalFare ?? '');
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
  }, [id, reloadKey]);

  /** Runs an admin/member action and folds the fresh ride back into state. */
  const run = async (action) => {
    setBusy(true);
    setActionError('');
    try {
      const { ride: updated } = await action();
      setRide(updated);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') return <Loader label="Loading ride…" />;
  if (status === 'error') return <ErrorState message={error} onRetry={load} />;

  const closed = ride.status === 'CANCELLED' || ride.status === 'COMPLETED';

  return (
    <div className="container page ride-detail">
      <header className="page__header">
        <div>
          <h1 className="page__title">
            {ride.pickupLocation.name} → {ride.dropLocation.name}
          </h1>
          <p className="page__subtitle">Departs {formatDateTime(ride.departureTime)}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <span className="badge badge--vehicle">{ride.vehicleType}</span>
          <StatusBadge status={ride.status} />
        </div>
      </header>

      {actionError && <p className="alert">{actionError}</p>}

      <div className="ride-detail__layout">
        <div className="ride-detail__main">
          <section className="card">
            <h2 className="ride-detail__heading">Ride details</h2>
            <dl className="ride-detail__facts">
              <div><dt>Pickup</dt><dd>{ride.pickupLocation.name}</dd></div>
              <div><dt>Drop</dt><dd>{ride.dropLocation.name}</dd></div>
              <div><dt>Admin</dt><dd>{ride.admin.name}</dd></div>
              <div><dt>Seats</dt><dd>{ride.members.length} / {ride.maxCapacity}</dd></div>
              <div>
                <dt>Vacancies</dt>
                <dd>{ride.vacancies > 0 ? pluralize(ride.vacancies, 'seat') + ' left' : 'Full'}</dd>
              </div>
            </dl>
          </section>

          <section className="card">
            <h2 className="ride-detail__heading">Passengers</h2>
            <ul className="ride-detail__members">
              {ride.members.map((member) => (
                <li key={member._id}>
                  <div className="ride-detail__member">
                    <span>{member.name}</span>
                    {/* The API sends contact details to pool members only. */}
                    {member.phone && (
                      <a className="ride-detail__contact" href={`tel:${member.phone}`}>
                        {member.phone}
                      </a>
                    )}
                  </div>
                  {String(member._id) === String(ride.admin._id) && (
                    <span className="badge">ADMIN</span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {ride.isMember && <ChatPanel rideId={ride._id} />}
        </div>

        <aside className="ride-detail__side">
          <section className="card">
            <h2 className="ride-detail__heading">Fare split</h2>
            {ride.fare.totalFare === null ? (
              <p className="field__hint">
                The admin has not entered the final fare yet.
              </p>
            ) : (
              <dl className="ride-detail__facts">
                <div><dt>Total fare</dt><dd>{formatFare(ride.fare.totalFare)}</dd></div>
                <div><dt>Passengers</dt><dd>{ride.fare.passengers}</dd></div>
                <div><dt>Your share</dt><dd className="ride-detail__share">{formatFare(ride.fare.individualFare)}</dd></div>
              </dl>
            )}

            {ride.isAdmin && !closed && (
              <form
                className="ride-detail__fare-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  run(() => api.setFare(ride._id, Number(fareInput)));
                }}
              >
                <label className="field__label" htmlFor="fare">Enter the actual fare</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  <input
                    id="fare"
                    type="number"
                    min="0"
                    step="0.01"
                    className="field__input"
                    style={{ flex: 1 }}
                    value={fareInput}
                    onChange={(event) => setFareInput(event.target.value)}
                    required
                  />
                  <button type="submit" className="btn btn--primary" disabled={busy}>Save</button>
                </div>
              </form>
            )}
          </section>

          {/* Admin-only controls. The server enforces this too. */}
          {ride.isAdmin && (
            <section className="card">
              <h2 className="ride-detail__heading">Admin controls</h2>

              {ride.bookingLinks && (
                <>
                  <p className="field__hint" style={{ marginBottom: 'var(--space-3)' }}>
                    These open the provider&apos;s own app or site with the route pre-filled where
                    supported. RideBuddy does not book or price the ride itself.
                  </p>
                  <div className="ride-detail__booking">
                    {ride.bookingLinks.map((link) => (
                      <a
                        key={link.provider}
                        className="btn btn--secondary"
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {link.label}
                        {!link.prefillsRoute && <span className="field__hint"> (no route prefill)</span>}
                      </a>
                    ))}
                  </div>
                </>
              )}

              {!closed && (
                <div className="ride-detail__admin-actions">
                  <button
                    type="button"
                    className="btn btn--secondary"
                    disabled={busy}
                    onClick={() => run(() => api.completeRide(ride._id))}
                  >
                    Mark completed
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    disabled={busy}
                    onClick={() => run(() => api.cancelRide(ride._id))}
                  >
                    Cancel ride
                  </button>
                </div>
              )}
            </section>
          )}

          {!ride.isMember && ride.status === 'OPEN' && ride.vacancies > 0 && (
            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={busy}
              onClick={() => run(() => api.joinRide(ride._id))}
            >
              Join this ride
            </button>
          )}

          {/* A co-rider can give up their seat; the admin cancels instead. */}
          {ride.isMember && !ride.isAdmin && !closed && (
            <button
              type="button"
              className="btn btn--ghost btn--block"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Leave this ride? Your seat is freed for someone else.')) {
                  run(() => api.leaveRide(ride._id));
                }
              }}
            >
              Leave this ride
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
