import { useAuth } from '../features/auth/AuthProvider';
import { Spinner } from './ui/Spinner';

/** Explains the free-tier cold start instead of leaving the user looking at a spinner. */
export function ServerStatusBanner() {
  const { connecting } = useAuth();
  if (!connecting) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex max-w-md items-center gap-3 rounded-2xl bg-pine-900 px-4 py-3 text-sm text-white shadow-pop">
        <Spinner className="size-5 text-apricot-300" />
        <span>
          Estamos despertando el servidor. En el plan gratuito puede tardar hasta un minuto la
          primera vez.
        </span>
      </div>
    </div>
  );
}
