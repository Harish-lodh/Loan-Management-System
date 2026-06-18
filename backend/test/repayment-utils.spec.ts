import { calculateDaysOverdue, shouldSendOverdueReminder } from '../src/repayments/repayment-utils';

describe('repayment utilities', () => {
  it('calculates overdue days using calendar dates', () => {
    const dueDate = new Date('2026-05-20T23:30:00.000Z');
    const now = new Date('2026-05-23T01:00:00.000Z');

    expect(calculateDaysOverdue(dueDate, now)).toBe(2);
  });

  it('does not return negative overdue days for future dates', () => {
    expect(calculateDaysOverdue(new Date('2026-05-28T00:00:00.000Z'), new Date('2026-05-26T00:00:00.000Z'))).toBe(0);
  });

  it('allows one overdue reminder per day', () => {
    const now = new Date('2026-05-26T12:00:00.000Z');

    expect(shouldSendOverdueReminder(null, now)).toBe(true);
    expect(shouldSendOverdueReminder(new Date('2026-05-26T08:00:00.000Z'), now)).toBe(false);
    expect(shouldSendOverdueReminder(new Date('2026-05-25T08:00:00.000Z'), now)).toBe(true);
  });
});
