import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mockStore } from '@/lib/mockData';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  authError: string | null;
  isConfigured: boolean;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (params: {
    name: string;
    email: string;
    password: string;
    role?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  signInAsDemo: (demoEmail?: string) => void;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

const DEMO_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  app_metadata: { provider: 'demo' },
  user_metadata: { name: 'Primary Administrator', role: 'Operations Director' },
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
  email: 'admin@voltgrid.com',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Request tracker & timeout ref to avoid stale async authorization resolution
  const authRequestIdRef = useRef<number>(0);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to query public.admin_users for active admin record
  const verifyAdminStatus = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.warn('Error querying admin_users table:', error.message);
        return false;
      }

      return Boolean(data && data.is_active);
    } catch (err) {
      console.error('Exception checking admin authorization:', err);
      return false;
    }
  }, []);

  // Demo sign-in handler (supports custom or default demo account)
  const signInAsDemo = useCallback((demoEmail = 'admin@voltgrid.com') => {
    const admins = mockStore.getAdmins();
    const match = admins.find((a) => a.email.toLowerCase() === demoEmail.toLowerCase()) || admins[0];

    const demoUserObj: User = {
      id: match?.id || '00000000-0000-0000-0000-000000000001',
      app_metadata: { provider: 'demo' },
      user_metadata: { name: match?.name || 'Demo Administrator', role: match?.role || 'Operations Director' },
      aud: 'authenticated',
      created_at: match?.created_at || '2026-01-01T00:00:00.000Z',
      email: match?.email || demoEmail,
    };

    try {
      localStorage.setItem('voltgrid_demo_auth', 'true');
      localStorage.setItem('voltgrid_active_admin', JSON.stringify(demoUserObj));
    } catch {
      // ignore
    }
    setUser(demoUserObj);
    setSession(null);
    setIsAdmin(true);
    setIsDemoMode(true);
    setAuthError(null);
    setIsLoading(false);
  }, []);

  // Synchronous session handler with deferred administrator verification
  useEffect(() => {
    let isMounted = true;

    // Check for existing demo session in localStorage
    try {
      if (localStorage.getItem('voltgrid_demo_auth') === 'true') {
        const saved = localStorage.getItem('voltgrid_active_admin');
        if (saved) {
          const parsed = JSON.parse(saved) as User;
          setUser(parsed);
        } else {
          setUser(DEMO_USER);
        }
        setIsAdmin(true);
        setIsDemoMode(true);
        setIsLoading(false);
        return;
      }
    } catch {
      // ignore
    }

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    const handleSessionChange = (currentSession: Session | null) => {
      if (!isMounted) return;

      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }

      const currentRequestId = ++authRequestIdRef.current;

      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);
      setIsDemoMode(false);

      if (!currentUser) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      pendingTimeoutRef.current = setTimeout(() => {
        void (async () => {
          try {
            const authorized = await verifyAdminStatus(currentUser.id);

            if (!isMounted || currentRequestId !== authRequestIdRef.current) {
              return;
            }

            setIsAdmin(authorized);
            if (!authorized) {
              setAuthError(
                `Access Denied: Account "${currentUser.email}" is authenticated, but is not authorized as an active administrator in public.admin_users.`
              );
            } else {
              setAuthError(null);
            }
          } catch (err) {
            if (!isMounted || currentRequestId !== authRequestIdRef.current) return;
            console.error('Exception during deferred admin verification:', err);
            setIsAdmin(false);
            setAuthError('An unexpected error occurred while verifying administrator authorization.');
          } finally {
            if (isMounted && currentRequestId === authRequestIdRef.current) {
              setIsLoading(false);
            }
          }
        })();
      }, 0);
    };

    void supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (!isMounted) return;
      if (error) {
        console.warn('Failed to retrieve initial session:', error.message);
        setIsLoading(false);
        return;
      }
      handleSessionChange(initialSession);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      handleSessionChange(currentSession);
    });

    return () => {
      isMounted = false;
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
      subscription.unsubscribe();
    };
  }, [verifyAdminStatus]);

  // Sign in using Supabase Auth or fallback to Demo Mode if Supabase is unconfigured
  const signIn = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      setAuthError(null);

      if (!email.trim() || !password) {
        const msg = 'Please enter both your administrator email and password.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      // If Supabase credentials are not in .env, check registered demo admin accounts
      if (!isSupabaseConfigured) {
        const cleanEmail = email.trim().toLowerCase();
        const admins = mockStore.getAdmins();
        const match = admins.find((a) => a.email.toLowerCase() === cleanEmail);

        if (match) {
          const userObj: User = {
            id: match.id,
            app_metadata: { provider: 'demo' },
            user_metadata: { name: match.name, role: match.role },
            aud: 'authenticated',
            created_at: match.created_at,
            email: match.email,
          };
          try {
            localStorage.setItem('voltgrid_demo_auth', 'true');
            localStorage.setItem('voltgrid_active_admin', JSON.stringify(userObj));
          } catch {
            // ignore
          }
          setUser(userObj);
          setIsAdmin(true);
          setIsDemoMode(true);
          setIsLoading(false);
          setAuthError(null);
          return { success: true };
        }

        if (cleanEmail === 'admin@voltgrid.com' || cleanEmail.includes('admin') || cleanEmail.includes('demo')) {
          signInAsDemo(cleanEmail);
          return { success: true };
        }

        const msg = `Administrator account "${email}" not found. You can switch to the "Create Account" tab to register, or use "admin@voltgrid.com".`;
        setAuthError(msg);
        return { success: false, error: msg };
      }

      setIsLoading(true);

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setIsLoading(false);
          let userMsg = error.message;
          if (error.message.toLowerCase().includes('invalid login credentials')) {
            userMsg = 'Invalid email or password. Please verify your administrator credentials.';
          } else if (error.message.toLowerCase().includes('email not confirmed')) {
            userMsg = 'Email address has not been confirmed. Please check your inbox or confirm the user in the Supabase Dashboard.';
          }
          setAuthError(userMsg);
          return { success: false, error: userMsg };
        }

        if (!data.user) {
          setIsLoading(false);
          const msg = 'Authentication failed: No user record returned.';
          setAuthError(msg);
          return { success: false, error: msg };
        }

        const isAuthorizedAdmin = await verifyAdminStatus(data.user.id);

        if (!isAuthorizedAdmin) {
          authRequestIdRef.current += 1;
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setIsAdmin(false);
          setIsLoading(false);

          const msg = `Access Denied: Account "${data.user.email}" is authenticated with Supabase, but is not authorized as an active administrator in the public.admin_users table.`;
          setAuthError(msg);
          return { success: false, error: msg };
        }

        setUser(data.user);
        setSession(data.session);
        setIsAdmin(true);
        setIsDemoMode(false);
        setIsLoading(false);
        setAuthError(null);
        return { success: true };
      } catch (err: unknown) {
        setIsLoading(false);
        const msg = err instanceof Error ? err.message : 'An unexpected authentication error occurred.';
        setAuthError(msg);
        return { success: false, error: msg };
      }
    },
    [verifyAdminStatus, signInAsDemo]
  );

  // Sign up / Create new administrator account
  const signUp = useCallback(
    async (params: {
      name: string;
      email: string;
      password: string;
      role?: string;
    }): Promise<{ success: boolean; error?: string }> => {
      setAuthError(null);

      const name = params.name.trim();
      const email = params.email.trim().toLowerCase();
      const password = params.password;
      const role = params.role || 'Network Operations Admin';

      if (!name) {
        const msg = 'Please enter your full administrator name.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      if (!email || !email.includes('@')) {
        const msg = 'Please enter a valid administrator email address.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      if (!password || password.length < 6) {
        const msg = 'Password must be at least 6 characters.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      setIsLoading(true);

      // In Demo / Local mode, register the admin in mockStore and log in immediately!
      if (!isSupabaseConfigured) {
        try {
          const newAdmin = mockStore.createAdmin({
            name,
            email,
            password,
            role,
          });

          const createdUser: User = {
            id: newAdmin.id,
            app_metadata: { provider: 'demo' },
            user_metadata: { name: newAdmin.name, role: newAdmin.role },
            aud: 'authenticated',
            created_at: newAdmin.created_at,
            email: newAdmin.email,
          };

          try {
            localStorage.setItem('voltgrid_demo_auth', 'true');
            localStorage.setItem('voltgrid_active_admin', JSON.stringify(createdUser));
          } catch {
            // ignore
          }

          setUser(createdUser);
          setSession(null);
          setIsAdmin(true);
          setIsDemoMode(true);
          setIsLoading(false);
          setAuthError(null);
          return { success: true };
        } catch (err: unknown) {
          setIsLoading(false);
          const msg = err instanceof Error ? err.message : 'Failed to create administrator account.';
          setAuthError(msg);
          return { success: false, error: msg };
        }
      }

      // If Supabase is configured, register via Supabase Auth
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              role,
            },
          },
        });

        if (error) {
          setIsLoading(false);
          setAuthError(error.message);
          return { success: false, error: error.message };
        }

        if (!data.user) {
          setIsLoading(false);
          const msg = 'Registration failed: No user record returned.';
          setAuthError(msg);
          return { success: false, error: msg };
        }

        // Try to insert admin user entry
        try {
          await supabase.from('admin_users').insert({
            user_id: data.user.id,
            email,
            is_active: true,
          });
        } catch (insertErr) {
          console.warn('Note on admin_users table insert:', insertErr);
        }

        if (data.session) {
          setUser(data.user);
          setSession(data.session);
          setIsAdmin(true);
          setIsDemoMode(false);
          setIsLoading(false);
          setAuthError(null);
          return { success: true };
        } else {
          setIsLoading(false);
          return {
            success: true,
            error: 'Account created! If confirmation is required, please check your inbox before signing in.',
          };
        }
      } catch (err: unknown) {
        setIsLoading(false);
        const msg = err instanceof Error ? err.message : 'An unexpected registration error occurred.';
        setAuthError(msg);
        return { success: false, error: msg };
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    try {
      try {
        localStorage.removeItem('voltgrid_demo_auth');
        localStorage.removeItem('voltgrid_active_admin');
      } catch {
        // ignore
      }
      authRequestIdRef.current += 1;
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Error during signOut:', err);
    } finally {
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      setIsDemoMode(false);
      setAuthError(null);
      setIsLoading(false);
    }
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAdmin,
        isLoading,
        authError,
        isConfigured: isSupabaseConfigured,
        isDemoMode,
        signIn,
        signUp,
        signInAsDemo,
        signOut,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


