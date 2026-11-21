import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BusinessDetail,
  LoginInput,
  RegisterBusinessInput,
  RegisterInput,
  SessionUser,
} from '@turnify/shared';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { api, ApiError } from '../../lib/api';

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<SessionUser>;
  register: (input: RegisterInput) => Promise<SessionUser>;
  registerBusiness: (
    input: RegisterBusinessInput,
  ) => Promise<{ user: SessionUser; business: BusinessDetail }>;
  logout: () => Promise<void>;
  setUser: (user: SessionUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
export const ME_QUERY_KEY = ['auth', 'me'] as const;

async function fetchMe(): Promise<SessionUser | null> {
  try {
    const { user } = await api<{ user: SessionUser }>('/auth/me');
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** Session state backed by the httpOnly cookie; the server is the source of truth (GET /auth/me). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchMe,
    staleTime: 5 * 60_000,
  });

  /** Drops cached data of the previous session without touching the session query itself. */
  const resetUserData = useCallback(
    () => queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' }),
    [queryClient],
  );

  const setUser = useCallback(
    (user: SessionUser | null) => queryClient.setQueryData(ME_QUERY_KEY, user),
    [queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: data ?? null,
      isLoading,
      setUser,
      async login(input) {
        const { user } = await api<{ user: SessionUser }>('/auth/login', {
          method: 'POST',
          body: input,
        });
        resetUserData();
        setUser(user);
        return user;
      },
      async register(input) {
        const { user } = await api<{ user: SessionUser }>('/auth/register', {
          method: 'POST',
          body: input,
        });
        resetUserData();
        setUser(user);
        return user;
      },
      async registerBusiness(input) {
        const result = await api<{ user: SessionUser; business: BusinessDetail }>(
          '/auth/register-business',
          {
            method: 'POST',
            body: input,
          },
        );
        resetUserData();
        setUser(result.user);
        return result;
      },
      async logout() {
        await api('/auth/logout', { method: 'POST' });
        resetUserData();
        setUser(null);
      },
    }),
    [data, isLoading, resetUserData, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** Home route for each role after logging in. */
export function homeFor(user: SessionUser): string {
  if (user.role === 'ADMIN') return '/admin';
  if (user.role === 'PROFESSIONAL') return '/pro';
  return '/mis-reservas';
}
