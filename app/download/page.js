"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { db, storage } from "../firebase/config.js";
import { doc, getDoc } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";

export default function DownloadPage() {
  const params = useSearchParams();
  const fileId = params.get("file");
  const [fileData, setFileData] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchFile = async () => {
      if (!fileId) return;
      const docRef = doc(db, "sharedFiles", fileId);
      const snap = await getDoc(docRef);
      if (snap.exists()) setFileData(snap.data());
      else setError("❌ File not found or deleted.");
    };
    fetchFile();
  }, [fileId]);

  const handleDownload = async () => {
    if (!user) return alert("Login required.");
    if (user.email !== fileData.recipientEmail)
      return alert("You’re not authorized to download this file.");

    const fileRef = ref(storage, `uploads/${fileData.fileName}`);
    const downloadURL = await getDownloadURL(fileRef);
    window.open(downloadURL, "_blank");
  };

  const handleLogout = () => {
    const auth = getAuth();
    signOut(auth);
  };

  if (loading) return <p className="p-10">Loading...</p>;
  if (error) return <p className="text-red-600 p-10">{error}</p>;
  if (!fileData) return <p className="p-10">Fetching file info...</p>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-96 text-center">
        <h2 className="text-xl font-bold mb-4 text-blue-600">
          {fileData.fileName}
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Sent to: {fileData.recipientEmail}
        </p>

        {user ? (
          <>
            <p className="text-gray-700 text-sm mb-4">
              Logged in as: {user.email}
            </p>
            <button
              onClick={handleDownload}
              className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              Download File
            </button>
            <button
              onClick={handleLogout}
              className="ml-3 bg-gray-400 text-white py-2 px-4 rounded hover:bg-gray-500"
            >
              Logout
            </button>
          </>
        ) : (
          <p className="text-red-500 text-sm">
            Please log in to access this file.
          </p>
        )}
      </div>
    </div>
  );
}
