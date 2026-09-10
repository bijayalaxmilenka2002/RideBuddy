import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate('/');
  };

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <Link to="/" className="navbar__brand" onClick={() => setOpen(false)}>
          Ride<span>Buddy</span>
        </Link>

        <button
          type="button"
          className="navbar__toggle"
          aria-expanded={open}
          aria-label="Toggle navigation"
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`navbar__links ${open ? 'is-open' : ''}`} onClick={() => setOpen(false)}>
          <NavLink to="/rides" className="navbar__link">Find a ride</NavLink>
          {user ? (
            <>
              <NavLink to="/rides/new" className="navbar__link">Create ride</NavLink>
              <span className="navbar__user">{user.name}</span>
              <button type="button" className="btn btn--secondary" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="navbar__link">Log in</NavLink>
              <Link to="/signup" className="btn btn--primary">Sign up</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
