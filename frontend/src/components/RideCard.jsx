import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { formatDateTime, pluralize } from '../lib/format';
import './RideCard.css';

export default function RideCard({ ride, onJoin, joining }) {
  const joinable = ride.status === 'OPEN' && ride.vacancies > 0 && !ride.isMember;

  return (
    <article className="ride-card">
      <header className="ride-card__top">
        <span className="badge badge--vehicle">{ride.vehicleType}</span>
        <StatusBadge status={ride.status} />
      </header>

      <div className="ride-card__route">
        <p className="ride-card__place">{ride.pickupLocation.name}</p>
        <span className="ride-card__arrow" aria-hidden="true">↓</span>
        <p className="ride-card__place">{ride.dropLocation.name}</p>
      </div>

      <dl className="ride-card__meta">
        <div>
          <dt>Departs</dt>
          <dd>{formatDateTime(ride.departureTime)}</dd>
        </div>
        <div>
          <dt>Admin</dt>
          <dd>{ride.admin?.name}</dd>
        </div>
        <div>
          <dt>Passengers</dt>
          <dd>{pluralize(ride.members.length, 'Passenger')}</dd>
        </div>
        <div>
          <dt>Vacancy</dt>
          <dd className="ride-card__vacancy">
            {ride.vacancies > 0 ? `${pluralize(ride.vacancies, 'Vacancy', 'Vacancies')} Left` : 'Full'}
          </dd>
        </div>
      </dl>

      <footer className="ride-card__actions">
        <Link to={`/rides/${ride._id}`} className="btn btn--secondary">
          View details
        </Link>
        {ride.isMember ? (
          <span className="ride-card__joined">{ride.isAdmin ? 'You are the admin' : 'Joined'}</span>
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            disabled={!joinable || joining}
            onClick={() => onJoin?.(ride)}
          >
            {joining ? 'Joining…' : 'Join Ride'}
          </button>
        )}
      </footer>
    </article>
  );
}
