/// <reference types="@cloudflare/workers-types" />
import type { APIRoute } from 'astro';
import { getBrandConfig, saveBrandConfig } from '../../../lib/config';
import type { BrandConfig } from '../../../lib/config';

// GET is public — brand config may be fetched by external consumers
const GET_CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// PUT is same-origin only — no CORS header means browsers block cross-origin writes
const PUT_HEADERS = {
  'Content-Type': 'application/json',
};

function jsonGet(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: GET_CORS });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: PUT_HEADERS });
}

// Constant-time string comparison — prevents timing attacks on the Bearer token
async function isAuthorized(request: Request, env: Record<string, string>): Promise<boolean> {
  const adminSecret = env.ADMIN_SECRET;
  if (!adminSecret) return false;
  const auth = request.headers.get('Authorization') ?? '';
  const enc = new TextEncoder();
  const expected = enc.encode(`Bearer ${adminSecret}`);
  const actual = enc.encode(auth);
  // Different lengths → reject immediately (no timing leak; length is public knowledge)
  if (expected.length !== actual.length) return false;
  // XOR every byte — loops the same number of times regardless of where mismatch is
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected[i] ^ actual[i];
  }
  return diff === 0;
}

export const OPTIONS: APIRoute = async () =>
  new Response(null, { status: 204, headers: GET_CORS });

// GET — return current brand config (public, no auth needed)
export const GET: APIRoute = async ({ locals }) => {
  const kv = locals.runtime.env.DEADROP_SECRETS;
  const brand = await getBrandConfig(kv);
  return jsonGet({ brand });
};

// PUT — save brand config (requires Authorization: Bearer <ADMIN_SECRET>)
export const PUT: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as Record<string, KVNamespace & string>;

  if (!await isAuthorized(request, env as unknown as Record<string, string>)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { brand } = body as { brand?: Partial<BrandConfig> };
  if (!brand || typeof brand !== 'object') {
    return json({ error: 'Missing brand object in request body' }, 400);
  }

  // Validate fields
  const allowed: (keyof BrandConfig)[] = ['name', 'tagline', 'logo', 'primaryColor', 'domain', 'supportEmail'];
  const sanitized: Partial<BrandConfig> = {};
  for (const key of allowed) {
    if (key in brand) {
      const val = brand[key];
      if (key === 'logo') {
        sanitized.logo = val === null || typeof val === 'string' ? val : null;
      } else if (typeof val === 'string') {
        sanitized[key] = val.trim().slice(0, 200) as never;
      }
    }
  }

  // Validate color format
  if (sanitized.primaryColor && !/^#[0-9a-fA-F]{3,8}$/.test(sanitized.primaryColor)) {
    return json({ error: 'primaryColor must be a valid hex color (e.g. #ef4444)' }, 400);
  }

  const kv = locals.runtime.env.DEADROP_SECRETS;
  await saveBrandConfig(kv, sanitized);

  const updated = await getBrandConfig(kv);
  return json({ brand: updated });
};
