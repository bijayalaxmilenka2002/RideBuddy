import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form);
      navigate(location.state?.from || '/rides', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container auth">
      <form className="card auth__card" onSubmit={handleSubmit}>
        <h1 className="page__title">Log in to RideBuddy</h1>
        <p className="page__subtitle">Pick up where you left off.</p>

        {error && <p className="alert">{error}</p>}

        <div className="field">
          <label className="field__label" htmlFor="email">Email</label>
          <input id="email" type="email" className="field__input" value={form.email} onChange={update('email')} required />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="password">Password</label>
          <input id="password" type="password" className="field__input" value={form.password} onChange={update('password')} required />
        </div>

        <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>

        <p className="auth__switch">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
