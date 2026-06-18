export function calculateDaysOverdue(dueDate: Date, now = new Date()): number {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const current = new Date(now);
  current.setHours(0, 0, 0, 0);

  const diff = current.getTime() - due.getTime();
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

export function shouldSendOverdueReminder(lastReminderAt?: Date | null, now = new Date()): boolean {
  if (!lastReminderAt) {
    return true;
  }

  return now.getTime() - new Date(lastReminderAt).getTime() >= 24 * 60 * 60 * 1000;
}
