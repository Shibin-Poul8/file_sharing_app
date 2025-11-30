// app/_utils/cryptoClient.js
// AES-256-GCM ONLY — NO ECDH

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// CHANGE THIS PASSWORD — must be SAME for encrypt & decrypt
const SECRET_PASSPHRASE = "MyStrongProjectSecret@2025";

// Derive AES key from password
async function deriveKey() {
  const enc = new TextEncoder();

  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET_PASSPHRASE),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("static-salt"),
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ENCRYPT (Upload side)
export async function encryptWithRecipientPublicKey(_, fileBuffer) {
  const aesKey = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    fileBuffer
  );

  return {
    cipher: new Uint8Array(cipherBuffer),
    iv: arrayBufferToBase64(iv),
    ephemeralPublicKey: "AES-ONLY"
  };
}

// DECRYPT (Download side)
export async function decryptWithPrivateJwkAndEphemeral(_, __, cipher, ivB64) {
  const aesKey = await deriveKey();
  const iv = new Uint8Array(base64ToArrayBuffer(ivB64));

  const data = cipher instanceof Uint8Array ? cipher : new Uint8Array(cipher);

  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    data
  );
}
