import { calculateAuditHash } from '../src/audit-log/audit-hash.util';

describe('audit hash', () => {
  it('creates stable hashes for identical payloads regardless of metadata key order', () => {
    const first = calculateAuditHash({
      action: 'LOAN_APPROVED',
      entityType: 'Loan',
      entityId: 'loan-1',
      actorUserId: 'admin-1',
      timestamp: '2026-05-14T00:00:00.000Z',
      metadata: { amount: 1000, status: 'ACTIVE' },
      previousHash: 'abc',
    });
    const second = calculateAuditHash({
      action: 'LOAN_APPROVED',
      entityType: 'Loan',
      entityId: 'loan-1',
      actorUserId: 'admin-1',
      timestamp: '2026-05-14T00:00:00.000Z',
      metadata: { status: 'ACTIVE', amount: 1000 },
      previousHash: 'abc',
    });

    expect(first).toBe(second);
  });

  it('breaks the chain when previous hash changes', () => {
    const first = calculateAuditHash({
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: 'user-1',
      actorUserId: 'user-1',
      timestamp: '2026-05-14T00:00:00.000Z',
      metadata: { email: 'maya@example.com' },
      previousHash: null,
    });
    const validSecond = calculateAuditHash({
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: 'user-1',
      actorUserId: 'user-1',
      timestamp: '2026-05-14T00:01:00.000Z',
      metadata: { email: 'maya@example.com' },
      previousHash: first,
    });
    const tamperedSecond = calculateAuditHash({
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: 'user-1',
      actorUserId: 'user-1',
      timestamp: '2026-05-14T00:01:00.000Z',
      metadata: { email: 'maya@example.com' },
      previousHash: 'different',
    });

    expect(validSecond).not.toBe(tamperedSecond);
  });
});
