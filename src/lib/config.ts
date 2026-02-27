/**
 * Server-side brand config loader.
 * Reads from KV first (set via /admin), falls back to deadrop.config.json.
 * Config is stored per-hostname so multiple white-label domains share one deployment.
 *
 * KV key priority:
 *   1. config:brand:{hostname}   (per-domain override)
 *   2. deadrop.config.json       (default fallback)
 */

import defaultConfig from '../../deadrop.config.json';

export interface BrandConfig {
  name: string;
  tagline: string;
  logo: string | null;
  primaryColor: string;
  domain: string;
  supportEmail: string;
}

export interface DeadropConfig {
  brand: BrandConfig;
  limits: {
    maxSecretBytes: number;
    maxTtlDays: number;
    defaultTtlSeconds: number;
  };
}

function kvKey(hostname: string): string {
  return `config:brand:${hostname}`;
}

export async function getBrandConfig(kv: KVNamespace, hostname?: string): Promise<BrandConfig> {
  const defaults = defaultConfig.brand as BrandConfig;
  if (!hostname) return defaults;
  try {
    const stored = await kv.get(kvKey(hostname));
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<BrandConfig>;
      return { ...defaults, ...parsed };
    }
  } catch {
    // Fall through to defaults
  }
  return defaults;
}

export async function saveBrandConfig(kv: KVNamespace, brand: Partial<BrandConfig>, hostname: string): Promise<void> {
  const current = await getBrandConfig(kv, hostname);
  const updated = { ...current, ...brand };
  await kv.put(kvKey(hostname), JSON.stringify(updated));
}
