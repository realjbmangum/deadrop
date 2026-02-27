import type { APIRoute } from 'astro';
import type { StoredSecret } from '../../../types';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function notFoundResponse() {
  return new Response(
    JSON.stringify({ error: 'Secret not found or already burned' }),
    { status: 404, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
  );
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const GET: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  const kv = locals.runtime.env.DEADROP_SECRETS;

  const raw = await kv.get(`secret:${id}`);
  if (!raw) {
    return notFoundResponse();
  }

  const secret: StoredSecret = JSON.parse(raw);

  secret.viewCount += 1;

  // If this view hits the limit, burn the secret immediately
  if (secret.viewCount >= secret.viewLimit) {
    await kv.delete(`secret:${id}`);
  } else {
    // Update the view count; preserve the remaining TTL
    const remainingMs = secret.expiresAt - Date.now();
    const remainingSeconds = Math.max(60, Math.ceil(remainingMs / 1000));
    await kv.put(`secret:${id}`, JSON.stringify(secret), {
      expirationTtl: remainingSeconds,
    });
  }

  // Only return the encrypted payload — never metadata
  return new Response(
    JSON.stringify({ ciphertext: secret.ciphertext, iv: secret.iv }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
  );
};
