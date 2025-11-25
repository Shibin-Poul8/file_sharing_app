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
import { collection, addDoc, serverTimestamp, query as firestoreQuery, where, getDocs } from "firebase/firestore";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState("");
  const [recipient, setRecipient] = useState("");
  const [manualRecipientPub, setManualRecipientPub] = useState("");
  const [sendStatus, setSendStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  // Virus scanning moved to receiver side; no scan state needed here
  const inputRef = useRef();

  // Redirect unauthenticated users to signin
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        // User is signed out — redirect to signin
        router.replace("/signin");
      }
    });
    return () => unsub();
  }, []);

  // Upload page no longer scans files; scanning happens on the recipient side before download.

  // 🔹 Handle file selection and auto-scan
  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
  };

  // 🔹 Upload to Firebase Storage
  const handleUpload = () => {
    if (!file) return alert("Please select a file first!");
    
    // Upload is allowed; files will be scanned when the recipient downloads them.
    // ECDH-focused upload: try ECDH encryption for recipient, otherwise fallback to plain upload
    const doUpload = async () => {
      try {
        // Try ECDH: find recipient public key in users collection by email
        try {
          const q = firestoreQuery(collection(db, 'users'), where('email', '==', recipient));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const recipientDoc = snap.docs[0].data();
            const recipientPub = recipientDoc?.publicKey;
            if (recipientPub) {
              try {
                const ab = await file.arrayBuffer();
                // Use convenience wrapper that generates ephemeral key, derives AES key and encrypts
                const { cipher, iv, ephemeralPublicKey } = await encryptWithRecipientPublicKey(recipientPub, ab);

                const blob = new Blob([cipher], { type: 'application/octet-stream' });
                const fileRef = storageRef(storage, `uploads/${file.name}.enc`);
                const uploadTask = uploadBytesResumable(fileRef, blob);
                uploadTask.on(
                  'state_changed',
                  (snapshot) => setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
                  (error) => console.error(' Upload Error:', error),
                  async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    setUrl(downloadURL);
                    // Save file info and ECDH metadata (ephemeral public key)
                    await addDoc(collection(db, 'sharedFiles'), {
                      recipientEmail: recipient,
                      fileUrl: downloadURL,
                      fileName: file.name,
                      encrypted: true,
                      ephemeralPublicKey: ephemeralPublicKey,
                      iv: iv,
                      createdAt: serverTimestamp(),
                    });
                    console.log('✅ Uploaded ECDH-encrypted file URL:', downloadURL);
                  }
                );
                return; // done
              } catch (e) {
                console.warn('ECDH upload failed, falling back to plain upload', e);
              }
            }
          }
        } catch (e) {
          console.warn('ECDH upload failed, falling back to plain upload', e);
        }

        // Regular upload fallback
        const fileRef = storageRef(storage, `uploads/${file.name}`);
        const uploadTask = uploadBytesResumable(fileRef, file);

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            setProgress(
              Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            );
          },
          (error) => console.error(" Upload Error:", error),
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            setUrl(downloadURL);
            // Save file info to Firestore
            await addDoc(collection(db, "sharedFiles"), {
              recipientEmail: recipient,
              fileUrl: downloadURL,
              fileName: file.name,
              encrypted: false,
              createdAt: serverTimestamp(),
            });
            console.log("✅ Uploaded file URL:", downloadURL);
          }
        );
      } catch (err) {
        console.error('Upload/encrypt error', err);
      }
    };

    doUpload();
  };

  // 🔹 Send file email
  const handleSend = async () => {
    if (!url) return alert("File not uploaded yet!");
    if (!recipient) return alert("Please enter recipient email.");

    setSendStatus("sending");
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient, fileUrl: url, fileName: file.name }),
      });
      const data = await res.json();
      setSendStatus(data.success ? "sent" : "error");
    } catch (err) {
      console.error("Email error:", err);
      setSendStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12">
      <div className="w-full max-w-4xl px-4">
        <div className="flex flex-col md:flex-row md:space-x-6 space-y-6 md:space-y-0">
          {/* Upload section */}
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
              Upload
            </button>
            
            {/* Virus scanning moved to receiver; upload UI no longer shows scanning state */}
            {progress > 0 && (
              <p className="mt-3 text-gray-700 text-sm">Progress: {progress}%</p>
            )}
            {/* Scanning results are shown on the receiver page during download */}
            {url && (
              <p className="mt-3 text-green-600 text-sm break-all">
                File uploaded successfully!
              </p>
            )}
          </div>

          {/* Send section */}
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
              {sendStatus === "sending" ? "Sending..." : "Send"}
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
