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
  /** True while the API is not answering yet (e.g. free-tier cold start) and we keep retrying. */
  connecting: boolean;
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

async function fetchSession(): Promise<SessionUser | null> {
  const { user } = await api<{ user: SessionUser | null }>('/auth/session');
  return user;
}

/** Session state backed by the httpOnly cookie; the server is the source of truth (GET /auth/session). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading, failureCount } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchSession,
    staleTime: 5 * 60_000,
    // A sleeping free-tier backend can take up to a minute to answer: keep retrying network/5xx errors.
    retry: (count, error) =>
      !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 12,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
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
      connecting: isLoading && failureCount > 0,
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
        // Full reload to the landing page: drops every cached query and avoids route guards of the
        // page being left reacting to the cleared session mid-transition.
        window.location.replace('/');
      },
    }),
    [data, isLoading, failureCount, resetUserData, setUser],
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
