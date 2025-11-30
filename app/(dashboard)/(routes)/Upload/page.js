// app/(dashboard)/(routes)/Upload/page.js
"use client";
import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { storage, db, auth } from "../../../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
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
  const inputRef = useRef();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/signin");
    });
    return () => unsub();
  }, [router]);

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    setUrl("");
    setProgress(0);
  };

  const handleUpload = () => {
    if (!file) return alert("Please select a file first!");
    if (!recipient) return alert("Please enter recipient email.");

    const doUpload = async () => {
      try {
        // Try to get recipient public key from Firestore
        let recipientPub = null;
        if (manualRecipientPub && manualRecipientPub.trim()) {
          recipientPub = manualRecipientPub.trim();
        } else {
          const q = firestoreQuery(collection(db, "users"), where("email", "==", recipient));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const doc = snap.docs[0].data();
            recipientPub = doc?.publicKey || null;
          }
        }

        // If recipient public key exists -> encrypt and upload .enc
        if (recipientPub) {
          try {
            const ab = await file.arrayBuffer();
            const { cipher, iv, ephemeralPublicKey } = await encryptWithRecipientPublicKey(recipientPub, ab);

            // Create blob from Uint8Array cipher (DO NOT use .buffer alone)
            const blob = new Blob([cipher], { type: "application/octet-stream" });
            const encName = `${file.name}.enc`;
            const fileRef = storageRef(storage, `uploads/${encName}`);
            const uploadTask = uploadBytesResumable(fileRef, blob);

            uploadTask.on(
              "state_changed",
              (snapshot) => setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
              (error) => {
                console.error(" Upload Error:", error);
                alert("Upload failed: " + error.message);
              },
              async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                setUrl(downloadURL);
                // Save metadata to Firestore (sharedFiles)
                await addDoc(collection(db, "sharedFiles"), {
                  recipientEmail: recipient,
                  fileUrl: downloadURL,
                  fileName: file.name,
                  encrypted: true,
                  ephemeralPublicKey,
                  iv, // base64 string (no padding)
                  createdAt: serverTimestamp(),
                });
                console.log("✅ Uploaded ECDH-encrypted file URL:", downloadURL);
              }
            );

            return;
          } catch (e) {
            console.warn("ECDH upload failed, fallback to plain upload:", e);
            // fallback to plain upload below
          }
        }

        // Plain upload fallback (unencrypted)
        const fileRef = storageRef(storage, `uploads/${file.name}`);
        const uploadTask = uploadBytesResumable(fileRef, file);

        uploadTask.on(
          "state_changed",
          (snapshot) => setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
          (error) => {
            console.error(" Upload Error:", error);
            alert("Upload failed: " + error.message);
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            setUrl(downloadURL);
            await addDoc(collection(db, "sharedFiles"), {
              recipientEmail: recipient,
              fileUrl: downloadURL,
              fileName: file.name,
              encrypted: false,
              createdAt: serverTimestamp(),
            });
            console.log("✅ Uploaded plain file URL:", downloadURL);
          }
        );
      } catch (err) {
        console.error("Upload/encrypt error", err);
        alert("Upload error: " + (err.message || err));
      }
    };

    doUpload();
  };

  const handleSend = async () => {
    if (!url) return alert("File not uploaded yet!");
    if (!recipient) return alert("Please enter recipient email.");

    setSendStatus("sending");
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient, fileUrl: url, fileName: file ? file.name : "" }),
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
          <div className="md:w-1/2 bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-blue-600">Upload File</h2>
            <input type="file" ref={inputRef} onChange={(e) => handleFileSelect(e.target.files[0])} className="hidden" />
            <div onClick={() => inputRef.current && inputRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const dropped = e.dataTransfer.files?.[0]; if (dropped) handleFileSelect(dropped); }}
              className={`mb-4 p-6 border-2 rounded-md cursor-pointer ${isDragging ? "border-blue-600 bg-blue-50" : "border-dashed border-gray-300"}`}>
              <p className="text-sm text-gray-700">{file ? file.name : "Drag & drop or click to select a file"}</p>
            </div>
            <button onClick={handleUpload} className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">Upload</button>
            {progress > 0 && <p className="mt-3 text-gray-700 text-sm">Progress: {progress}%</p>}
            {url && <p className="mt-3 text-green-600 text-sm break-all">File uploaded successfully!</p>}
          </div>

          <div className="md:w-1/2 bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-semibold mb-2 text-blue-600">Send to recipient</h3>
            <input type="email" placeholder="Recipient email" value={recipient} onChange={(e) => setRecipient(e.target.value)} className="w-full border p-2 rounded mb-3 text-gray-800"/>
            <textarea placeholder="Manual public key (optional)" value={manualRecipientPub} onChange={(e) => setManualRecipientPub(e.target.value)} className="w-full border p-2 rounded mb-3 h-24 text-xs font-mono"></textarea>
            <button onClick={handleSend} className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
              {sendStatus === "sending" ? "Sending..." : "Send"}
            </button>
            {sendStatus === "sent" && <p className="mt-3 text-green-600 text-sm">Email sent successfully!</p>}
            {sendStatus === "error" && <p className="mt-3 text-red-600 text-sm">Failed to send email.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
