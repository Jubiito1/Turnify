import type { BusinessCategory } from '@turnify/shared';
import {
  Dumbbell,
  GraduationCap,
  HeartPulse,
  PawPrint,
  Scissors,
  Sparkles,
  Store,
  Flower2,
} from 'lucide-react';

const ICONS = {
  BEAUTY: Sparkles,
  BARBERSHOP: Scissors,
  HEALTH: HeartPulse,
  WELLNESS: Flower2,
  FITNESS: Dumbbell,
  EDUCATION: GraduationCap,
  PETS: PawPrint,
  OTHER: Store,
} satisfies Record<BusinessCategory, unknown>;

export function CategoryIcon({
  category,
  className,
}: {
  category: BusinessCategory;
  className?: string;
}) {
  const Icon = ICONS[category];
  return <Icon className={className} aria-hidden="true" />;
}
