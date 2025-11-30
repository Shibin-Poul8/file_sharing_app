// app/(dashboard)/(routes)/reciever/page.js
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
  const [loadingFile, setLoadingFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  async function runVirusTotalScan(blob, fileName) {
    const formData = new FormData();
    formData.append("file", new File([blob], fileName));
    const res = await fetch("/api/scan-virus", { method: "POST", body: formData });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Virus scan failed");
    return data.data;
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { setUser(null); setFiles([]); return; }
      setUser(currentUser);

      const q = query(
        collection(db, "sharedFiles"),
        where("recipientEmail", "==", currentUser.email),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setFiles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-2">Sign in to view received files</h2>
          <Link href="/signin?redirect=/reciever" className="px-4 py-2 bg-blue-600 text-white rounded">Sign In</Link>
        </div>
      </div>
    );
  }

  async function handleEncryptedFile(file, index) {
    try {
      setLoadingFile(index);
      const keyJson = localStorage.getItem(`ecdh_private_${user.uid}`);
      if (!keyJson) throw new Error("Private key missing. Please sign up on this browser to store private key.");

      const privJwk = JSON.parse(keyJson);

      const resp = await fetch(file.fileUrl);
      if (!resp.ok) throw new Error("Failed to download encrypted file.");
      const cipherBuf = await resp.arrayBuffer();
      const cipherUint8 = new Uint8Array(cipherBuf);

      // iv padding (if needed)
      let ivB64 = file.iv || "";
      while (ivB64.length % 4 !== 0) ivB64 += "=";

      // Decrypt to plain ArrayBuffer
      const plainBuf = await decryptWithPrivateJwkAndEphemeral(privJwk, file.ephemeralPublicKey, cipherUint8, ivB64);

      // Make blob from decrypted data
      const decryptedBlob = new Blob([plainBuf]);

      // Scan decrypted bytes
      const scan = await runVirusTotalScan(decryptedBlob, file.fileName);
      if (!scan.safe) {
        alert("⚠️ Malware detected! File blocked.");
        setStatusMessage({ type: "error", text: "Virus detected — download blocked." });
        return;
      }

      // Download
      const url = URL.createObjectURL(decryptedBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.fileName;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMessage({ type: "success", text: "File safe — downloaded successfully." });
    } catch (err) {
      console.error("Decrypt/Download failed:", err);
      alert("Decrypt/Download failed: " + err.message);
      setStatusMessage({ type: "error", text: "Decryption failed." });
    } finally {
      setLoadingFile(null);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  }

  async function handlePlainFile(file, index) {
    try {
      setLoadingFile(index);
      const resp = await fetch(file.fileUrl);
      if (!resp.ok) throw new Error("Download failed");
      const buf = await resp.arrayBuffer();
      const blob = new Blob([buf]);

      // Scan BEFORE allowing download
      const scan = await runVirusTotalScan(blob, file.fileName);
      if (!scan.safe) {
        alert("⚠️ Malware detected! File blocked.");
        setStatusMessage({ type: "error", text: "Virus detected — download blocked." });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.fileName;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMessage({ type: "success", text: "File safe — downloaded." });
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
      setStatusMessage({ type: "error", text: "Download failed." });
    } finally {
      setLoadingFile(null);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h2 className="text-3xl font-bold text-blue-600 mb-4">📁 Files Shared With You</h2>

      {statusMessage && (
        <p className={`p-3 rounded mb-4 ${statusMessage.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {statusMessage.text}
        </p>
      )}

      {files.length === 0 && <p className="text-gray-600 text-center py-10">No files shared with your email.</p>}

      <div className="grid grid-cols-1 gap-4">
        {files.map((file, index) => (
          <div key={file.id || index} className="border p-4 rounded shadow-sm">
            <p className="font-semibold">{file.fileName}</p>
            <p className="text-xs text-gray-500">{file.createdAt?.seconds ? new Date(file.createdAt.seconds * 1000).toLocaleString() : "Unknown"}</p>

            {file.encrypted ? (
              <button onClick={() => handleEncryptedFile(file, index)} disabled={loadingFile === index} className="mt-3 w-full bg-blue-600 text-white py-2 rounded">
                {loadingFile === index ? "Decrypting…" : "Decrypt & Download"}
              </button>
            ) : (
              <button onClick={() => handlePlainFile(file, index)} disabled={loadingFile === index} className="mt-3 w-full bg-blue-600 text-white py-2 rounded">
                {loadingFile === index ? "Scanning…" : "Scan + Download"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
