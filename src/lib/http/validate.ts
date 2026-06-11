import type { z } from "zod";
import { Errors } from "@/lib/http/errors";

/**
 * Validate untrusted input at the trust boundary (NEVER trust the client).
 *
 * - Parses JSON defensively (rejects malformed bodies as 400, not 500).
 * - Runs a zod schema; on failure throws a 422 with FIELD-LEVEL, safe messages.
 * - Returns the parsed, strongly-typed, sanitized value. Downstream code only
 *   ever sees data that matched the schema.
 *
 * OWASP: A03:2021 (Injection) is mitigated upstream by validating shape/format
 * here and using parameterized queries in the data layer.
 */

const MAX_BODY_BYTES = 1_000_000; // 1 MB hard cap — reject oversized payloads early.

function formatZodIssues(error: z.ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((i) => ({
    path: i.path.join(".") || "(root)",
    message: i.message,
  }));
}

/** Parse + validate a JSON request body. Throws AppError on any problem. */
export async function parseJsonBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<z.infer<S>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw Errors.badRequest("Content-Type must be application/json");
  }

  // Enforce a size limit defensively even if the platform also does.
  const lengthHeader = req.headers.get("content-length");
  if (lengthHeader && Number(lengthHeader) > MAX_BODY_BYTES) {
    throw Errors.badRequest("Request body too large");
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    throw Errors.badRequest("Could not read request body");
  }
  if (raw.length > MAX_BODY_BYTES) {
    throw Errors.badRequest("Request body too large");
  }

  let json: unknown;
  try {
    json = raw.length === 0 ? {} : JSON.parse(raw);
  } catch {
    throw Errors.badRequest("Request body is not valid JSON");
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    throw Errors.validation(formatZodIssues(result.error));
  }
  return result.data;
}

/** Validate URL search params or a route-params object. */
export function parseParams<S extends z.ZodTypeAny>(input: unknown, schema: S): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw Errors.validation(formatZodIssues(result.error));
  }
  return result.data;
}
