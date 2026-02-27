/**
 * Browser-side AES-GCM-256 encryption for Deadrop.
 * Uses the Web Crypto API — runs only in the browser.
 * The key never leaves the client; only ciphertext is sent to the server.
 *
 * Passphrase mode: key is derived via PBKDF2(passphrase, salt, 100k, SHA-256).
 * The salt goes in the URL fragment as `p:{salt}` — no key transmitted at all.
 */

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypt a plaintext string with a fresh AES-GCM-256 key.
 * Returns base64url-encoded ciphertext, IV, and key.
 */
export async function encryptSecret(
  plaintext: string
): Promise<{ ciphertext: string; iv: string; keyB64: string }> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  const rawKey = await crypto.subtle.exportKey('raw', key);

  return {
    ciphertext: toBase64Url(ciphertextBuf),
    iv: toBase64Url(iv.buffer),
    keyB64: toBase64Url(rawKey),
  };
}

/**
 * Decrypt a ciphertext using the provided IV and key (all base64url-encoded).
 * Returns the original plaintext string.
 */
export async function decryptSecret(
  ciphertext: string,
  iv: string,
  keyB64: string
): Promise<string> {
  const rawKey = fromBase64Url(keyB64);
  const key = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const ivBytes = fromBase64Url(iv);
  const ciphertextBytes = fromBase64Url(ciphertext);

  const plaintextBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    ciphertextBytes
  );

  return new TextDecoder().decode(plaintextBuf);
}

/**
 * Encrypt with a passphrase using PBKDF2 key derivation.
 * Returns ciphertext, iv, and the base64url-encoded PBKDF2 salt.
 * The salt goes in the URL fragment (`p:{saltB64}`) — no key is ever transmitted.
 */
export async function encryptWithPassphrase(
  plaintext: string,
  passphrase: string
): Promise<{ ciphertext: string; iv: string; saltB64: string }> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    enc.encode(plaintext)
  );

  return {
    ciphertext: toBase64Url(ciphertextBuf),
    iv: toBase64Url(iv.buffer),
    saltB64: toBase64Url(salt.buffer),
  };
}

/**
 * Decrypt a passphrase-protected secret.
 * The salt comes from the URL fragment (`p:{saltB64}`).
 */
export async function decryptWithPassphrase(
  ciphertext: string,
  iv: string,
  saltB64: string,
  passphrase: string
): Promise<string> {
  const enc = new TextEncoder();
  const salt = fromBase64Url(saltB64);

  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const plaintextBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(iv) },
    aesKey,
    fromBase64Url(ciphertext)
  );

  return new TextDecoder().decode(plaintextBuf);
}

/**
 * Generate a cryptographically random password.
 */
export function generatePassword(length = 20): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => charset[b % charset.length]).join('');
}
