/**
 * AuthProvider – React context for authentication state (Supabase)
 *
 * Wraps the app and provides `useAuth()` hook to any component:
 *   - user / profile / isAuthenticated / isLoading
 *   - login / register / logout helpers
 *
 * All auth state is managed by Supabase. The session is persisted
 * automatically in cookies (via @supabase/ssr) — no manual
 * localStorage token management is needed.
 */
'use client';

import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/* ───── Public profile shape (from profiles table) ───── */
export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  roles: string[];
}

/* ───── Context shape ───── */
interface AuthContextValue {
  /** Raw Supabase auth user (null when signed out) */
  authUser: User | null;
  /** Public profile from profiles table */
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (email: string, password: string, displayName?: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  /** Re-fetch the profile from the profiles table */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/* ───── Helpers ───── */
const supabase = createClient();

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, roles')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as UserProfile;
}

/* ───── Provider ───── */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, restore session + subscribe to auth changes
  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setAuthUser(session.user);
        const profile = await fetchProfile(session.user.id);
        setUser(profile);
      }
      setIsLoading(false);
    });

    // 2. Listen for future auth events (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setAuthUser(session.user);
        const profile = await fetchProfile(session.user.id);
        setUser(profile);
      } else {
        setAuthUser(null);
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<UserProfile> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const profile = await fetchProfile(data.user.id);
    if (!profile) throw new Error('Profile not found');
    return profile;
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName?: string): Promise<UserProfile> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName || null },
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error('Registration failed');
      // The DB trigger creates the profile — poll with exponential backoff
      const delays = [300, 600, 1200];
      let profile: UserProfile | null = null;
      for (const ms of delays) {
        profile = await fetchProfile(data.user.id);
        if (profile) break;
        await new Promise((r) => setTimeout(r, ms));
      }
      // One final attempt after the last delay
      if (!profile) profile = await fetchProfile(data.user.id);
      if (!profile) throw new Error('Profile creation pending — please sign in.');
      return profile;
    },
    []
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (currentUser) {
      setAuthUser(currentUser);
      const profile = await fetchProfile(currentUser.id);
      setUser(profile);
    } else {
      setAuthUser(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      authUser,
      user,
      isAuthenticated: !!authUser,
      isLoading,
      login,
      register,
      logout,
      refreshUser,
    }),
    [authUser, user, isLoading, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ───── Hook ───── */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
