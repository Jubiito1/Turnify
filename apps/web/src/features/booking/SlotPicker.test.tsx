import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { availability, TZ } from '../../test/fixtures';
import { SlotPicker } from './SlotPicker';

describe('SlotPicker', () => {
  it('shows times in the business time zone grouped by period (RN-019)', () => {
    render(
      <SlotPicker slots={availability.slots} timezone={TZ} selected={null} onSelect={() => {}} />,
    );
    // 12:00Z / 12:15Z => 09:00 / 09:15 (morning); 18:00Z => 15:00 (afternoon) in Buenos Aires
    expect(screen.getByRole('group', { name: 'Mañana' })).toHaveTextContent('09:0009:15');
    expect(screen.getByRole('group', { name: 'Tarde' })).toHaveTextContent('15:00');
    expect(screen.queryByRole('group', { name: 'Noche' })).not.toBeInTheDocument();
  });

  it('announces free professionals and reports the selected slot', async () => {
    const onSelect = vi.fn();
    render(
      <SlotPicker
        slots={availability.slots}
        timezone={TZ}
        selected={availability.slots[0]!.startsAt}
        onSelect={onSelect}
      />,
    );
    const first = screen.getByRole('button', { name: /09:00 \(2 profesionales libres\)/ });
    expect(first).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: /15:00/ }));
    expect(onSelect).toHaveBeenCalledWith(availability.slots[2]);
  });
});
