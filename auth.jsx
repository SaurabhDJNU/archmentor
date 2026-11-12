import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as api from './api.js';

const AuthCtx = createContext({ user: null, profile: null, loading: true, refresh: () => {} });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const u = await api.getUser();
      setUser(u);
      setProfile(u ? await api.getMyProfile() : null);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return api.onAuthChange(() => { refresh(); });
  }, [refresh]);

  return <AuthCtx.Provider value={{ user, profile, loading, refresh }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
