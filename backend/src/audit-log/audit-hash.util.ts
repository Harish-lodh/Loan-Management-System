import { createHash } from 'crypto';

type AuditHashInput = {
  action: string;
  entityType: string;
  entityId: string;
  actorUserId?: string | null;
  timestamp: string | Date;
  metadata: unknown;
  previousHash?: string | null;
};

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
    .join(',')}}`;
}

export function calculateAuditHash(input: AuditHashInput): string {
  const timestamp =
    input.timestamp instanceof Date ? input.timestamp.toISOString() : new Date(input.timestamp).toISOString();
  const payload = [
    input.action,
    input.entityType,
    input.entityId,
    input.actorUserId ?? '',
    timestamp,
    stableStringify(input.metadata ?? {}),
    input.previousHash ?? '',
  ].join('|');

  return createHash('sha256').update(payload).digest('hex');
}
