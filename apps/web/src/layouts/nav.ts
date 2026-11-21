import type { Role } from '@turnify/shared';

/** Account menu links per role (extended as panels are implemented). */
export const ACCOUNT_LINKS: Record<Role, { to: string; label: string }[]> = {
  CLIENT: [],
  ADMIN: [{ to: '/admin', label: 'Panel del negocio' }],
  PROFESSIONAL: [{ to: '/pro', label: 'Mi agenda' }],
};
