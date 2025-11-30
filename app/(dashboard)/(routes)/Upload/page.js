"use client";
import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { storage, db, auth } from "../../../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { encryptWithRecipientPublicKey } from "../../../_utils/cryptoClient";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState("");
  const [recipient, setRecipient] = useState("");
  const [sendStatus, setSendStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef();

  // Protect route
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/signin");
    });
    return () => unsub();
  }, []);

  const handleFileSelect = (file) => setFile(file);

  // 🔒 Upload & Encrypt
  const handleUpload = async () => {
    if (!file) return alert("Select a file");
    if (!recipient) return alert("Enter recipient email");

    setProgress(0);
    setUrl("");

    try {
      const email = recipient.trim().toLowerCase();

      // Fetch recipient public key
      const q = query(collection(db, "users"), where("email", "==", email));
      const snap = await getDocs(q);

      if (snap.empty) {
        alert("Recipient not registered");
        return;
      }

      const recipientPub = snap.docs[0].data().publicKey;
      if (!recipientPub) {
        alert("Recipient has no encryption key");
        return;
      }

      // Encrypt file
      const fileBuffer = await file.arrayBuffer();
      const { cipher, iv, ephemeralPublicKey } =
        await encryptWithRecipientPublicKey(recipientPub, fileBuffer);

      const encryptedBlob = new Blob([cipher], { type: "application/octet-stream" });

      const fileRef = storageRef(storage, `uploads/${file.name}.enc`);

      const uploadTask = uploadBytesResumable(fileRef, encryptedBlob);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        },
        (error) => {
          console.error("Upload failed:", error);
          alert("Upload error: " + error.message);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setUrl(downloadURL);

          await addDoc(collection(db, "sharedFiles"), {
            recipientEmail: email,
            fileUrl: downloadURL,
            fileName: file.name,
            encrypted: true,
            ephemeralPublicKey,
            iv,
            createdAt: serverTimestamp(),
          });

          alert("✅ File encrypted and uploaded!");
        }
      );

    } catch (err) {
      console.error("Encryption/Upload Failure:", err);
      alert("Error: " + err.message);
    }
  };

  // 📧 Send Email (Fixed)
  const handleSend = async () => {
    if (!url) return alert("Upload file first");
    if (!recipient) return alert("Recipient email missing");

    setSendStatus("sending");

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: recipient.trim().toLowerCase(),
          fileUrl: url,
          fileName: file.name,
        }),
      });

      const raw = await res.text();
      console.log("Email API Response:", raw);

      const data = JSON.parse(raw);

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Email failed");
      }

      setSendStatus("sent");
      alert("✅ Email successfully sent!");

    } catch (err) {
      console.error("Email Error:", err);
      alert(err.message);
      setSendStatus("error");
    }
  };

  return (
    <div suppressHydrationWarning className="min-h-screen flex justify-center bg-gray-100 py-10">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Upload */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-xl font-bold mb-4 text-blue-600">Upload & Encrypt</h2>

          <input
            hidden
            type="file"
            ref={inputRef}
            onChange={(e) => handleFileSelect(e.target.files[0])}
          />

          <div
            onClick={() => inputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFileSelect(e.dataTransfer.files[0]);
            }}
            className={`border p-5 rounded cursor-pointer mb-4 ${isDragging ? "border-blue-600 bg-blue-50" : "border-dashed"}`}
          >
            {file ? file.name : "Click or drag file"}
          </div>

          <button onClick={handleUpload} className="bg-blue-600 text-white p-2 rounded w-full">
            Upload Encrypted
          </button>

          {progress > 0 && <p className="mt-2">Progress: {progress}%</p>}
          {url && <p className="mt-2 text-green-600">✅ Upload complete!</p>}
        </div>

        {/* Email */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-xl font-bold mb-4 text-blue-600">Send Email</h2>

          <input
            type="email"
            placeholder="Recipient email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="border p-2 w-full rounded mb-3"
          />

          <button
            onClick={handleSend}
            disabled={!url}
            className="bg-blue-600 disabled:bg-gray-400 text-white p-2 w-full rounded"
          >
            {sendStatus === "sending" ? "Sending..." : "Send Email"}
          </button>

          {sendStatus === "sent" && <p className="text-green-600 mt-2">Email sent!</p>}
          {sendStatus === "error" && <p className="text-red-600 mt-2">Failed.</p>}
        </div>

      </div>
    </div>
  );
}
