import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../lib/api';
import './RouteMap.css';

/** Distances read better in km once past a kilometre. */
const formatDistance = (metres) =>
  metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`;

const formatDuration = (seconds) => {
  const total = Math.round(seconds / 60);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  return `${hours} h ${total % 60} min`;
};

/**
 * A coloured dot marker. Leaflet's default icon loads image files by relative
 * path, which breaks under a bundler, so the markers are plain HTML instead.
 */
const dotIcon = (color, letter) =>
  L.divIcon({
    className: 'route-map__marker-wrap',
    html: `<span class="route-map__marker" style="background:${color}">${letter}</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

/**
 * Shows pickup → drop on an OpenStreetMap map, with the real driving route
 * when the routing service can be reached and a straight line when it cannot.
 * Both `from` and `to` are [longitude, latitude], the order the API uses.
 */
export default function RouteMap({ from, to, fromName = 'Pickup', toName = 'Destination' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [summary, setSummary] = useState(null);
  const [degraded, setDegraded] = useState(false);

  // Create the map once, then tear it down on unmount so React's strict mode
  // double-render cannot leave two maps bound to the same container.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = L.map(containerRef.current, { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      // Attribution is a condition of using the free tiles.
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !from || !to) return undefined;

    // Leaflet takes [lat, lng]; the app stores [lng, lat].
    const start = [from[1], from[0]];
    const end = [to[1], to[0]];

    layer.clearLayers();
    L.marker(start, { icon: dotIcon('#059669', 'A'), title: fromName }).addTo(layer);
    L.marker(end, { icon: dotIcon('#f59e0b', 'B'), title: toName }).addTo(layer);

    const drawLine = (points, dashed) =>
      L.polyline(points, {
        color: '#0a7c6e',
        weight: 4,
        opacity: 0.85,
        dashArray: dashed ? '6 8' : undefined,
      }).addTo(layer);

    // Show a straight line immediately, then upgrade it to the real road route.
    const provisional = drawLine([start, end], true);
    map.fitBounds(L.latLngBounds([start, end]).pad(0.25));

    let cancelled = false;
    api
      .getRoute(from, to)
      .then(({ route }) => {
        if (cancelled) return;
        const points = route.geometry.map(([lng, lat]) => [lat, lng]);
        layer.removeLayer(provisional);
        const road = drawLine(points, false);
        map.fitBounds(road.getBounds().pad(0.15));
        setSummary({
          distance: formatDistance(route.distanceMeters),
          duration: formatDuration(route.durationSeconds),
        });
        setDegraded(false);
      })
      .catch(() => {
        // The map and the pins still work; only the road line is missing.
        if (!cancelled) setDegraded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [from, to, fromName, toName]);

  return (
    <div className="route-map">
      <div className="route-map__canvas" ref={containerRef} />

      <div className="route-map__legend">
        <span className="route-map__leg">
          <span className="route-map__swatch" style={{ background: '#059669' }} />
          {fromName}
        </span>
        <span className="route-map__leg">
          <span className="route-map__swatch" style={{ background: '#f59e0b' }} />
          {toName}
        </span>

        {summary && (
          <span className="route-map__summary">
            {summary.distance} · about {summary.duration}
          </span>
        )}
        {degraded && (
          <span className="route-map__summary route-map__summary--muted">
            Straight-line view — routing unavailable
          </span>
        )}
      </div>
    </div>
  );
}
