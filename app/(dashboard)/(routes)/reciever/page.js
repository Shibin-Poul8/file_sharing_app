"use client";
import { useEffect, useState } from "react";
import { db, auth } from "../../../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

export default function ReceiverPage() {
  const [files, setFiles] = useState([]);
  const [fileLoading, setFileLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchFiles = async () => {
      try {
        const q = query(
          collection(db, "sharedFiles"),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);
        const fileList = snapshot.docs.map((doc) => doc.data());
        setFiles(fileList);
      } catch (err) {
        console.error("Error fetching files:", err);
      } finally {
        setFileLoading(false);
      }
    };

    fetchFiles();
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Please sign in to view files.</p>
      </div>
    );
  }

  if (fileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your files...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white rounded-xl shadow-md p-8">
        <h2 className="text-3xl font-bold text-blue-600 mb-2">📁 Your Shared Files</h2>
        <p className="text-gray-600 mb-6">Files that have been shared with you</p>

        {files.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-600 text-lg">No files shared with your account.</p>
            <p className="text-gray-500 text-sm mt-2">
              Ask others to share files with you using your email address.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {files.map((file, index) => (
              <div
                key={index}
                className="border border-gray-200 p-4 rounded-lg hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 break-all">
                      📄 {file.fileName}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Shared on:{" "}
                      {file.createdAt?.seconds
                        ? new Date(file.createdAt.seconds * 1000).toLocaleDateString()
                        : "Unknown"}
                    </p>
                  </div>
                </div>
                <a
                  href={file.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition inline-block text-center"
                >
                  ⬇️ Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}