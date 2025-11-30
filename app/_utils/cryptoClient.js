// -----------------------------------------------------
//  FIXED CRYPTO CLIENT (AES-GCM + ECDH)
//  Includes buffer fixes, IV padding fix, Uint8 handling
// -----------------------------------------------------

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// Base64 helpers
export function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// AES-GCM ENCRYPT
export async function encryptArrayBufferWithAesGcm(aesKey, plainBuffer) {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    plainBuffer
  );

  return {
    cipher: new Uint8Array(cipherBuffer), // IMPORTANT FIX
    iv: arrayBufferToBase64(iv.buffer).replace(/=*$/, ""), // strip padding, fix later
  };
}

// AES-GCM DECRYPT
export async function decryptArrayBufferWithAesGcm(aesKey, cipherUint8, ivB64) {
  // FIX IV PADDING
  while (ivB64.length % 4 !== 0) ivB64 += "=";

  const iv = new Uint8Array(base64ToArrayBuffer(ivB64));

  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    cipherUint8
  );

  return plain;
}

// ECDH key management
export async function generateECDHKeyPair() {
  const kp = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );

  const rawPub = await crypto.subtle.exportKey("raw", kp.publicKey);

  return {
    publicKey: arrayBufferToBase64(rawPub),
    privateJwk: await crypto.subtle.exportKey("jwk", kp.privateKey),
  };
}

async function importECDHPublicKey(pubB64) {
  return crypto.subtle.importKey(
    "raw",
    base64ToArrayBuffer(pubB64),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

async function importECDHPrivateKey(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
}

// ECDH ENCRYPT
export async function encryptWithRecipientPublicKey(recipientPubB64, plainArrayBuffer) {
  // Generate ephemeral keypair
  const ephKey = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );

  const ephPubRaw = await crypto.subtle.exportKey("raw", ephKey.publicKey);
  const ephPubB64 = arrayBufferToBase64(ephPubRaw);

  // Import recipient public key
  const recipientPub = await importECDHPublicKey(recipientPubB64);

  // Derive AES key
  const aesKey = await crypto.subtle.deriveKey(
    { name: "ECDH", public: recipientPub },
    ephKey.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  // Encrypt file
  const { cipher, iv } = await encryptArrayBufferWithAesGcm(aesKey, plainArrayBuffer);

  return { cipher, iv, ephemeralPublicKey: ephPubB64 };
}


// ECDH DECRYPT
export async function decryptWithPrivateJwkAndEphemeral(privJwk, ephPubB64, cipherBuf, ivB64) {
  const privateKey = await importECDHPrivateKey(privJwk);

  const ephPub = await importECDHPublicKey(ephPubB64);

  const aesKey = await crypto.subtle.deriveKey(
    { name: "ECDH", public: ephPub },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  // FIX: Always convert to Uint8Array
  const cipherUint8 =
    cipherBuf instanceof Uint8Array ? cipherBuf : new Uint8Array(cipherBuf);

  return await decryptArrayBufferWithAesGcm(aesKey, cipherUint8, ivB64);
}
