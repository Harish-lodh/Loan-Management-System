import { ValueTransformer } from 'typeorm';

// MySQL returns DECIMAL columns as strings. This keeps exact storage in the database
// while letting services keep working with plain numbers.
export const decimalToNumber: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : Number(value)),
};

export const MONEY_COLUMN = { type: 'decimal', precision: 18, scale: 2, transformer: decimalToNumber } as const;
export const RATE_COLUMN = { type: 'decimal', precision: 7, scale: 4, transformer: decimalToNumber } as const;
