/// <reference types="@cloudflare/workers-types" />
import type { APIRoute } from 'astro';
import { getBrandConfig, saveBrandConfig } from '../../lib/config';
import type { BrandConfig } from '../../lib/config';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function isAuthorized(request: Request, env: Record<string, string>): boolean {
  const adminSecret = env.ADMIN_SECRET;
  // If no secret configured, admin is disabled
  if (!adminSecret) return false;
  const auth = request.headers.get('Authorization');
  return auth === `Bearer ${adminSecret}`;
}

export const OPTIONS: APIRoute = async () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

// GET — return current brand config (public, no auth needed)
export const GET: APIRoute = async ({ locals }) => {
  const env = locals.runtime.env as Record<string, KVNamespace & string>;
  const kv = locals.runtime.env.DEADROP_SECRETS;
  const brand = await getBrandConfig(kv);
  return json({ brand });
};

// PUT — save brand config (requires Authorization: Bearer <ADMIN_SECRET>)
export const PUT: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as Record<string, KVNamespace & string>;

  if (!isAuthorized(request, env as unknown as Record<string, string>)) {
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
