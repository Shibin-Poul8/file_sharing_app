"use client";
import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { storage, db, auth } from "../../../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { encryptWithRecipientPublicKey } from "../../../_utils/cryptoClient";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState("");
  const [recipient, setRecipient] = useState("");
  const [sendStatus, setSendStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef();

  // Redirect unauthenticated users
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/signin");
      }
    });
    return () => unsub();
  }, []);

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a file first!");
    if (!recipient) return alert("Enter a recipient email!");

    const cleanedRecipient = recipient.trim().toLowerCase();
    console.log("🔍 Recipient typed:", cleanedRecipient);

    try {
      // Fetch recipient's public key
      const q = query(
        collection(db, "users"),
        where("email", "==", cleanedRecipient)
      );

      const snap = await getDocs(q);

      console.log("📌 Query empty?", snap.empty);
      if (snap.empty) {
        alert("Cannot encrypt. Recipient not found or has no public key.");
        return;
      }

      const recipientDoc = snap.docs[0].data();
      console.log("📌 Recipient doc:", recipientDoc);

      const recipientPub = recipientDoc.publicKey;
      if (!recipientPub) {
        alert("Cannot encrypt. Recipient has no public key.");
        return;
      }

      // Convert file → ArrayBuffer
      const fileBuffer = await file.arrayBuffer();

      console.log("🔐 Encrypting with recipient public key…");
      const { cipher, iv, ephemeralPublicKey } =
        await encryptWithRecipientPublicKey(recipientPub, fileBuffer);

      console.log("🔐 Encryption success. Uploading encrypted file…");

      // Create encrypted blob
      const encryptedBlob = new Blob([cipher], {
        type: "application/octet-stream",
      });

      // Upload .enc file to Firebase Storage
      const fileRef = storageRef(storage, `uploads/${file.name}.enc`);
      const uploadTask = uploadBytesResumable(fileRef, encryptedBlob);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          setProgress(
            Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            )
          );
        },
        (error) => console.error("Upload Error:", error),
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setUrl(downloadURL);

          // Save metadata in Firestore
          await addDoc(collection(db, "sharedFiles"), {
            recipientEmail: cleanedRecipient,
            fileUrl: downloadURL,
            fileName: file.name,
            encrypted: true,
            ephemeralPublicKey,
            iv,
            createdAt: serverTimestamp(),
          });

          console.log("✅ Encrypted file uploaded:", downloadURL);
          alert("File uploaded securely with encryption!");
        }
      );
    } catch (err) {
      console.error("❌ Upload/encrypt error:", err);
    }
  };

  const handleSend = async () => {
    if (!url) return alert("Upload first!");
    if (!recipient) return alert("Enter recipient email!");

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

      const data = await res.json();
      setSendStatus(data.success ? "sent" : "error");
    } catch (err) {
      console.error(err);
      setSendStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12">
      <div className="w-full max-w-4xl px-4">
        <div className="flex flex-col md:flex-row md:space-x-6 space-y-6 md:space-y-0">
          {/* Upload box */}
          <div className="md:w-1/2 bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-blue-600">Upload File</h2>

            <input
              type="file"
              ref={inputRef}
              onChange={(e) => handleFileSelect(e.target.files[0])}
              className="hidden"
            />

            <div
              onClick={() => inputRef.current && inputRef.current.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) handleFileSelect(dropped);
              }}
              className={`mb-4 p-6 border-2 rounded-md cursor-pointer ${
                isDragging
                  ? "border-blue-600 bg-blue-50"
                  : "border-dashed border-gray-300"
              }`}
            >
              <p className="text-sm text-gray-700">
                {file ? file.name : "Drag & drop or click to select a file"}
              </p>
            </div>

            <button
              onClick={handleUpload}
              className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              Upload (Encrypted)
            </button>

            {progress > 0 && (
              <p className="mt-3 text-gray-700 text-sm">Progress: {progress}%</p>
            )}

            {url && (
              <p className="mt-3 text-green-600 text-sm break-all">
                File uploaded successfully!
              </p>
            )}
          </div>

          {/* Email sending box */}
          <div className="md:w-1/2 bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-semibold mb-2 text-blue-600">
              Send to recipient
            </h3>

            <input
              type="email"
              placeholder="Recipient email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full border p-2 rounded mb-3 text-gray-800"
            />

            <button
              onClick={handleSend}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              {sendStatus === "sending" ? "Sending..." : "Send Email"}
            </button>

            {sendStatus === "sent" && (
              <p className="mt-3 text-green-600 text-sm">
                Email sent successfully!
              </p>
            )}
            {sendStatus === "error" && (
              <p className="mt-3 text-red-600 text-sm">
                Failed to send email.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
