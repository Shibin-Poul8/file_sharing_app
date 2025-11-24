// Client-side crypto helpers using Web Crypto API
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ECDH-only flow: helpers for AES-GCM encryption and ECDH key agreement.

export async function encryptArrayBufferWithAesGcm(key, arrayBuffer) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    arrayBuffer
  );
  return { cipher: new Uint8Array(cipherBuffer), iv: arrayBufferToBase64(iv.buffer) };
}

export async function decryptArrayBufferWithAesGcm(key, cipherBuffer, ivBase64) {
  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
  const plainBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherBuffer
  );
  return plainBuffer; // ArrayBuffer
}

export { arrayBufferToBase64, base64ToArrayBuffer };

// ---- ECDH helpers ----
export async function generateECDHKeyPair() {
  const kp = await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const rawPub = await window.crypto.subtle.exportKey('raw', kp.publicKey); // ArrayBuffer
  const pubBase64 = arrayBufferToBase64(rawPub);
  const privJwk = await window.crypto.subtle.exportKey('jwk', kp.privateKey);
  // return both the exported private JWK and the in-memory private CryptoKey
  return { publicKey: pubBase64, privateJwk: privJwk, privateKey: kp.privateKey };
}

export async function importECDHPublicKey(pubBase64) {
  const ab = base64ToArrayBuffer(pubBase64);
  return await window.crypto.subtle.importKey(
    'raw',
    ab,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

export async function importECDHPrivateKeyFromJwk(jwk) {
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

export async function deriveSharedAesKeyFromECDH(privateJwkOrKey, otherPublicBase64) {
  let privateKey;
  if (privateJwkOrKey && privateJwkOrKey.kty) {
    privateKey = await importECDHPrivateKeyFromJwk(privateJwkOrKey);
  } else if (privateJwkOrKey && privateJwkOrKey.type === 'private') {
    privateKey = privateJwkOrKey; // assume CryptoKey
  } else {
    throw new Error('Invalid private key provided');
  }

  const publicKey = await importECDHPublicKey(otherPublicBase64);

  // Derive AES-GCM 256-bit key directly
  const derivedKey = await window.crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

// Convenience wrapper: encrypt plaintext ArrayBuffer for a recipient's ECDH public key.
// Returns { cipher: Uint8Array, iv: string (base64), ephemeralPublicKey: string }
export async function encryptWithRecipientPublicKey(recipientPublicBase64, plainArrayBuffer) {
  // generate ephemeral keypair
  const kp = await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  const rawPub = await window.crypto.subtle.exportKey('raw', kp.publicKey);
  const ephemeralPubBase64 = arrayBufferToBase64(rawPub);

  // import recipient public and derive shared AES key
  const recipientPub = await importECDHPublicKey(recipientPublicBase64);
  const derivedKey = await window.crypto.subtle.deriveKey(
    { name: 'ECDH', public: recipientPub },
    kp.privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const { cipher, iv } = await encryptArrayBufferWithAesGcm(derivedKey, plainArrayBuffer);
  return { cipher, iv, ephemeralPublicKey: ephemeralPubBase64 };
}

// Convenience wrapper: decrypt cipher (ArrayBuffer or Uint8Array) using recipient's private JWK and sender's ephemeral public key (base64).
// Returns decrypted ArrayBuffer.
export async function decryptWithPrivateJwkAndEphemeral(privateJwk, ephemeralPublicBase64, cipherBuffer, ivBase64) {
  const aesKey = await deriveSharedAesKeyFromECDH(privateJwk, ephemeralPublicBase64);
  // cipherBuffer may be Uint8Array or ArrayBuffer
  const buf = cipherBuffer instanceof Uint8Array ? cipherBuffer.buffer : cipherBuffer;
  const plain = await decryptArrayBufferWithAesGcm(aesKey, buf, ivBase64);
  return plain;
}
