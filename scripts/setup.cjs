#!/usr/bin/env node
/**
 * Deadrop Setup Script
 * Creates the KV namespace and automatically updates wrangler.toml.
 * Run once before your first deploy: npm run setup
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WRANGLER_TOML = path.join(__dirname, '..', 'wrangler.toml');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' });
  } catch (e) {
    console.error(`\n❌  Command failed: ${cmd}`);
    console.error(e.stderr || e.message);
    process.exit(1);
  }
}

function extractId(output) {
  const match = output.match(/id\s*=\s*"([a-f0-9]{32})"/);
  if (!match) {
    console.error('❌  Could not parse namespace ID from wrangler output:');
    console.error(output);
    process.exit(1);
  }
  return match[1];
}

console.log('\n🔐  Deadrop Setup\n');
console.log('This will create a Cloudflare KV namespace and update wrangler.toml.');
console.log('Make sure you\'re logged in: run `wrangler login` first.\n');

// Create production namespace
console.log('Creating KV namespace (production)...');
const prodOutput = run('wrangler kv:namespace create DEADROP_SECRETS');
const prodId = extractId(prodOutput);
console.log(`  ✅  Production ID: ${prodId}`);

// Create preview namespace
console.log('Creating KV namespace (preview/local dev)...');
const previewOutput = run('wrangler kv:namespace create DEADROP_SECRETS --preview');
const previewId = extractId(previewOutput);
console.log(`  ✅  Preview ID: ${previewId}`);

// Update wrangler.toml
let toml = fs.readFileSync(WRANGLER_TOML, 'utf8');
toml = toml.replace('id = "YOUR_KV_NAMESPACE_ID"', `id = "${prodId}"`);
toml = toml.replace('preview_id = "YOUR_KV_NAMESPACE_PREVIEW_ID"', `preview_id = "${previewId}"`);
fs.writeFileSync(WRANGLER_TOML, toml);
console.log('\n  ✅  wrangler.toml updated\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n✅  Setup complete! Next steps:\n');
console.log('  1. Set your admin password in wrangler.toml:');
console.log('     [vars]');
console.log('     ADMIN_SECRET = "your-strong-password"\n');
console.log('  2. Deploy:');
console.log('     npm run deploy\n');
console.log('  3. Visit /admin on your deployed site to configure branding.\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
