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
import { deriveKeyPBKDF2, encryptArrayBufferWithAesGcm, arrayBufferToBase64, encryptWithRecipientPublicKey } from "../../../_utils/cryptoClient";
import { collection, addDoc, serverTimestamp, query as firestoreQuery, where, getDocs } from "firebase/firestore";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState("");
  const [recipient, setRecipient] = useState("");
  const [sendStatus, setSendStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [passphrase, setPassphrase] = useState("");
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

  // 🔹 Scan file for viruses (auto-triggered)
  const handleScanVirus = async (fileToScan) => {
    setScanning(true);
    setScanResult(null);

    try {
      const formData = new FormData();
      formData.append("file", fileToScan);

      const res = await fetch("/api/scan-virus", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setScanResult(data.data);
      } else {
        console.error("Scan error:", data.error);
        setScanResult(null);
      }
    } catch (err) {
      console.error("Scan error:", err);
      setScanResult(null);
    } finally {
      setScanning(false);
    }
  };

  // 🔹 Handle file selection and auto-scan
  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    setScanResult(null);
    if (selectedFile) {
      handleScanVirus(selectedFile);
    }
  };

  // 🔹 Upload to Firebase Storage
  const handleUpload = () => {
    if (!file) return alert("Please select a file first!");
    
    // Prevent upload if malware detected
    if (scanResult && !scanResult.safe) {
      return alert("⚠️ Malware detected! Cannot upload this file.");
    }
    // If user provided a passphrase, encrypt the file client-side using PBKDF2 -> AES-GCM
    const doUpload = async () => {
      try {
        if (passphrase && passphrase.trim() !== "") {
          // Read file as ArrayBuffer
          const ab = await file.arrayBuffer();
          // Derive key and get salt
          const { key, salt } = await deriveKeyPBKDF2(passphrase);
          // Encrypt
          const { cipher, iv } = await encryptArrayBufferWithAesGcm(key, ab);
          // Upload encrypted blob
          const blob = new Blob([cipher], { type: "application/octet-stream" });
          const fileRef = storageRef(storage, `uploads/${file.name}.enc`);
          const uploadTask = uploadBytesResumable(fileRef, blob);
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              setProgress(
                Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
              );
            },
            (error) => console.error("❌ Upload Error:", error),
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setUrl(downloadURL);
              // Save metadata: salt and iv (base64)
              await addDoc(collection(db, "sharedFiles"), {
                recipientEmail: recipient,
                fileUrl: downloadURL,
                fileName: file.name,
                encrypted: true,
                salt: salt,
                iv: iv,
                createdAt: serverTimestamp(),
              });
              console.log("✅ Uploaded encrypted file URL:", downloadURL);
            }
          );
        } else {
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
                    (error) => console.error('❌ Upload Error:', error),
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
            (error) => console.error("❌ Upload Error:", error),
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
        }
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
            <div className="mt-3">
              <input
                type="password"
                placeholder="Optional passphrase to encrypt file"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full border p-2 rounded"
              />
              <p className="text-xs text-gray-500 mt-1">If provided, the file will be encrypted client-side using a key derived from this passphrase.</p>
            </div>
            {scanning && (
              <p className="ml-2 inline-block text-purple-600 text-sm">🔍 Scanning for viruses...</p>
            )}
            {progress > 0 && (
              <p className="mt-3 text-gray-700 text-sm">Progress: {progress}%</p>
            )}
            {scanResult && (
              <div
                className={`mt-4 p-4 rounded-md text-sm ${
                  scanResult.safe
                    ? "bg-green-50 border border-green-300"
                    : "bg-red-50 border border-red-300"
                }`}
              >
                <p
                  className={`font-semibold ${
                    scanResult.safe ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {scanResult.safe
                    ? "✅ File is Safe"
                    : "⚠️ Malware Detected"}
                </p>
                
              </div>
            )}
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
              className="w-full border p-2 rounded mb-3"
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
