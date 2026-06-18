import { calculateAuditHash } from '../src/audit-log/audit-hash.util';
import { verifyAuditChainRecords } from '../src/audit-log/audit-chain.util';

function auditRecord(sequence: number, previousHash: string | null, metadata: Record<string, unknown> = {}) {
  const record = {
    sequence,
    action: sequence === 1 ? 'USER_REGISTERED' : 'USER_LOGIN',
    entityType: 'User',
    entityId: 'user-1',
    actorUserId: 'user-1',
    timestamp: new Date(`2026-05-14T00:0${sequence}:00.000Z`),
    metadata,
    previousHash,
    currentHash: '',
  };
  record.currentHash = calculateAuditHash(record);
  return record;
}

describe('audit chain verification', () => {
  it('verifies an intact hash chain', () => {
    const first = auditRecord(1, null, { email: 'maya@example.com' });
    const second = auditRecord(2, first.currentHash, { email: 'maya@example.com' });

    expect(verifyAuditChainRecords([first, second])).toEqual(
      expect.objectContaining({ valid: true, checked: 2, brokenAtSequence: null }),
    );
  });

  it('reports the sequence where a chain is tampered', () => {
    const first = auditRecord(1, null, { email: 'maya@example.com' });
    const second = auditRecord(2, 'tampered', { email: 'maya@example.com' });

    expect(verifyAuditChainRecords([first, second])).toEqual(
      expect.objectContaining({ valid: false, brokenAtSequence: 2 }),
    );
  });
});
