import type { z } from 'zod';

/** Parses untrusted input; a ZodError is translated to 400 VALIDATION_ERROR by the error handler. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  return schema.parse(input);
}
