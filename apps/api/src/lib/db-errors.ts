/**
 * Helpers to recognise PostgreSQL constraint violations surfaced through Prisma.
 * Prisma does not map exclusion violations (SQLSTATE 23P01) to a known error code, so we
 * inspect the error chain for the constraint name or SQLSTATE.
 */

function collectErrorText(error: unknown, depth = 0): string {
  if (depth > 4 || error === null || error === undefined) return '';
  if (typeof error === 'string') return error;
  if (typeof error !== 'object') return '';
  const record = error as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ['message', 'code', 'constraint']) {
    if (typeof record[key] === 'string') parts.push(record[key] as string);
  }
  if (record.meta) parts.push(JSON.stringify(record.meta));
  if (record.cause) parts.push(collectErrorText(record.cause, depth + 1));
  return parts.join(' | ');
}

export function isConstraintViolation(error: unknown, constraintName: string): boolean {
  return collectErrorText(error).includes(constraintName);
}

export function isExclusionViolation(error: unknown): boolean {
  const text = collectErrorText(error);
  return text.includes('23P01') || text.includes('exclusion constraint');
}
