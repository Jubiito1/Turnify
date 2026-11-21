import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/Card';
import { ErrorState, SkeletonList } from '../../components/ui/Feedback';
import { adminBusinessQuery } from './AdminLayout';

export function AdminHomePage() {
  const { data: business, isLoading, error, refetch } = useQuery(adminBusinessQuery);
  if (isLoading) return <SkeletonList />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <PageHeader
      title={`Hola, ${business?.name ?? ''}`}
      description="Panel de administración del negocio."
    />
  );
}
