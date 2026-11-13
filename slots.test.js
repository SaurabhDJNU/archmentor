import { describe, expect, it } from 'vitest';
import { buildSlots, istParts, istToDate } from './slots.js';

describe('India-time helpers', () => {
  it('round-trips wall clock time', () => {
    const d = istToDate(2026, 11, 15, 18 * 60);           // 15 Dec 2026, 6:00 pm IST
    expect(d.toISOString()).toBe('2026-12-15T12:30:00.000Z');
    expect(istParts(d)).toMatchObject({ y: 2026, m: 11, d: 15, minutes: 1080, dow: 2 });
  });
});

describe('buildSlots', () => {
  const from = new Date('2026-12-14T00:00:00Z');          // Monday 5:30 am IST
  const availability = [{ weekday: 1, start_time: '18:00', end_time: '21:00', slot_minutes: 60 }];
  it('makes slots inside the weekly hours', () => {
    const days = buildSlots({ availability, durationMin: 60, from, days: 1 });
    expect(days[0].slots.map((s) => s.toISOString())).toEqual(['2026-12-14T12:30:00.000Z', '2026-12-14T13:30:00.000Z', '2026-12-14T14:30:00.000Z']);
  });
  it('skips busy times and too-long sessions', () => {
    const busy = [{ start_at: '2026-12-14T13:30:00.000Z', end_at: '2026-12-14T14:30:00.000Z' }];
    const days = buildSlots({ availability, busy, durationMin: 90, from, days: 1 });
    expect(days).toEqual([]);   // 6:00+90 overlaps busy 7:00; 7:00 busy; 8:00+90 ends after 9 pm
  });
  it('respects the lead time', () => {
    const days = buildSlots({ availability, durationMin: 60, from: new Date('2026-12-14T12:00:00Z'), days: 1, leadMinutes: 120 });
    expect(days[0].slots.map((s) => s.toISOString())).toEqual(['2026-12-14T14:30:00.000Z']);
  });
});
