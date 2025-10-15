"use client";
import React, { useState, useRef } from "react";
import { storage } from "../../../firebase/config";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState("");
  const [recipient, setRecipient] = useState("");
  const [sendStatus, setSendStatus] = useState("");
  const inputRef = useRef();

  // Upload file to Firebase
  const handleUpload = () => {
    if (!file) return alert("Please select a file first!");

    const fileRef = storageRef(storage, `uploads/${file.name}`);
    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        setProgress(
          Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
        );
      },
      (error) => console.error(error),
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then(setUrl);
      }
    );
  };

  // Send email via API
  const handleSend = async () => {
    if (!url) return alert("Upload a file first before sending.");
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
      console.error(err);
      setSendStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md w-96 text-center">
        <h2 className="text-2xl font-bold mb-4 text-blue-600">Upload File</h2>

        <input
          type="file"
          ref={inputRef}
          onChange={(e) => setFile(e.target.files[0])}
          className="mb-4 w-full border p-2 rounded"
        />

        <button
          onClick={handleUpload}
          className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        >
          Upload
        </button>

        {progress > 0 && (
          <p className="mt-4 text-sm text-gray-700">Progress: {progress}%</p>
        )}

        {url && (
          <p className="mt-4 text-green-600 text-sm break-all">
            File uploaded:{" "}
            <a href={url} target="_blank" className="underline">
              {file?.name}
            </a>
          </p>
        )}

        <div className="mt-6 border-t pt-6 text-left">
          <h3 className="text-lg font-semibold mb-2">Send to recipient</h3>
          <input
            type="email"
            placeholder="Recipient email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="w-full border p-2 rounded mb-3"
          />

          <button
            onClick={handleSend}
            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
          >
            {sendStatus === "sending" ? "Sending..." : "Send"}
          </button>

          {sendStatus === "sent" && (
            <p className="mt-3 text-sm text-green-600">Email sent successfully.</p>
          )}
          {sendStatus === "error" && (
            <p className="mt-3 text-sm text-red-600">Failed to send email.</p>
          )}
        </div>
      </div>
    </div>
  );
}
