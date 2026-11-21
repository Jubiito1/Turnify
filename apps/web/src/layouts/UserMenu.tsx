import { clsx } from 'clsx';
import { ChevronDown, LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../features/auth/AuthProvider';
import { initials } from '../lib/format';

const ROLE_LABEL = {
  CLIENT: 'Cliente',
  ADMIN: 'Administrador',
  PROFESSIONAL: 'Profesional',
} as const;

/** Account dropdown: keyboard accessible (Esc closes, focus returns to the trigger). */
export function UserMenu({ links }: { links: { to: string; label: string }[] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    toast.success('Sesión cerrada');
    navigate('/');
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl py-1 pr-2 pl-1 hover:bg-sand-100"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-pine-100 text-sm font-bold text-pine-800">
          {initials(user.name)}
        </span>
        <span className="hidden max-w-[10rem] truncate text-sm font-semibold text-sand-800 sm:block">
          {user.name}
        </span>
        <ChevronDown
          className={clsx('size-4 text-sand-500 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-2xl border border-sand-200 bg-white py-1 shadow-pop animate-fade-in"
        >
          <div className="border-b border-sand-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-sand-900">{user.name}</p>
            <p className="truncate text-xs text-sand-500">
              {user.email} · {ROLE_LABEL[user.role]}
            </p>
          </div>
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-sand-700 hover:bg-sand-50 hover:text-sand-900"
            >
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
