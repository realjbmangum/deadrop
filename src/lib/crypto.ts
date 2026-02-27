/**
 * Browser-side AES-GCM-256 encryption for Deadrop.
 * Uses the Web Crypto API — runs only in the browser.
 * The key never leaves the client; only ciphertext is sent to the server.
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
