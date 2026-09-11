import { useEffect, useRef, useState } from 'react';
import { Crosshair, Loader2, MapPin, X } from 'lucide-react';
import { api } from '../lib/api';
import './PlaceSearch.css';

/**
 * Type-ahead place picker backed by our /api/places/search proxy.
 *
 * Calls `onSelect({ name, coordinates: [lng, lat] })` when a place is chosen.
 * Typing is debounced, because every keystroke would otherwise be a request to
 * a free public geocoder.
 */
export default function PlaceSearch({
  label,
  value,
  onSelect,
  onClear,
  placeholder = 'Search for a place…',
  showUseMyLocation = false,
  id,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const boxRef = useRef(null);

  // Close the dropdown when the click lands outside this component.
  useEffect(() => {
    const onDocumentClick = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, []);

  /**
   * Debounced lookup. Everything, including clearing a short query, happens in
   * the timer callback rather than synchronously in the effect body, so a
   * keystroke cannot cascade renders.
   */
  useEffect(() => {
    const term = query.trim();
    let cancelled = false;

    const timer = setTimeout(() => {
      if (term.length < 2) {
        setResults([]);
        setError('');
        setOpen(false);
        return;
      }

      setLoading(true);
      api
        .searchPlaces(term)
        .then(({ places }) => {
          if (cancelled) return;
          setResults(places);
          setError(places.length ? '' : 'No places found. Try a different spelling.');
          setOpen(true);
        })
        .catch((err) => {
          if (cancelled) return;
          setResults([]);
          setError(err.message);
          setOpen(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const choose = (place) => {
    onSelect(place);
    setQuery('');
    setResults([]);
    setOpen(false);
    setError('');
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Your browser does not support location');
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          // Turn the raw fix into a name, so the ride reads sensibly.
          const { place } = await api.reverseGeocode(coords.longitude, coords.latitude);
          choose(place);
        } catch {
          // Still usable without a name: keep the exact coordinates.
          choose({ name: 'My current location', coordinates: [coords.longitude, coords.latitude] });
        } finally {
          setLocating(false);
        }
      },
      () => {
        setError('Could not read your location. Check the browser permission.');
        setLocating(false);
      }
    );
  };

  return (
    <div className="field place-search" ref={boxRef}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
      )}

      {value ? (
        <div className="place-search__chosen">
          <MapPin size={15} className="place-search__pin" />
          <span className="place-search__chosen-name">{value.name}</span>
          <button
            type="button"
            className="place-search__clear"
            aria-label="Change place"
            onClick={() => onClear?.()}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="place-search__control">
          <input
            id={id}
            className="field__input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => results.length && setOpen(true)}
            placeholder={placeholder}
            autoComplete="off"
          />
          {loading && <Loader2 size={16} className="place-search__spinner" />}
        </div>
      )}

      {showUseMyLocation && !value && (
        <button
          type="button"
          className="btn btn--ghost place-search__locate"
          onClick={useMyLocation}
          disabled={locating}
        >
          <Crosshair size={14} />
          {locating ? 'Locating…' : 'Use my current location'}
        </button>
      )}

      {open && !value && (results.length > 0 || error) && (
        <ul className="place-search__results">
          {error && <li className="place-search__error">{error}</li>}
          {results.map((place) => (
            <li key={`${place.label}-${place.coordinates.join(',')}`}>
              <button type="button" className="place-search__result" onClick={() => choose(place)}>
                <MapPin size={14} className="place-search__pin" />
                <span>
                  <span className="place-search__name">{place.name}</span>
                  <span className="place-search__label">{place.label}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
