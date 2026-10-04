import { logger } from '@/lib/logger';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'SECURITY';

export type AuditEntry = {
  orgId: string;
  actorId: string;
  actorRole?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  /** Changed FIELD NAMES only - never values, PII, secrets or token contents. */
  changes?: string[];
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Audit helper following handbook §6.6. The platform `AuditLog` table lives in the shared
 * `public` schema, which this standalone package cannot write to, so entries are emitted as
 * structured log lines (`audit: true`) until the integration owner wires the shared sink.
 * A failure here must never block the mutation, so errors are swallowed and logged.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    logger.info({ audit: true, ...entry }, 'audit');
  } catch (error: unknown) {
    logger.error({ err: error instanceof Error ? error.message : 'unknown' }, 'audit write failed');
  }
}
