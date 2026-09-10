import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearToken, getToken, setToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  // Restore the session on load: the stored token may be expired or revoked.
  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(({ user: current }) => setUser(current))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback(({ user: nextUser, token }) => {
    setToken(token);
    setUser(nextUser);
    return nextUser;
  }, []);

  const login = useCallback(
    async (credentials) => persist(await api.login(credentials)),
    [persist]
  );

  const signup = useCallback(
    async (details) => persist(await api.signup(details)),
    [persist]
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, signup, logout }),
    [user, loading, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
