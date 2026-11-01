import type { z } from 'zod';

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Validate input with a shared Zod schema; throws a 400 with readable details. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, 'Invalid request', r.error.issues);
  return r.data;
}

export function must<T>(value: T | null | undefined, what = 'Resource'): NonNullable<T> {
  if (value === null || value === undefined) throw new HttpError(404, `${what} not found`);
  return value as NonNullable<T>;
}

/**
 * Unwrap a supabase-js result or throw. For .maybeSingle() the value may still be null at
 * runtime: wrap those in must().
 */
export function db<R extends { data: unknown; error: { message: string } | null }>(
  res: R,
): NonNullable<R['data']> {
  if (res.error) throw new HttpError(500, res.error.message);
  return res.data as NonNullable<R['data']>;
}
