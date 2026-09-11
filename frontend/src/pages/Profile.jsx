import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, CheckCircle2, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/Loader';
import ErrorState from '../components/ErrorState';
import './Profile.css';

/** Your account: details you can edit, your ride counts, and a password change. */
export default function Profile() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [details, setDetails] = useState({ name: '', phone: '' });
  const [detailsState, setDetailsState] = useState({ busy: false, error: '', ok: '' });

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [passwordState, setPasswordState] = useState({ busy: false, error: '', ok: '' });

  useEffect(() => {
    let cancelled = false;
    api
      .getProfile()
      .then(({ user: current, stats: counts }) => {
        if (cancelled) return;
        setDetails({ name: current.name, phone: current.phone });
        setStats(counts);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.message);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const saveDetails = async (event) => {
    event.preventDefault();
    setDetailsState({ busy: true, error: '', ok: '' });
    try {
      await api.updateProfile(details);
      // Keep the name in the navbar in step with what was just saved.
      await refreshUser();
      setDetailsState({ busy: false, error: '', ok: 'Profile updated' });
    } catch (err) {
      setDetailsState({ busy: false, error: err.message, ok: '' });
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setPasswordState({ busy: true, error: '', ok: '' });
    try {
      await api.changePassword(passwords);
      setPasswords({ currentPassword: '', newPassword: '' });
      setPasswordState({ busy: false, error: '', ok: 'Password updated' });
    } catch (err) {
      setPasswordState({ busy: false, error: err.message, ok: '' });
    }
  };

  if (status === 'loading') return <Loader label="Loading your profile…" />;
  if (status === 'error') {
    return <ErrorState message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />;
  }

  const COUNTS = [
    { icon: Car, label: 'Rides created', value: stats.ridesCreated },
    { icon: Users, label: 'Rides joined', value: stats.ridesJoined },
    { icon: CheckCircle2, label: 'Completed', value: stats.ridesCompleted },
  ];

  return (
    <div className="container page profile">
      <header className="page__header">
        <div>
          <h1 className="page__title">Your profile</h1>
          <p className="page__subtitle">{user?.email}</p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            logout();
            navigate('/');
          }}
        >
          Log out
        </button>
      </header>

      <div className="profile__stats">
        {COUNTS.map(({ icon: Icon, label, value }) => (
          <div key={label} className="card profile__stat">
            <span className="profile__stat-icon gradient-primary">
              <Icon size={18} color="#fff" />
            </span>
            <div>
              <p className="profile__stat-value font-tabular">{value}</p>
              <p className="profile__stat-label">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="profile__forms">
        <form className="card" onSubmit={saveDetails}>
          <h2 className="profile__heading">Your details</h2>

          {detailsState.error && <p className="alert">{detailsState.error}</p>}
          {detailsState.ok && <p className="notice">{detailsState.ok}</p>}

          <div className="field">
            <label className="field__label" htmlFor="name">Full name</label>
            <input
              id="name"
              className="field__input"
              value={details.name}
              onChange={(e) => setDetails({ ...details, name: e.target.value })}
              minLength={2}
              maxLength={80}
              required
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="phone">Phone</label>
            <input
              id="phone"
              className="field__input"
              value={details.phone}
              onChange={(e) => setDetails({ ...details, phone: e.target.value })}
              pattern="[0-9]{10}"
              title="10 digits"
              required
            />
            <span className="field__hint">10 digits. Shared only with people on your rides.</span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="email">Email</label>
            <input id="email" className="field__input" value={user?.email || ''} disabled />
            <span className="field__hint">
              Your email is your sign-in and cannot be changed here.
            </span>
          </div>

          <button type="submit" className="btn btn--primary" disabled={detailsState.busy}>
            {detailsState.busy ? 'Saving…' : 'Save changes'}
          </button>
        </form>

        <form className="card" onSubmit={savePassword}>
          <h2 className="profile__heading">Change password</h2>

          {passwordState.error && <p className="alert">{passwordState.error}</p>}
          {passwordState.ok && <p className="notice">{passwordState.ok}</p>}

          <div className="field">
            <label className="field__label" htmlFor="currentPassword">Current password</label>
            <input
              id="currentPassword"
              type="password"
              className="field__input"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              className="field__input"
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              minLength={8}
              autoComplete="new-password"
              required
            />
            <span className="field__hint">At least 8 characters.</span>
          </div>

          <button type="submit" className="btn btn--primary" disabled={passwordState.busy}>
            {passwordState.busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
