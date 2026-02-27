import type { APIRoute } from 'astro';
import type { StoredSecret } from '../../types';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MIN_TTL = 300;            // 5 minutes
const MAX_TTL = 2592000;        // 30 days
const MIN_VIEW_LIMIT = 1;
const MAX_VIEW_LIMIT = 10;
// 10KB plaintext = ~13.7KB base64 — cap at 20KB to give headroom
const MAX_CIPHERTEXT_LENGTH = 20000;
// AES-GCM IV is 12 bytes = 16 chars base64url
const EXPECTED_IV_LENGTH = 16;
// UUID v4 regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const kv = locals.runtime.env.DEADROP_SECRETS;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }

  const { ciphertext, iv, viewLimit, ttlSeconds } = body as Record<string, unknown>;

  // Validate ciphertext
  if (typeof ciphertext !== 'string' || ciphertext.length === 0) {
    return new Response(
      JSON.stringify({ error: 'ciphertext must be a non-empty string' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }
  if (ciphertext.length > MAX_CIPHERTEXT_LENGTH) {
    return new Response(
      JSON.stringify({ error: `ciphertext exceeds maximum allowed length (${MAX_CIPHERTEXT_LENGTH} chars)` }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }

  // Validate iv — must be exactly 16 base64url chars (12-byte AES-GCM IV)
  if (typeof iv !== 'string' || iv.length !== EXPECTED_IV_LENGTH) {
    return new Response(
      JSON.stringify({ error: 'iv must be a 16-character base64url string' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }

  // Validate viewLimit
  if (typeof viewLimit !== 'number' || !Number.isInteger(viewLimit) || viewLimit < MIN_VIEW_LIMIT || viewLimit > MAX_VIEW_LIMIT) {
    return new Response(
      JSON.stringify({ error: `viewLimit must be an integer between ${MIN_VIEW_LIMIT} and ${MAX_VIEW_LIMIT}` }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }

  // Validate ttlSeconds
  if (typeof ttlSeconds !== 'number' || !Number.isInteger(ttlSeconds) || ttlSeconds < MIN_TTL || ttlSeconds > MAX_TTL) {
    return new Response(
      JSON.stringify({ error: `ttlSeconds must be an integer between ${MIN_TTL} and ${MAX_TTL}` }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }

  const id = crypto.randomUUID();
  const now = Date.now();

  const secret: StoredSecret = {
    ciphertext,
    iv,
    viewLimit,
    viewCount: 0,
    expiresAt: now + ttlSeconds * 1000,
    createdAt: now,
  };

  // Store with KV auto-expiration so secrets are purged even if never retrieved
  await kv.put(`secret:${id}`, JSON.stringify(secret), {
    expirationTtl: ttlSeconds,
  });

  return new Response(
    JSON.stringify({ id }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
  );
};
