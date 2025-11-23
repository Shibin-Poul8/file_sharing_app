import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db, storage } from "../app/firebase/config";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><rect fill='%23E5E7EB' width='100%' height='100%'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='48' fill='%239CA3AF'>U</text></svg>";

export default function AccountPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editOrg, setEditOrg] = useState("");
  const [editAvatarFile, setEditAvatarFile] = useState(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState(null);
  const [editAvatarUrl, setEditAvatarUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    // Subscribe to auth state and automatically load profile when signed-in
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null);
        setProfile(null);
        setLoading(false);
        // Redirect to sign-in (replace so back won't return here)
        try {
          router.replace("/signin");
        } catch (e) {
          // router may not be ready in some cases; ignore
        }
        return;
      }

      setCurrentUser(user);
      setLoading(true);

      try {
        const userDocRef = doc(db, "users", user.uid);
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          setProfile(snap.data());
        } else {
          // If there's no profile doc, fall back to basic auth info
          setProfile({ name: user.displayName || "", email: user.email || "", createdAt: null });
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/");
    } catch (err) {
      console.error("Logout failed:", err);
      setError("Logout failed. Please try again.");
    }
  };

  const startEdit = () => {
    setEditName(profile?.name || currentUser.displayName || "");
    setEditPhone(profile?.phone || "");
    setEditOrg(profile?.organization || profile?.organization || "");
    setEditAvatarUrl(profile?.avatarUrl || "");
    setEditAvatarPreview(null);
    setEditAvatarFile(null);
    setEditing(true);
  };

  const saveProfile = async () => {
    if (!currentUser) return;
    setSaving(true);
    setError("");
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const updates = {
        name: editName,
        phone: editPhone,
        organization: editOrg,
      };
      if (editAvatarUrl) updates.avatarUrl = editAvatarUrl;
      await updateDoc(userRef, updates);
      // refresh profile
      const snap = await getDoc(userRef);
      setProfile(snap.exists() ? snap.data() : null);
      setEditing(false);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSelect = (file) => {
    if (!file) return;
    setEditAvatarFile(file);
    setEditAvatarPreview(URL.createObjectURL(file));
  };

  const uploadAvatar = async () => {
    if (!currentUser || !editAvatarFile) return;
    setUploadingAvatar(true);
    try {
      const path = `avatars/${currentUser.uid}/${Date.now()}_${editAvatarFile.name}`;
      const sRef = storageRef(storage, path);
      const uploadTask = uploadBytesResumable(sRef, editAvatarFile);

      await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          () => {},
          (err) => reject(err),
          () => resolve()
        );
      });

      const url = await getDownloadURL(sRef);
      setEditAvatarUrl(url);
      // cleanup preview URL
      if (editAvatarPreview) {
        URL.revokeObjectURL(editAvatarPreview);
        setEditAvatarPreview(null);
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
      setError("Avatar upload failed. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return "Unknown";
    try {
      // Firestore Timestamp object
      if (typeof ts.toDate === "function") return ts.toDate().toLocaleDateString();
      // v1 style object with seconds
      if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleDateString();
      // fallback: passable string or number
      return new Date(ts).toLocaleDateString();
    } catch (e) {
      return "Unknown";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-6">
          <p className="text-gray-700 mb-4">You are not signed in.</p>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={() => router.push("/signin")}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-4">My Profile</h1>

        {error && <p className="text-red-600 mb-3">{error}</p>}

        {!editing ? (
          <>
            <div className="flex justify-center mb-4">
              <img
                src={profile?.avatarUrl || DEFAULT_AVATAR}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border"
              />
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-500">Name</p>
              <p className="text-lg font-medium">{profile?.name || currentUser.displayName || "—"}</p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-lg font-medium">{profile?.email || currentUser.email}</p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-500">Phone</p>
              <p className="text-lg font-medium">{profile?.phone || "—"}</p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-500">Organization</p>
              <p className="text-lg font-medium">{profile?.organization || "—"}</p>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-500">Joined</p>
              <p className="text-lg font-medium">{formatTimestamp(profile?.createdAt)}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleLogout}
                className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700"
              >
                Logout
              </button>
              <button
                onClick={startEdit}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                Edit Profile
              </button>
            </div>
          </>
        ) : (
          <div>
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full overflow-hidden border bg-gray-100">
                {editAvatarPreview ? (
                  // preview
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editAvatarPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : editAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">No photo</div>
                )}
              </div>
            </div>

            <div className="mb-3">
              <label className="text-sm text-gray-500">Profile Photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleAvatarSelect(e.target.files?.[0])}
                className="w-full mt-2"
              />
              {editAvatarFile && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={uploadAvatar}
                    disabled={uploadingAvatar}
                    className="bg-blue-600 text-white px-3 py-1 rounded"
                  >
                    {uploadingAvatar ? "Uploading..." : "Upload Photo"}
                  </button>
                  <button
                    onClick={() => { setEditAvatarFile(null); setEditAvatarPreview(null); }}
                    className="bg-gray-200 px-3 py-1 rounded"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <div className="mb-3">
              <label className="text-sm text-gray-500">Full name</label>
              <input
                className="w-full border p-2 rounded mt-1"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <label className="text-sm text-gray-500">Phone</label>
              <input
                className="w-full border p-2 rounded mt-1"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <label className="text-sm text-gray-500">Organization</label>
              <input
                className="w-full border p-2 rounded mt-1"
                value={editOrg}
                onChange={(e) => setEditOrg(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 bg-gray-200 py-2 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
