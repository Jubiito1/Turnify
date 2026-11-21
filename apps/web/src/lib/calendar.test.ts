import { layoutLanes } from './calendar';

const ev = (id: string, start: string, end: string) => ({
  id,
  startsAt: `2030-01-07T${start}:00.000Z`,
  endsAt: `2030-01-07T${end}:00.000Z`,
});

describe('layoutLanes', () => {
  it('gives non-overlapping events the full width', () => {
    const lanes = layoutLanes([ev('a', '10:00', '10:30'), ev('b', '10:30', '11:00')]);
    expect(lanes.get('a')).toEqual({ lane: 0, lanes: 1 });
    expect(lanes.get('b')).toEqual({ lane: 0, lanes: 1 });
  });

  it('splits overlapping events into lanes and reuses freed lanes', () => {
    const lanes = layoutLanes([
      ev('a', '10:00', '11:00'),
      ev('b', '10:15', '10:45'),
      ev('c', '10:45', '11:30'), // reuses lane 1 freed by b, still overlaps a
      ev('d', '12:00', '12:30'), // new cluster
    ]);
    expect(lanes.get('a')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('b')).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get('c')).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get('d')).toEqual({ lane: 0, lanes: 1 });
  });
});
