"use client";
import { useEffect, useState } from "react";
import { db, auth } from "../../../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { deriveKeyPBKDF2, decryptArrayBufferWithAesGcm, decryptWithPrivateJwkAndEphemeral } from "../../../_utils/cryptoClient";

export default function ReceiverPage() {
  const [files, setFiles] = useState([]);
  const [fileLoading, setFileLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [user, setUser] = useState(null);
  const [passphrases, setPassphrases] = useState({});
  const [decryptingIdx, setDecryptingIdx] = useState(null);
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
                    <input
                      type="password"
                      placeholder="Enter passphrase to decrypt"
                      value={passphrases[index] || ""}
                      onChange={(e) => setPassphrases((p) => ({ ...p, [index]: e.target.value }))}
                      className="w-full border p-2 rounded mb-2"
                    />
                    <button
                      onClick={async () => {
                        try {
                          setDecryptingIdx(index);
                          // Two supported encrypted types:
                          // 1) passphrase-based: file.salt + file.iv
                          // 2) ECDH-based: file.ephemeralPublicKey + file.iv
                          let aesKey;
                          if (file.ephemeralPublicKey) {
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
                            setDecryptingIdx(null);
                            return;
                          } else {
                            const pass = passphrases[index];
                            if (!pass) throw new Error('Please enter the passphrase');
                            const { key } = await deriveKeyPBKDF2(pass, file.salt);
                            aesKey = key;
                          }
                          const resp = await fetch(file.fileUrl);
                          const cipherBuf = await resp.arrayBuffer();
                          const plain = await decryptArrayBufferWithAesGcm(aesKey, cipherBuf, file.iv);
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
