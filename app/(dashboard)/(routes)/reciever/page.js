"use client";
import { useEffect, useState } from "react";
import { db } from "../../../firebase/config";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";

export default function DownloadPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");
    if (!email) {
      alert("Invalid link — no email found.");
      return;
    }

    const fetchFiles = async () => {
      try {
        const q = query(
          collection(db, "sharedFiles"),
          where("recipientEmail", "==", email),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const fileList = snapshot.docs.map((doc) => doc.data());
        setFiles(fileList);
      } catch (err) {
        console.error("Error fetching files:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-12">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-md p-8">
        <h2 className="text-2xl font-bold text-blue-600 mb-6">📁 Shared Files</h2>

        {loading ? (
          <p>Loading files...</p>
        ) : files.length === 0 ? (
          <p>No files found for this email.</p>
        ) : (
          <ul className="space-y-4">
            {files.map((file, index) => (
              <li
                key={index}
                className="flex justify-between items-center border p-3 rounded-md"
              >
                <div>
                  <p className="font-semibold">{file.fileName}</p>
                  <p className="text-sm text-gray-500">
                    Uploaded on:{" "}
                    {file.createdAt?.seconds
                      ? new Date(file.createdAt.seconds * 1000).toLocaleString()
                      : "Unknown"}
                  </p>
                </div>
                <a
                  href={file.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
