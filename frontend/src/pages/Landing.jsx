import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bike,
  Car,
  CheckCircle2,
  ChevronDown,
  Clock,
  Leaf,
  MapPin,
  Shield,
  Star,
  Users,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import './Landing.css';

const STEPS = [
  {
    icon: MapPin,
    title: 'Set Your Route',
    description:
      'Enter your pickup point and destination. RideBuddy finds commuters on the same path.',
  },
  {
    icon: Users,
    title: 'Join or Create a Pool',
    description:
      'Browse open ride pools nearby or create one as the admin. Choose bike, auto, or cab.',
  },
  {
    icon: Car,
    title: 'Ride & Split the Fare',
    description:
      'Travel together, split the cost equally. Each person pays only their share — nothing more.',
  },
];

const BENEFITS = [
  {
    emoji: '💰',
    title: 'Save Up to 70%',
    description: 'Split cab fares with 2–3 co-riders. A ₹300 cab becomes ₹100 per person.',
  },
  {
    emoji: '⚡',
    title: 'Find Pools in Minutes',
    description: 'Real-time matching with commuters at the same pickup point heading your way.',
  },
  {
    emoji: '🌿',
    title: 'Reduce Carbon Footprint',
    description: 'Fewer cabs on the road means less traffic and lower CO₂ emissions per commuter.',
  },
  {
    emoji: '🔒',
    title: 'Verified Community',
    description: 'Ride only with verified users. Transparent profiles and ride history for trust.',
  },
  {
    emoji: '📍',
    title: 'Works Everywhere',
    description: 'Stations, airports, tech parks, colleges — wherever commuters gather.',
  },
  {
    emoji: '💬',
    title: 'Group Chat Included',
    description: 'Coordinate pickup details with your pool members in a private group chat.',
  },
];

const VEHICLES = [
  {
    icon: Bike,
    tone: 'amber',
    name: 'Bike',
    description: '1 admin + 1 co-rider. Best for short distances.',
    seats: 2,
  },
  {
    icon: Zap,
    tone: 'blue',
    name: 'Auto',
    description: '1 admin + 2 co-riders. Affordable city travel.',
    seats: 3,
  },
  {
    icon: Car,
    tone: 'green',
    name: 'Cab',
    description: '1 admin + 2 co-riders. Comfortable for all weather.',
    seats: 3,
  },
];

const SAFETY_POINTS = [
  'Verified user profiles with email confirmation',
  'Ride history visible to all pool members',
  'Admin-controlled ride creation and cancellation',
  'Private group chat only for confirmed members',
  'Real-time vacancy tracking — no overbooking',
  'Transparent fare splitting before booking',
];

const SAFETY_SCORES = [
  ['Verified Rides', '99.2%'],
  ['On-time Departures', '94.7%'],
  ['Positive Ratings', '97.1%'],
  ['Zero Overbooking', '100%'],
];

// Illustrative pools shown in the hero preview card, as on the live site.
const PREVIEW_RIDES = [
  { from: 'Andheri Station', to: 'BKC Tech Park', vehicle: 'Cab', minutes: 8, vacancies: 2 },
  { from: 'Hinjewadi Phase 1', to: 'Wakad Circle', vehicle: 'Auto', minutes: 12, vacancies: 1 },
  { from: 'Whitefield ITPL', to: 'Marathahalli', vehicle: 'Cab', minutes: 6, vacancies: 2 },
];

const AVATARS = [
  { initials: 'NK', color: '#0A7C6E' },
  { initials: 'PR', color: '#F59E0B' },
  { initials: 'SM', color: '#059669' },
  { initials: 'AK', color: '#7C3AED' },
  { initials: 'RV', color: '#0369A1' },
];

// Deterministic sprinkle of dots across the hero, matching the site's layout.
const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  left: `${(i * 8.3) % 100}%`,
  top: `${(i * 13.7 + 10) % 100}%`,
}));

export default function Landing() {
  const { user } = useAuth();
  const startHref = user ? '/rides' : '/signup';

  return (
    <div className="landing">
      {/* Hero ------------------------------------------------------------ */}
      <section className="hero gradient-hero">
        <span className="hero__blob hero__blob--accent" aria-hidden="true" />
        <span className="hero__blob hero__blob--primary" aria-hidden="true" />
        <div className="hero__particles" aria-hidden="true">
          {PARTICLES.map((style, i) => (
            <span key={i} className="hero__particle" style={style} />
          ))}
        </div>

        <div className="container hero__inner">
          <div className="hero__copy fade-in">
            <span className="hero__pill">
              <span className="hero__pill-dot vacancy-pulse" />
              247 active pools right now
            </span>

            <h1 className="text-hero-xl hero__title">
              Share the Ride. <span className="hero__title-accent">Split the Fare.</span> Travel
              Smarter.
            </h1>

            <p className="hero__subtitle">
              Find commuters heading your way from railway stations, tech parks, colleges, and
              airports. Pool a cab, split the cost — save up to 70% on every commute.
            </p>

            <div className="hero__actions">
              <Link to={startHref} className="btn btn--accent btn--lg">
                Start Pooling Free <ArrowRight size={18} />
              </Link>
              <a href="#how-it-works" className="btn btn--outline-light btn--lg">
                See How It Works
              </a>
            </div>

            <div className="hero__social">
              <div className="hero__avatars">
                {AVATARS.map(({ initials, color }) => (
                  <span key={initials} className="hero__avatar" style={{ background: color }}>
                    {initials}
                  </span>
                ))}
              </div>
              <div>
                <div className="hero__stars">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} size={12} fill="currentColor" />
                  ))}
                </div>
                <p className="hero__trust">Trusted by 12,400+ commuters</p>
              </div>
            </div>
          </div>

          {/* Live rides preview -------------------------------------------- */}
          <div className="hero__preview slide-up">
            <div className="card shadow-elevated">
              <div className="preview__head">
                <div>
                  <h3 className="preview__title">Live Rides Near You</h3>
                  <p className="preview__sub">Updated just now</p>
                </div>
                <span className="preview__live">
                  <span className="preview__live-dot vacancy-pulse" />
                  Live
                </span>
              </div>

              <div className="preview__list">
                {PREVIEW_RIDES.map((ride, index) => (
                  <div
                    key={ride.from}
                    className={`preview__ride${index === 0 ? ' preview__ride--active' : ''}`}
                  >
                    <div className="preview__row">
                      <span className="preview__place">
                        <MapPin size={12} className="icon--success" />
                        {ride.from}
                      </span>
                      <span className="preview__vehicle">{ride.vehicle}</span>
                    </div>
                    <span className="preview__place preview__place--muted">
                      <MapPin size={12} className="icon--accent" />
                      {ride.to}
                    </span>
                    <div className="preview__row">
                      <span className="preview__meta">
                        <Clock size={11} />
                        Departs in {ride.minutes} mins
                      </span>
                      <span
                        className={
                          ride.vacancies > 1 ? 'preview__seats' : 'preview__seats preview__seats--low'
                        }
                      >
                        {ride.vacancies} {ride.vacancies === 1 ? 'vacancy' : 'vacancies'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <Link to={startHref} className="btn btn--primary btn--block preview__cta">
                Join a Ride Pool <ArrowRight size={14} />
              </Link>
            </div>

            <div className="hero__stats">
              <div className="card hero__stat">
                <p className="hero__stat-value font-tabular icon--success">₹180</p>
                <p className="hero__stat-label">Avg. savings/day</p>
              </div>
              <div className="card hero__stat">
                <p className="hero__stat-value font-tabular icon--primary">4.2 kg</p>
                <p className="hero__stat-label">CO₂ saved/week</p>
              </div>
              <div className="card hero__stat">
                <p className="hero__stat-value font-tabular icon--accent">&lt; 3 min</p>
                <p className="hero__stat-label">To find a pool</p>
              </div>
            </div>
          </div>
        </div>

        <div className="hero__scroll" aria-hidden="true">
          <span>Scroll to explore</span>
          <ChevronDown size={16} className="hero__chevron" />
        </div>
      </section>

      {/* How it works ---------------------------------------------------- */}
      <section id="how-it-works" className="section section--white">
        <div className="container">
          <header className="section__head">
            <span className="section-label">Simple Process</span>
            <h2 className="text-hero-md section__title">How RideBuddy Works</h2>
            <p className="section__lede">
              Three steps to smarter, cheaper commuting with people heading your way.
            </p>
          </header>

          <div className="steps">
            {STEPS.map(({ icon: Icon, title, description }, index) => (
              <article key={title} className="card card--hover step">
                <div className="step__top">
                  <span className="step__icon gradient-primary">
                    <Icon size={22} color="#fff" />
                  </span>
                  <span className="step__number">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <div>
                  <h3 className="step__title">{title}</h3>
                  <p className="step__text">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Why RideBuddy --------------------------------------------------- */}
      <section id="why" className="section">
        <div className="container">
          <header className="section__head">
            <span className="section-label">Why Choose Us</span>
            <h2 className="text-hero-md section__title">Built for Real Commuters</h2>
            <p className="section__lede">
              RideBuddy solves the daily commute problem — expensive solo rides from crowded
              transit hubs.
            </p>
          </header>

          <div className="benefits">
            {BENEFITS.map(({ emoji, title, description }) => (
              <article key={title} className="card card--hover benefit">
                <span className="benefit__emoji" aria-hidden="true">{emoji}</span>
                <h3 className="benefit__title">{title}</h3>
                <p className="benefit__text">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Vehicle options -------------------------------------------------- */}
      <section className="section section--white">
        <div className="container">
          <header className="section__head">
            <span className="section-label">Vehicle Options</span>
            <h2 className="text-hero-md section__title">Choose Your Ride Type</h2>
            <p className="section__lede">
              Capacity is enforced by the backend — no overrides, no confusion.
            </p>
          </header>

          <div className="vehicles">
            {VEHICLES.map(({ icon: Icon, tone, name, description, seats }) => (
              <article key={name} className="card card--hover vehicle">
                <span className={`vehicle__icon vehicle__icon--${tone}`}>
                  <Icon size={26} />
                </span>
                <div>
                  <h3 className="vehicle__name">{name}</h3>
                  <p className="vehicle__text">{description}</p>
                </div>
                <span className="vehicle__seats">
                  <Users size={13} className="icon--primary" />
                  {seats} passengers max
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Safety ----------------------------------------------------------- */}
      <section id="safety" className="section">
        <div className="container safety">
          <div>
            <span className="section-label">Trust &amp; Safety</span>
            <h2 className="text-hero-md safety__title">Ride with Confidence</h2>
            <p className="safety__lede">
              RideBuddy is built on transparency. Every ride has a verified admin, a fixed capacity,
              and a private chat for coordination. You always know who you&#39;re riding with.
            </p>
            <ul className="safety__list">
              {SAFETY_POINTS.map((point) => (
                <li key={point} className="safety__item">
                  <CheckCircle2 size={18} className="icon--primary safety__check" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card safety__score">
            <div className="safety__score-head">
              <span className="safety__shield gradient-primary">
                <Shield size={20} color="#fff" />
              </span>
              <div>
                <h3 className="safety__score-title">RideBuddy Safety Score</h3>
                <p className="safety__score-sub">Based on 12,400+ rides</p>
              </div>
            </div>
            {SAFETY_SCORES.map(([label, value]) => (
              <div key={label} className="safety__row">
                <span className="safety__row-label">{label}</span>
                <span className="safety__row-value">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing call to action ------------------------------------------- */}
      <section className="section gradient-hero cta">
        <div className="container cta__inner">
          <span className="cta__pill">
            <Leaf size={14} className="icon--accent" />
            Join 12,400+ smart commuters
          </span>
          <h2 className="text-hero-xl cta__title">Ready to Split the Fare?</h2>
          <p className="cta__lede">
            Create a free account, find your first ride pool, and start saving money on every
            commute — starting today.
          </p>
          <div className="cta__actions">
            <Link to={startHref} className="btn btn--accent btn--lg">
              Create Free Account <ArrowRight size={18} />
            </Link>
            <Link to={user ? '/rides' : '/login'} className="btn btn--outline-light btn--lg">
              Find a Ride Pool
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__brand">
            <Logo size={32} iconSize={16} radius="var(--radius-md)" />
            <span>RideBuddy</span>
          </div>
          <p className="footer__line">
            Share the ride. Split the fare. Travel smarter. © {new Date().getFullYear()} RideBuddy.
          </p>
          <div className="footer__links">
            <Link to="/signup">Sign Up</Link>
            <Link to="/login">Log In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
