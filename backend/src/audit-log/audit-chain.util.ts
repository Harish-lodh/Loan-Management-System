import { AuditLog } from '../database/entities';
import { calculateAuditHash } from './audit-hash.util';

export type AuditChainRecord = Pick<
  AuditLog,
  'action' | 'entityType' | 'entityId' | 'actorUserId' | 'timestamp' | 'metadata' | 'previousHash' | 'currentHash' | 'sequence'
>;

export function verifyAuditChainRecords(logs: AuditChainRecord[]) {
  let previousHash: string | null = null;

  for (const log of logs) {
    if (log.previousHash !== previousHash) {
      return {
        valid: false,
        checked: logs.length,
        brokenAtSequence: log.sequence,
        message: `Previous hash mismatch at audit sequence ${log.sequence}.`,
      };
    }

    const expectedHash = calculateAuditHash({
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      actorUserId: log.actorUserId,
      timestamp: log.timestamp,
      metadata: log.metadata,
      previousHash: log.previousHash,
    });

    if (expectedHash !== log.currentHash) {
      return {
        valid: false,
        checked: logs.length,
        brokenAtSequence: log.sequence,
        message: `Current hash mismatch at audit sequence ${log.sequence}.`,
      };
    }

    previousHash = log.currentHash;
  }

  return {
    valid: true,
    checked: logs.length,
    brokenAtSequence: null,
    message: logs.length ? 'Audit chain is valid.' : 'Audit chain has no records yet.',
  };
}
