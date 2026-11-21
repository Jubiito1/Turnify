import { BUSINESS_CATEGORY_LABELS, type BusinessSummary } from '@turnify/shared';
import { ArrowRight, MapPin } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { formatPrice } from '../../lib/format';
import { CategoryIcon } from './CategoryIcon';

export function BusinessCard({ business }: { business: BusinessSummary }) {
  return (
    <Link
      to={`/negocios/${business.slug}`}
      className="group flex h-full flex-col rounded-2xl border border-sand-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-pine-300 hover:shadow-pop focus-visible:-translate-y-0.5"
    >
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-pine-50 text-pine-700 transition group-hover:bg-pine-700 group-hover:text-white">
          <CategoryIcon category={business.category} className="size-6" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold">{business.name}</h3>
          <Badge tone="neutral" className="mt-1">
            {BUSINESS_CATEGORY_LABELS[business.category]}
          </Badge>
        </div>
      </div>
      {business.description && (
        <p className="mt-4 line-clamp-2 text-sm text-sand-600">{business.description}</p>
      )}
      <div className="mt-auto flex items-end justify-between gap-3 pt-5 text-sm">
        <div className="min-w-0 text-sand-500">
          {business.address && (
            <p className="flex items-center gap-1 truncate">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{business.address}</span>
            </p>
          )}
          <p className="mt-1">
            {business.serviceCount} servicio{business.serviceCount === 1 ? '' : 's'}
            {business.minPriceCents !== null && <> · desde {formatPrice(business.minPriceCents)}</>}
          </p>
        </div>
        <ArrowRight
          className="size-5 shrink-0 text-pine-600 transition group-hover:translate-x-1"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}
