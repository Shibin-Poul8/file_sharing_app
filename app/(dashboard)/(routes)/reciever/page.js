"use client";
import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";

export default function ReceiverPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");

  // URL params: ?email=recipient@example.com or ?file=<fileIdOrUrl>
  const emailParam = searchParams?.get("email");
  const fileParam = searchParams?.get("file");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) {
        // Not signed in: redirect to sign-in with next param so they return here
        const current = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/(dashboard)/(routes)/reciever";
        router.push(`/signin?next=${encodeURIComponent(current)}`);
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (loading) return;
    if (!user) return; // onAuthStateChanged will redirect

    const loadFiles = async () => {
      try {
        // Assume there's a collection 'sharedFiles' with field 'recipientEmail' and optionally 'fileId' or 'fileUrl'
        const filesCol = collection(db, "sharedFiles");
        let q;

        if (fileParam) {
          q = query(filesCol, where("fileId", "==", fileParam));
        } else if (emailParam) {
          q = query(filesCol, where("recipientEmail", "==", emailParam), orderBy("createdAt", "desc"), limit(50));
        } else {
          // If no params provided, fall back to files shared to the signed-in user's email
          const userEmail = user.email;
          q = query(filesCol, where("recipientEmail", "==", userEmail), orderBy("createdAt", "desc"), limit(50));
        }

        const snapshot = await getDocs(q);
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFiles(items);
      } catch (err) {
        console.error(err);
        setError("Failed to load files.");
      }
    };

    loadFiles();
  }, [loading, user, emailParam, fileParam]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return null; // redirect in progress
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-3xl mx-auto bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-4">Files shared with you</h1>
        {emailParam && (
          <p className="text-sm text-gray-600 mb-4">Viewing files for: {emailParam}</p>
        )}
        {error && <p className="text-red-500 mb-4">{error}</p>}

        {files.length === 0 ? (
          <p className="text-gray-700">No files found.</p>
        ) : (
          <ul className="space-y-3">
            {files.map((f) => (
              <li key={f.id} className="p-3 border rounded flex justify-between items-center">
                <div>
                  <div className="font-medium">{f.name || f.fileName || "Untitled"}</div>
                  <div className="text-sm text-gray-500">{f.size ? `${Math.round(f.size/1024)} KB` : f.fileType || ""}</div>
                </div>
                <div>
                  {f.fileUrl ? (
                    <a href={f.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                      Download
                    </a>
                  ) : (
                    <span className="text-sm text-gray-500">No link</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
