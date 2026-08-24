import { Prisma } from '@prisma/client';

/**
 * Serialize WhatsApp state changes for one canonical destination.
 *
 * This must be called from an interactive PostgreSQL transaction. PostgreSQL
 * releases the transaction-scoped advisory lock automatically on commit,
 * rollback, or connection failure, including when no suppression row exists.
 */
export async function acquireWhatsAppDestinationLock(
  transaction,
  normalizedDestination,
) {
  if (
    typeof normalizedDestination !== 'string' ||
    normalizedDestination.trim() === ''
  ) {
    throw new Error('A canonical WhatsApp destination is required for locking.');
  }

  if (typeof transaction?.$executeRaw !== 'function') {
    throw new Error(
      'WhatsApp destination locks require an interactive PostgreSQL transaction.',
    );
  }

  await transaction.$executeRaw(
    Prisma.sql`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${normalizedDestination}, 0)
      )
    `,
  );
}