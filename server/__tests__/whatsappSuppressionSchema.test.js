import { describe, expect, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';

const schemaPath = new URL('../prisma/schema.prisma', import.meta.url);
const migrationPath = new URL(
  '../prisma/migrations/20260821000100_add_whatsapp_phone_suppression_foundation/migration.sql',
  import.meta.url,
);

describe('WhatsApp suppression and destination persistence schema', () => {
  test('adds a canonical suppression model and nullable event snapshots', async () => {
    const schema = await readFile(schemaPath, 'utf8');

    expect(schema).toMatch(
      /model WhatsAppPhoneSuppression \{[\s\S]*phoneNumberNormalized\s+String\s+@id @db\.VarChar\(20\)[\s\S]*isOptedOut\s+Boolean\s+@default\(true\)[\s\S]*sourceEventId\s+String\?\s+@unique/,
    );
    expect(schema).toMatch(
      /model AutomationEvent \{[\s\S]*destinationNumberNormalized\s+String\?\s+@db\.VarChar\(20\)/,
    );
    expect(schema).toMatch(
      /model WhatsAppMessageEvent \{[\s\S]*senderNumberNormalized\s+String\?\s+@db\.VarChar\(20\)[\s\S]*inboundClassification\s+String\?\s+@db\.VarChar\(40\)/,
    );
  });

  test('migration is additive and intentionally has no historical backfill', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain(
      'ALTER TABLE "AutomationEvent"\nADD COLUMN "destinationNumberNormalized" VARCHAR(20);',
    );
    expect(migration).toContain(
      'ALTER TABLE "WhatsAppMessageEvent"\nADD COLUMN "senderNumberNormalized" VARCHAR(20),',
    );
    expect(migration).toContain('CREATE TABLE "WhatsAppPhoneSuppression"');
    expect(migration).not.toMatch(/^(UPDATE|DELETE|INSERT)\s/m);
  });
});