"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { storage, db, auth } from "../../../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL
} from "firebase/storage";
import { encryptWithRecipientPublicKey } from "../../../_utils/cryptoClient";
import {
  collection,
  addDoc,
  serverTimestamp
} from "firebase/firestore";

export default function UploadPage() {
  const router = useRouter();

  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState("");
  const [recipient, setRecipient] = useState("");
  const [sendStatus, setSendStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const inputRef = useRef(null);

  // Redirect if user not logged in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/signin");
    });
    return () => unsub();
  }, [router]);

  const handleFileSelect = (f) => {
    setFile(f);
    setProgress(0);
    setUrl("");
  };

  // =======================
  // 🔐 ENCRYPT & UPLOAD
  // =======================
  const handleUpload = async () => {
    if (!file) return alert("Please select a file");
    if (!recipient) return alert("Enter recipient email");

    try {
      console.log("Encrypting file");

      // Read selected file
      const buffer = await file.arrayBuffer();

      // Encrypt (AES-only)
      const { cipher, iv } = await encryptWithRecipientPublicKey(null, buffer);

      if (!cipher || !iv) throw new Error("Encryption failed");

      const blob = new Blob([cipher], { type: "application/octet-stream" });
      const encName = file.name + ".enc";
      const fileRef = storageRef(storage, `uploads/${encName}`);

      const uploadTask = uploadBytesResumable(fileRef, blob);

      uploadTask.on(
        "state_changed",
        (snap) => {
          const p = Math.round(
            (snap.bytesTransferred / snap.totalBytes) * 100
          );
          setProgress(p);
        },

        (error) => {
          console.error("Upload failed:", error);
          alert("Upload failed");
        },

        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setUrl(downloadURL);

          // Save metadata to Firestore
          await addDoc(collection(db, "sharedFiles"), {
            fileName: encName,
            recipientEmail: recipient,
            fileUrl: downloadURL,
            encrypted: true,
            iv,
            createdAt: serverTimestamp(),
          });

          console.log("✅ File uploaded encrypted");
          alert("Encrypted file uploaded!");
        }
      );
    } catch (err) {
      console.error("Upload Error:", err);
      alert("Encryption failed. Upload cancelled.");
    }
  };

  // ==========================
  // 📧 SEND EMAIL
  // ==========================
  const handleSend = async () => {
    if (!url) return alert("Upload file first");
    if (!recipient) return alert("Recipient email required");

    setSendStatus("sending");

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient,
          fileUrl: url,
          fileName: file?.name + ".enc"   // ✅ Important
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSendStatus("sent");
      } else {
        alert(data.error || "Email failed");
        setSendStatus("error");
      }
    } catch (err) {
      console.error("Email error:", err);
      setSendStatus("error");
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12">
      <div className="w-full max-w-4xl px-4">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Upload section */}
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-xl font-bold text-blue-600 mb-4">
              Upload File
            </h2>

            <input
              type="file"
              hidden
              ref={inputRef}
              onChange={(e) => handleFileSelect(e.target.files[0])}
            />

            <div
              onClick={() => inputRef.current.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) handleFileSelect(dropped);
              }}
              className={`p-5 border-2 rounded cursor-pointer ${
                isDragging
                  ? "bg-blue-50 border-blue-600"
                  : "border-dashed border-gray-300"
              }`}
            >
              <p className="text-gray-700 text-sm">
                {file ? file.name : "Click or drag file"}
              </p>
            </div>

            <button
              onClick={handleUpload}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mt-3"
            >
              Upload 
            </button>

            {progress > 0 && (
              <p className="mt-2 text-sm text-gray-600">Progress: {progress}%</p>
            )}

            {url && (
              <p className="mt-2 text-green-600 text-sm">
                Upload completed ✔
              </p>
            )}
          </div>

          {/* Email section */}
          <div className="bg-white p-6 rounded shadow">
            <h3 className="text-xl font-bold text-blue-600 mb-4">
              Send File
            </h3>

            <input
              type="email"
              placeholder="Recipient email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full border p-2 rounded mb-4 text-gray-700"
            />

            <button
              onClick={handleSend}
              className="bg-blue-600 text-white w-full py-2 rounded hover:bg-blue-700"
            >
              {sendStatus === "sending" ? "Sending..." : "Send Email"}
            </button>

            {sendStatus === "sent" && (
              <p className="text-green-600 mt-2">Email sent!</p>
            )}

            {sendStatus === "error" && (
              <p className="text-red-600 mt-2">Failed to send email</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
