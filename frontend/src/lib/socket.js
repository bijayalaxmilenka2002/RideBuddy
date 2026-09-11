import { io } from 'socket.io-client';
import { getToken } from './api';

/**
 * Where the Socket.IO server lives.
 *
 * VITE_API_URL when the API is on another origin (the usual deployed setup).
 * Otherwise the page's own origin, so the app works when the API is served
 * from the same host, and so `npm run dev` goes through the Vite proxy, which
 * forwards /socket.io to the backend with websocket upgrades enabled.
 * Never a hard-coded localhost: that breaks every deployment.
 */
const URL = import.meta.env.VITE_API_URL || window.location.origin;

/** One socket per ride chat session; the JWT is sent in the handshake. */
export function createSocket() {
  return io(URL, { auth: { token: getToken() }, autoConnect: true });
}
