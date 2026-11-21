import type { Role } from '@turnify/shared';

/** Account menu links per role (extended as panels are implemented). */
export const ACCOUNT_LINKS: Record<Role, { to: string; label: string }[]> = {
  CLIENT: [
    { to: '/mis-reservas', label: 'Mis reservas' },
    { to: '/mi-perfil', label: 'Mi perfil' },
  ],
  ADMIN: [
    { to: '/admin', label: 'Panel del negocio' },
    { to: '/mi-perfil', label: 'Mi perfil' },
  ],
  PROFESSIONAL: [
    { to: '/pro', label: 'Mi agenda' },
    { to: '/mi-perfil', label: 'Mi perfil' },
  ],
};
