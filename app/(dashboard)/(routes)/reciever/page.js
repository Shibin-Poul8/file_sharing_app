"use client";
import { useEffect, useState } from "react";
import { db, auth } from "../../../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, orderBy, doc, setDoc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { decryptWithPrivateJwkAndEphemeral, generateECDHKeyPair } from "../../../_utils/cryptoClient";

export default function ReceiverPage() {
  const [files, setFiles] = useState([]);
  const [fileLoading, setFileLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [user, setUser] = useState(null);
  const [decryptingIdx, setDecryptingIdx] = useState(null);
  const [publicKeyExport, setPublicKeyExport] = useState(null);
  const [keyOpLoading, setKeyOpLoading] = useState(false);
  const [privateJwkText, setPrivateJwkText] = useState("");
  const [hasPrivateKey, setHasPrivateKey] = useState(false);
  const [autoDownloaded, setAutoDownloaded] = useState({});
  const router = useRouter();

  useEffect(() => {
    const fetchFiles = async (currentUser) => {
      setFetchError(null);
      setFileLoading(true);
      try {
        const q = query(
          collection(db, "sharedFiles"),
          where("recipientEmail", "==", currentUser.email),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);
        const fileList = snapshot.docs.map((doc) => doc.data());
        setFiles(fileList);
      } catch (err) {
        console.error("Error fetching files:", err);
        setFetchError(err.message || String(err));
      } finally {
        setFileLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/signin?redirect=/reciever");
        return;
      }
      setUser(currentUser);
      // load files for current user
      fetchFiles(currentUser);
      // try to read published publicKey from users/{uid}
      (async () => {
        try {
          const uDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (uDoc.exists()) {
            const data = uDoc.data();
            if (data?.publicKey) setPublicKeyExport(data.publicKey);
          }
        } catch (e) {
          // ignore
        }
        try {
          const storageKey = `ecdh_private_${currentUser.uid}`;
          const existing = localStorage.getItem(storageKey);
          if (existing) setHasPrivateKey(true);
        } catch (e) {}
      })();
    });

    // safety timeout: if nothing happens in 10s, stop loading and show a message
    const safety = setTimeout(() => {
      setFileLoading(false);
      if (!user) setFetchError('Still waiting for authentication or network — try refreshing.');
    }, 10000);

    return () => {
      clearTimeout(safety);
      unsubscribe();
    };
  }, []);

  // Auto-decrypt & download when files load and private key is present
  useEffect(() => {
    if (!user || !hasPrivateKey || !files || files.length === 0) return;

    const tryAuto = async () => {
      const storageKey = `ecdh_private_${user.uid}`;
      const privJson = localStorage.getItem(storageKey);
      if (!privJson) return;
      let privJwk;
      try {
        privJwk = JSON.parse(privJson);
      } catch (e) {
        console.warn('Invalid private JWK in localStorage');
        return;
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file || !file.encrypted) continue;
        if (!file.ephemeralPublicKey) continue; // only ECDH-supported files
        if (autoDownloaded[file.fileUrl]) continue; // already handled

        try {
          // fetch cipher
          const resp = await fetch(file.fileUrl);
          const cipherBuf = await resp.arrayBuffer();
          const plain = await decryptWithPrivateJwkAndEphemeral(privJwk, file.ephemeralPublicKey, cipherBuf, file.iv);
          const blob = new Blob([plain]);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.fileName || 'download.bin';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          setAutoDownloaded((s) => ({ ...s, [file.fileUrl]: true }));
        } catch (err) {
          console.warn('Auto-decrypt failed for', file.fileName, err);
          // continue with others
        }
      }
    };

    tryAuto();
  }, [files, hasPrivateKey, user, autoDownloaded]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Please sign in to view files.</p>
      </div>
    );
  }

  if (fileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your files...</p>
          {fetchError && <p className="text-sm text-red-500 mt-2">{fetchError}</p>}
          {user && (
            <button
              onClick={async () => {
                setFileLoading(true);
                setFetchError(null);
                try {
                  const q = query(
                    collection(db, "sharedFiles"),
                    where("recipientEmail", "==", user.email),
                    orderBy("createdAt", "desc")
                  );
                  const snapshot = await getDocs(q);
                  setFiles(snapshot.docs.map((d) => d.data()));
                } catch (err) {
                  console.error('Retry fetch failed', err);
                  setFetchError(err.message || String(err));
                } finally {
                  setFileLoading(false);
                }
              }}
              className="mt-3 px-3 py-2 bg-blue-600 text-white rounded"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white rounded-xl shadow-md p-8">
        <h2 className="text-3xl font-bold text-blue-600 mb-2">📁 Your Shared Files</h2>
        <div className="mb-4">
          <p className="text-sm text-gray-700">ECDH Key</p>
          {publicKeyExport ? (
            <div className="flex items-center gap-2 mt-2">
              <code className="break-all text-xs bg-gray-100 p-2 rounded">{publicKeyExport}</code>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(publicKeyExport).then(()=>alert('Public key copied'));
                }}
                className="ml-2 px-3 py-1 bg-blue-600 text-white rounded"
              >
                Copy
              </button>
            </div>
          ) : (
            <div className="mt-2">
              <p className="text-xs text-gray-500">No public key published for this account.</p>
              <div className="mt-2">
                <button
                  onClick={async () => {
                    try {
                      setKeyOpLoading(true);
                      const { publicKey, privateJwk } = await generateECDHKeyPair();
                      try { localStorage.setItem(`ecdh_private_${user.uid}`, JSON.stringify(privateJwk)); } catch (e) { console.warn('Could not save private key locally', e); }
                      await setDoc(doc(db, 'users', user.uid), { publicKey }, { merge: true });
                      setPublicKeyExport(publicKey);
                      alert('Keypair generated and public key published. Public key copied to clipboard.');
                      try { await navigator.clipboard.writeText(publicKey); } catch (e) {}
                    } catch (e) {
                      console.error('Key generation failed', e);
                      alert('Key generation failed: ' + (e.message || e));
                    } finally {
                      setKeyOpLoading(false);
                    }
                  }}
                  disabled={keyOpLoading}
                  className="px-3 py-2 bg-green-600 text-white rounded"
                >
                  {keyOpLoading ? 'Generating...' : 'Generate & Publish Public Key'}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="mb-4">
          <p className="text-sm text-gray-700">Private Key (for decryption)</p>
          {hasPrivateKey ? (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => {
                  try {
                    const storageKey = `ecdh_private_${user.uid}`;
                    const val = localStorage.getItem(storageKey);
                    if (!val) return alert('No private key found');
                    navigator.clipboard.writeText(val).then(()=>alert('Private JWK copied to clipboard'));
                  } catch (e) {
                    console.error(e);
                    alert('Unable to copy private key');
                  }
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded"
              >
                Export Private Key
              </button>
              <button
                onClick={() => {
                  try {
                    const storageKey = `ecdh_private_${user.uid}`;
                    localStorage.removeItem(storageKey);
                    setHasPrivateKey(false);
                    alert('Private key removed from this browser');
                  } catch (e) { console.error(e); alert('Failed to remove'); }
                }}
                className="px-3 py-1 bg-red-500 text-white rounded"
              >
                Remove Private Key
              </button>
            </div>
          ) : (
            <div className="mt-2">
              <p className="text-xs text-gray-500">No private key stored locally. If you have a backup JWK, paste it below to import.</p>
              <textarea
                value={privateJwkText}
                onChange={(e) => setPrivateJwkText(e.target.value)}
                placeholder='Paste private JWK JSON here'
                className="w-full border p-2 rounded mt-2 h-28 font-mono text-xs"
              />
              <div className="mt-2">
                <button
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(privateJwkText);
                      const storageKey = `ecdh_private_${user.uid}`;
                      localStorage.setItem(storageKey, JSON.stringify(parsed));
                      setHasPrivateKey(true);
                      setPrivateJwkText("");
                      alert('Private key imported');
                    } catch (e) {
                      console.error(e);
                      alert('Invalid JSON');
                    }
                  }}
                  className="px-3 py-2 bg-green-600 text-white rounded"
                >
                  Import Private Key
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="text-gray-600 mb-6">Files that have been shared with you</p>

        {files.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-600 text-lg">No files shared with your account.</p>
            <p className="text-gray-500 text-sm mt-2">Ask others to share files with you using your email address.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {files.map((file, index) => (
              <div
                key={index}
                className="border border-gray-200 p-4 rounded-lg hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 break-all">📄 {file.fileName}</p>
                    <p className="text-xs text-gray-500 mt-1">Shared on: {file.createdAt?.seconds ? new Date(file.createdAt.seconds * 1000).toLocaleDateString() : "Unknown"}</p>
                  </div>
                </div>

                {file.encrypted ? (
                  <div className="space-y-2">
                    {!file.ephemeralPublicKey ? (
                      <div className="space-y-2">
                        <p className="text-sm text-yellow-700">Encrypted with an unsupported (legacy) method — only ECDH-encrypted files are supported here.</p>
                        <button
                          disabled
                          className="w-full bg-gray-400 text-white px-4 py-2 rounded"
                        >
                          Unsupported
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          try {
                            setDecryptingIdx(index);
                            const storageKey = `ecdh_private_${user.uid}`;
                            const privJson = localStorage.getItem(storageKey);
                            if (!privJson) throw new Error('Private key not found in this browser. You need the private key to decrypt ECDH-encrypted files.');
                            const privJwk = JSON.parse(privJson);
                            // Use convenience wrapper to derive shared key and decrypt
                            const resp = await fetch(file.fileUrl);
                            const cipherBuf = await resp.arrayBuffer();
                            const plain = await decryptWithPrivateJwkAndEphemeral(privJwk, file.ephemeralPublicKey, cipherBuf, file.iv);
                            const blob = new Blob([plain]);
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = file.fileName || 'download.bin';
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(url);
                          } catch (err) {
                            console.error('Decrypt failed', err);
                            alert('Decryption failed: ' + (err.message || err));
                          } finally {
                            setDecryptingIdx(null);
                          }
                        }}
                        disabled={decryptingIdx === index}
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                      >
                        {decryptingIdx === index ? 'Decrypting...' : 'Decrypt & Download'}
                      </button>
                    )}
                  </div>
                ) : (
                  <a href={file.fileUrl} target="_blank" rel="noreferrer" className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition inline-block text-center mt-3">⬇️ Download</a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
