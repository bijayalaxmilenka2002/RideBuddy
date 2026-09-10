const BASE_URL = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'ridebuddy_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/** Thin fetch wrapper: attaches the JWT and unwraps the API's error shape. */
async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';

  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Request failed');
    error.status = response.status;
    error.details = payload?.error?.details;
    throw error;
  }
  return payload;
}

export const api = {
  signup: (data) => request('/auth/signup', { method: 'POST', body: data, auth: false }),
  login: (data) => request('/auth/login', { method: 'POST', body: data, auth: false }),
  me: () => request('/auth/me'),

  listRides: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== '' && value !== undefined)
    ).toString();
    return request(`/rides${query ? `?${query}` : ''}`);
  },
  getRide: (id) => request(`/rides/${id}`),
  createRide: (data) => request('/rides', { method: 'POST', body: data }),
  joinRide: (id) => request(`/rides/${id}/join`, { method: 'POST' }),
  cancelRide: (id) => request(`/rides/${id}/cancel`, { method: 'PATCH' }),
  completeRide: (id) => request(`/rides/${id}/complete`, { method: 'PATCH' }),
  setFare: (id, totalFare) => request(`/rides/${id}/fare`, { method: 'PATCH', body: { totalFare } }),
  listMessages: (id) => request(`/rides/${id}/messages`),
};
