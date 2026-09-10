import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Landing.css';

const FEATURES = [
  {
    title: 'Find riders going your way',
    description: 'Discover ride pools starting near your pickup point and heading to your destination.',
  },
  {
    title: 'Split the fare transparently',
    description: 'The total fare is divided equally between everyone in the pool, with no hidden maths.',
  },
  {
    title: 'Coordinate in the ride chat',
    description: 'A private chat room for every ride, so the pool can agree on an exact meeting point.',
  },
];

const VEHICLES = [
  { type: 'Bike', seats: '2 riders', detail: '1 admin + 1 co-rider' },
  { type: 'Auto', seats: '3 riders', detail: '1 admin + 2 co-riders' },
  { type: 'Cab', seats: '3 riders', detail: '1 admin + 2 co-riders' },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <p className="hero__eyebrow">Ride pooling &amp; fare splitting</p>
          <h1 className="hero__title">Share the ride. Split the fare.</h1>
          <p className="hero__subtitle">
            Travelling the same way as someone else? Join a ride pool, share a bike, auto or cab,
            and pay only your part of the fare.
          </p>
          <div className="hero__actions">
            <Link to="/rides" className="btn btn--primary">Find a ride</Link>
            <Link to={user ? '/rides/new' : '/signup'} className="btn btn--secondary">
              {user ? 'Create a ride' : 'Get started'}
            </Link>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="grid">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="card">
              <h2 className="feature__title">{feature.title}</h2>
              <p className="feature__text">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container section">
        <h2 className="section__title">Choose your vehicle</h2>
        <div className="grid">
          {VEHICLES.map((vehicle) => (
            <article key={vehicle.type} className="card vehicle">
              <span className="badge badge--vehicle">{vehicle.type.toUpperCase()}</span>
              <p className="vehicle__seats">{vehicle.seats}</p>
              <p className="feature__text">{vehicle.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
