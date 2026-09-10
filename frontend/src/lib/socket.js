import { io } from 'socket.io-client';
import { getToken } from './api';

const URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/** One socket per ride chat session; the JWT is sent in the handshake. */
export function createSocket() {
  return io(URL, { auth: { token: getToken() }, autoConnect: true });
}
