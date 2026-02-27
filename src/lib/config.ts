/**
 * Server-side brand config loader.
 * Reads from KV first (set via /admin), falls back to deadrop.config.json.
 * This runs server-side in Astro API routes and pages.
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

const KV_CONFIG_KEY = 'config:brand';

export async function getBrandConfig(kv: KVNamespace): Promise<BrandConfig> {
  try {
    const stored = await kv.get(KV_CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<BrandConfig>;
      // Merge with defaults so missing keys always have values
      return { ...(defaultConfig.brand as BrandConfig), ...parsed };
    }
  } catch {
    // Fall through to defaults
  }
  return defaultConfig.brand as BrandConfig;
}

export async function saveBrandConfig(kv: KVNamespace, brand: Partial<BrandConfig>): Promise<void> {
  // Merge with existing config before saving
  const current = await getBrandConfig(kv);
  const updated = { ...current, ...brand };
  await kv.put(KV_CONFIG_KEY, JSON.stringify(updated));
}
