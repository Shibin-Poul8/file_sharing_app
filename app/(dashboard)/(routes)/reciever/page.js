"use client";
import { useEffect, useState } from "react";
import { db, auth } from "../../../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import Link from "next/link";
import { decryptWithPrivateJwkAndEphemeral } from "../../../_utils/cryptoClient";

export default function ReceiverPage() {
  const [files, setFiles] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(-1);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setFiles([]);
        return;
      }
      setUser(u);
      const q = query(
        collection(db, "sharedFiles"),
        where("recipientEmail", "==", u.email),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div>
          <p>Please sign in</p>
          <Link href="/signin?redirect=/reciever" className="text-blue-600">Sign In</Link>
        </div>
      </div>
    );
  }

  // ✅ ALWAYS decrypt when encrypted === true
  async function decryptAndDownload(file, idx) {
    try {
      setLoading(idx);

      // 1) fetch encrypted bytes
      const res = await fetch(file.fileUrl);
      if (!res.ok) throw new Error("Cannot fetch file");
      const encBuf = await res.arrayBuffer();

      // 2) decrypt (AES-only)
      const plainBuf = await decryptWithPrivateJwkAndEphemeral(
        null, null, new Uint8Array(encBuf), file.iv
      );

      // 3) download DECRYPTED bytes
      const blob = new Blob([plainBuf]);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file.fileName.replace(".enc", "");
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);

      alert("Decrypted file downloaded ✅");
    } catch (e) {
      console.error(e);
      alert("Decryption failed");
    } finally {
      setLoading(-1);
    }
  }

  // Plain download (for records with encrypted:false)
  async function plainDownload(file, idx) {
    setLoading(idx);
    const res = await fetch(file.fileUrl);
    const buf = await res.arrayBuffer();
    const blob = new Blob([buf]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file.fileName;
    a.click();
    URL.revokeObjectURL(a.href);
    setLoading(-1);
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Files shared with you</h2>

      {files.map((f, i) => (
        <div key={f.id} className="border p-4 rounded mb-3">
          <p className="font-semibold">{f.fileName}</p>

          {f.encrypted ? (
            <button
              disabled={loading===i}
              onClick={() => decryptAndDownload(f, i)}
              className="mt-2 px-3 py-2 rounded bg-blue-600 text-white"
            >
              {loading===i ? "Decrypting..." : "Decrypt & Download"}
            </button>
          ) : (
            <button
              disabled={loading===i}
              onClick={() => plainDownload(f, i)}
              className="mt-2 px-3 py-2 rounded bg-gray-600 text-white"
            >
              Download
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
