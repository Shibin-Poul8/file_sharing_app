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

export async function deriveKeyPBKDF2(password, saltBase64 = null, iterations = 200000) {
  const salt = saltBase64 ? new Uint8Array(base64ToArrayBuffer(saltBase64)) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return { key, salt: arrayBufferToBase64(salt.buffer) };
}

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
  return { publicKey: pubBase64, privateJwk: privJwk };
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
