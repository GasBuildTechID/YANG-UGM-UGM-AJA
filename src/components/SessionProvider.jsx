'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const SessionContext = createContext({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function SessionProvider({ children }) {
  const supabase = createClient();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(currentUser) {
    if (!currentUser) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from('users')
      .select('id, display_name, email, role')
      .eq('id', currentUser.id)
      .maybeSingle();
    setProfile(data || { id: currentUser.id, display_name: 'Pengguna', role: 'user' });
  }

  useEffect(() => {
    let active = true;

    supabase.auth
      .getUser()
      .then(async (res) => {
        if (!active) return;
        const currentUser = res?.data?.user ?? null;
        setUser(currentUser);
        await loadProfile(currentUser);
        if (active) setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    const listener = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      await loadProfile(currentUser);
    });
    const subscription = listener?.data?.subscription;

    return () => {
      active = false;
      subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshProfile = async () => {
    const res = await supabase.auth.getUser();
    await loadProfile(res?.data?.user ?? null);
  };

  return (
    <SessionContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
