import { notFound } from './errors';
import type { z } from 'zod';

/** Parses untrusted input; a ZodError is translated to 400 VALIDATION_ERROR by the error handler. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  return schema.parse(input);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route ids that are not valid UUIDs can never match a resource: answer 404, not 500. */
export function parseId(value: string | undefined): string {
  if (!value || !UUID_PATTERN.test(value)) throw notFound();
  return value;
}
