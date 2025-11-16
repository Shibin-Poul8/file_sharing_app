"use client";
import { useEffect, useState } from "react";
import { db, auth } from "../../../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function ReceiverPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      // User NOT logged in → redirect to login
      if (!user) {
        router.push("/signin?redirect=/receiver");
        return;
      }

      // User logged in → use their email
      const email = user.email;

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
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-12">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-md p-8">
        <h2 className="text-2xl font-bold text-blue-600 mb-6">📁 Your Shared Files</h2>

        {loading ? (
          <p>Loading files...</p>
        ) : files.length === 0 ? (
          <p>No files shared with your account.</p>
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