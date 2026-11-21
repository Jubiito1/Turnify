import { clsx } from 'clsx';

interface LogoProps {
  className?: string;
  withWordmark?: boolean;
  inverted?: boolean;
}

export function Logo({ className, withWordmark = true, inverted = false }: LogoProps) {
  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill={inverted ? '#fdf6ec' : '#0f5b4d'} />
        <circle
          cx="32"
          cy="34"
          r="17"
          fill="none"
          stroke={inverted ? '#0f5b4d' : '#fdf6ec'}
          strokeWidth="5"
        />
        <path
          d="M32 24v10l7 5"
          fill="none"
          stroke="#f08a3c"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="24" y="8" width="16" height="6" rx="3" fill={inverted ? '#0f5b4d' : '#fdf6ec'} />
      </svg>
      {withWordmark && (
        <span
          className={clsx(
            'font-display text-xl font-bold tracking-tight',
            inverted ? 'text-sand-50' : 'text-pine-800',
          )}
        >
          Turnify
        </span>
      )}
    </span>
  );
}
