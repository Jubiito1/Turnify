import type { Role } from '@turnify/shared';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { PageSpinner } from '../../components/ui/Spinner';
import { homeFor, useAuth } from './AuthProvider';

/**
 * Client-side route guard for UX only: the API enforces authorization on every request (RN-024).
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageSpinner />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/ingresar?next=${next}`} replace />;
  }
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return <>{children}</>;
}
