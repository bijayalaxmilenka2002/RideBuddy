import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import './Navbar.css';

// Anchors that only exist on the landing page.
const SECTIONS = [
  ['#how-it-works', 'How It Works'],
  ['#why', 'Why RideBuddy'],
  ['#safety', 'Safety'],
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(() => window.scrollY > 24);

  const onLanding = pathname === '/';

  /**
   * The header sits transparently over the hero and turns solid once the page
   * scrolls, as on the live site. Away from the landing page it is always
   * solid, so it never floats over ordinary content.
   */
  useEffect(() => {
    if (!onLanding) return undefined;
    const onScroll = () => setScrolled(window.scrollY > 24);
    // Re-read after paint rather than synchronously, so arriving on the
    // landing page from a scrolled page still starts in the right state.
    const frame = requestAnimationFrame(onScroll);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [onLanding]);

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate('/');
  };

  const transparent = onLanding && !scrolled && !open;

  return (
    <header className={`navbar${transparent ? ' navbar--transparent' : ''}`}>
      <div className="container navbar__inner">
        <Link to="/" className="navbar__brand">
          <Logo />
          <span>RideBuddy</span>
        </Link>

        {onLanding && (
          <nav className="navbar__sections">
            {SECTIONS.map(([href, label]) => (
              <a key={href} href={href} className="navbar__section-link">
                {label}
              </a>
            ))}
          </nav>
        )}

        <button
          type="button"
          className="navbar__toggle"
          aria-expanded={open}
          aria-label="Toggle menu"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>

        <nav
          className={`navbar__links${open ? ' is-open' : ''}`}
          onClick={() => setOpen(false)}
        >
          {onLanding &&
            SECTIONS.map(([href, label]) => (
              <a key={href} href={href} className="navbar__link navbar__link--section">
                {label}
              </a>
            ))}

          {user ? (
            <>
              <NavLink to="/rides" end className="navbar__link">Find a ride</NavLink>
              <NavLink to="/rides/mine" className="navbar__link">My rides</NavLink>
              <NavLink to="/rides/new" className="navbar__link">Create ride</NavLink>
              <NavLink to="/profile" className="navbar__link navbar__user-link">
                {user.name}
              </NavLink>
              <button type="button" className="btn btn--ghost" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="navbar__link">Log In</NavLink>
              <Link to="/signup" className="btn btn--accent">Get Started Free</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
