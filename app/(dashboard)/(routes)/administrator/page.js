"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// 🔹 Correct import path (your folder structure)
import { db, auth, ADMIN_UID } from "../../../firebase/config";

import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
} from "firebase/firestore";

export default function AdministratorPage() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const router = useRouter();

  // 🔹 Check authentication & admin access
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/signin?redirect=/administrater");
        return;
      }

      setUser(currentUser);

      // 🔥 Only one admin allowed (UID check)
      if (currentUser.uid !== ADMIN_UID) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      try {
        // Load pending signup requests
        const pendingQuery = query(
          collection(db, "signupRequests"),
          where("status", "==", "pending"),
          orderBy("createdAt", "desc")
        );
        const pendingSnap = await getDocs(pendingQuery);
        setRequests(pendingSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // Load users list
        const usersSnap = await getDocs(collection(db, "users"));
        setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Admin load error:", err);
        setError("Failed to load admin data");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // 🔹 Approve request
  const handleApprove = async (requestId) => {
    setActionLoading(requestId);

    try {
      await updateDoc(doc(db, "signupRequests", requestId), {
        status: "approved",
        approvedAt: new Date(),
      });

      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      setError("Failed to approve request");
    }

    setActionLoading(null);
  };

  // 🔹 Reject request
  const handleReject = async (requestId) => {
    setActionLoading(requestId);

    try {
      await deleteDoc(doc(db, "signupRequests", requestId));
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      setError("Failed to reject request");
    }

    setActionLoading(null);
  };

  // 🔹 Loading screen
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading admin dashboard…</p>
      </div>
    );
  }

  // 🔒 If not admin
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You are not authorized to access the admin panel.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition"
          >
            Back Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-blue-600 mb-6">
        Administrator Dashboard
      </h1>

      {error && (
        <div className="p-3 bg-red-100 text-red-600 rounded mb-4">{error}</div>
      )}

      {/* Pending Signup Requests */}
      <h2 className="text-2xl font-semibold mt-6 mb-3">Pending Requests</h2>

      {requests.length === 0 ? (
        <p className="text-gray-500">No pending requests.</p>
      ) : (
        requests.map((req) => (
          <div
            key={req.id}
            className="p-4 border rounded mb-3 bg-white shadow-sm"
          >
            <p><b>Name:</b> {req.name}</p>
            <p><b>Email:</b> {req.email}</p>

            <div className="mt-3 space-x-2">
              <button
                onClick={() => handleApprove(req.id)}
                className="px-4 py-2 bg-green-600 text-white rounded"
                disabled={actionLoading === req.id}
              >
                Approve
              </button>

              <button
                onClick={() => handleReject(req.id)}
                className="px-4 py-2 bg-red-600 text-white rounded"
                disabled={actionLoading === req.id}
              >
                Reject
              </button>
            </div>
          </div>
        ))
      )}

      {/* Users List */}
      <h2 className="text-2xl font-semibold mt-10 mb-3">All Users</h2>

      {users.map((u) => (
        <div key={u.id} className="p-4 border rounded mb-2 bg-white shadow">
          <p><b>{u.name}</b> — {u.email}</p>
        </div>
      ))}

      <div className="mt-10">
        <Link href="/" className="text-blue-600 underline">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
