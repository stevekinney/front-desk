import type { ErrorRequestHandler, RequestHandler } from 'express';
import { z } from 'zod';

import type { ApiError } from '@front-desk/contract';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: ApiError['issues'],
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function notFound(what: string): HttpError {
  return new HttpError(404, `${what} not found`);
}

/** Parse untrusted input or throw a 400 that lists every problem. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new HttpError(
      400,
      'Invalid request',
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

export const idParam = z.coerce.number().int().positive();

export const unknownRoute: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, 'No such route'));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    const body: ApiError = { error: err.message };
    if (err.issues) body.issues = err.issues;
    res.status(err.status).json(body);
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Request body is not valid JSON' } satisfies ApiError);
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' } satisfies ApiError);
};
