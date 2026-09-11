import { Link } from 'react-router-dom';
import { Clock, MapPin, Users } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { formatDateTime, pluralize } from '../lib/format';
import './RideCard.css';

/**
 * Route rows follow the same shape the marketing site uses in its "Live Rides
 * Near You" card: a green pin for pickup, an amber pin for the drop, then the
 * departure time and the remaining seats.
 */
export default function RideCard({ ride, onJoin, joining }) {
  const joinable = ride.status === 'OPEN' && ride.vacancies > 0 && !ride.isMember;
  const seatsLow = ride.vacancies === 1;

  return (
    <article className="ride-card">
      <header className="ride-card__top">
        <span className="badge badge--vehicle">{ride.vehicleType}</span>
        <StatusBadge status={ride.status} />
      </header>

      <div className="ride-card__route">
        <p className="ride-card__place">
          <MapPin size={15} className="ride-card__pin ride-card__pin--from" />
          {ride.pickupLocation.name}
        </p>
        <p className="ride-card__place ride-card__place--to">
          <MapPin size={15} className="ride-card__pin ride-card__pin--to" />
          {ride.dropLocation.name}
        </p>
      </div>

      <div className="ride-card__meta">
        <span className="ride-card__meta-item">
          <Clock size={13} />
          {formatDateTime(ride.departureTime)}
        </span>
        <span className="ride-card__meta-item">
          <Users size={13} />
          {pluralize(ride.members.length, 'passenger')} · {ride.admin?.name}
        </span>
        <span
          className={`ride-card__vacancy${
            ride.vacancies === 0
              ? ' ride-card__vacancy--full'
              : seatsLow
                ? ' ride-card__vacancy--low'
                : ''
          }`}
        >
          {ride.vacancies > 0
            ? `${pluralize(ride.vacancies, 'vacancy', 'vacancies')} left`
            : 'Full'}
        </span>
      </div>

      <footer className="ride-card__actions">
        {ride.isMember && (
          <span className="ride-card__joined">
            {ride.isAdmin ? 'You are the admin' : 'Joined'}
          </span>
        )}
        <Link to={`/rides/${ride._id}`} className="btn btn--secondary">
          View details
        </Link>
        {!ride.isMember && (
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
