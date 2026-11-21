import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/Card';
import { ErrorState, SkeletonList } from '../../components/ui/Feedback';
import { proProfileQuery } from './ProLayout';

export function ProHomePage() {
  const { data: profile, isLoading, error, refetch } = useQuery(proProfileQuery);
  if (isLoading) return <SkeletonList />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <PageHeader
      title={`Hola, ${profile?.displayName ?? ''}`}
      description={profile?.business.name}
    />
  );
}
