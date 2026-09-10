import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [details, setDetails] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setDetails([]);
    setSubmitting(true);
    try {
      await signup(form);
      navigate('/rides', { replace: true });
    } catch (err) {
      setError(err.message);
      setDetails(err.details || []);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container auth">
      <form className="card auth__card" onSubmit={handleSubmit}>
        <h1 className="page__title">Create your account</h1>
        <p className="page__subtitle">Start pooling rides and splitting fares.</p>

        {error && (
          <div className="alert">
            <p>{error}</p>
            {details.map((detail) => (
              <p key={detail.field}>{detail.field}: {detail.message}</p>
            ))}
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="name">Full name</label>
          <input id="name" className="field__input" value={form.name} onChange={update('name')} required />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="email">Email</label>
          <input id="email" type="email" className="field__input" value={form.email} onChange={update('email')} required />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="phone">Phone</label>
          <input id="phone" className="field__input" value={form.phone} onChange={update('phone')} required />
          <span className="field__hint">10 digits, no country code.</span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="password">Password</label>
          <input id="password" type="password" className="field__input" value={form.password} onChange={update('password')} required />
          <span className="field__hint">At least 8 characters.</span>
        </div>

        <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>

        <p className="auth__switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
