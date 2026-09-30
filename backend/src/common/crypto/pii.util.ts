import { createHmac } from 'crypto';
import { decryptSecrets, encryptSecrets } from './secret-cipher.util';

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function normalizePan(value: string) {
  return value.replace(/\s+/g, '').toUpperCase();
}

export function isValidPan(value: string) {
  return PAN_PATTERN.test(normalizePan(value));
}

export function maskPan(value: string) {
  const pan = normalizePan(value);
  return `${'X'.repeat(Math.max(0, pan.length - 4))}${pan.slice(-4)}`;
}

// Keyed hash so identifiers with a small value space (PAN, phone) cannot be brute-forced
// from a database dump. Used for duplicate detection without decrypting.
export function hashPii(value: string) {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY is not configured');
  }
  return createHmac('sha256', key).update(value).digest('hex');
}

export function encryptPii(value: string) {
  return encryptSecrets({ value });
}

export function decryptPii(payload: string) {
  return decryptSecrets(payload).value;
}
