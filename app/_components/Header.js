"use client";
import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db, storage } from "../firebase/config";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";

/* ---------------------------------------------
   Dynamic Avatar Generator (initial-based SVG)
----------------------------------------------*/
function generateAvatar(letter) {
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>
      <rect fill='%23E5E7EB' width='100%' height='100%'/>
      <text x='50%' y='50%' dominant-baseline='middle'
            text-anchor='middle' font-size='32' 
            fill='%239CA3AF' font-family='Arial, sans-serif'>
        ${letter}
      </text>
    </svg>
  `;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

export default function Header() {
  const [userData, setUserData] = useState({
    user: null,
    avatarUrl: null,
    name: null,
    email: null,
    phone: null,
    createdAt: null,
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);
  const router = useRouter();

  /* ---------------------------------------------
     Load User Data & Firestore Profile
  ----------------------------------------------*/
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUserData({
          user: null,
          avatarUrl: null,
          name: null,
          email: null,
          phone: null,
          createdAt: null,
        });
        return;
      }

      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);

        let name = u.displayName || u.email?.split("@")[0] || "User";
        let email = u.email;
        let phone = "—";
        let createdAt = null;

        if (snap.exists()) {
          const data = snap.data();
          name = data?.name || name;
          email = data?.email || email;
          phone = data?.phone || "—";
          createdAt = data?.createdAt || null;
        }

        const initial = (name?.[0] || email?.[0] || "U").toUpperCase();
        const avatar = snap.exists() && snap.data()?.avatarUrl 
          ? snap.data().avatarUrl 
          : (u.photoURL || generateAvatar(initial));

        setUserData({
          user: u,
          avatarUrl: u.photoURL || avatar,
          name,
          email,
          phone,
          createdAt,
        });
      } catch (err) {
        console.error("Failed to load user data:", err);
      }
    });

    return () => unsub();
  }, []);

  /* ---------------------------------------------
     Logout
  ----------------------------------------------*/
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/");
      setMenuOpen(false);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  /* ---------------------------------------------
     Upload Avatar Photo
  ----------------------------------------------*/
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileRef = storageRef(storage, `avatars/${user.uid}/${file.name}`);
      const uploadTask = uploadBytesResumable(fileRef, file);

      uploadTask.on(
        "state_changed",
        () => {
          // track progress if needed
        },
        (error) => {
          console.error("Avatar upload error:", error);
          alert("Photo upload failed: " + error.message);
          setUploading(false);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            // Update user profile with new avatar
            await updateDoc(doc(db, "users", user.uid), {
              avatarUrl: downloadURL,
            });
            // Update local state
            setUserData((prev) => ({
              ...prev,
              avatarUrl: downloadURL,
            }));
            alert("Profile photo updated!");
          } catch (err) {
            console.error("Failed to save avatar URL:", err);
            alert("Failed to save photo");
          } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }
        }
      );
    } catch (err) {
      console.error("Avatar upload error:", err);
      alert("Photo upload failed");
      setUploading(false);
    }
  };

  /* ---------------------------------------------
     Close Menu on Outside Click
  ----------------------------------------------*/
  useEffect(() => {
    const handleClick = (e) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpen]);

  /* ---------------------------------------------
     Format Timestamp
  ----------------------------------------------*/
  const formatTimestamp = (ts) => {
    if (!ts) return "Unknown";
    try {
      if (typeof ts.toDate === "function") return ts.toDate().toLocaleDateString();
      if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleDateString();
      return new Date(ts).toLocaleDateString();
    } catch {
      return "Unknown";
    }
  };

  const { user, avatarUrl, name, email, phone, createdAt } = userData;

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="Logo" width={36} height={40} />
          <span className="text-xl font-bold text-blue-600">CloudVault</span>
        </div>

        {/* Navigation */}
        <nav aria-label="Global" className="hidden md:block">
          <ul className="flex items-center gap-6 text-sm font-medium text-gray-700">
            <li><Link href="/" className="hover:text-blue-600">Home</Link></li>
            <li><Link href="/Upload" className="hover:text-blue-600">Upload</Link></li>
            <li><Link href="/about" className="hover:text-blue-600">About</Link></li>
            <li><Link href="/contact" className="hover:text-blue-600">Contact Us</Link></li>
          </ul>
        </nav>

        {/* Auth / Profile */}
        <div className="flex items-center gap-4">
          {!user ? (
            <>
              <Link
                href="/signin"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Login
              </Link>

              <Link
                href="/signup"
                className="rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
              >
                Sign Up
              </Link>
            </>
          ) : (
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen(!menuOpen)}>
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover border"
                />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border rounded-md shadow-lg z-40">
                  <div className="p-3 border-b">
                    <p className="text-sm font-medium text-gray-800">{name}</p>
                    <p className="text-xs text-gray-500 truncate">{email}</p>
                  </div>

                  <div className="p-3 text-sm text-gray-700 space-y-1">
                    <div>
                      <span className="text-xs text-gray-500">Phone: </span>
                      {phone}
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Joined: </span>
                      {formatTimestamp(createdAt)}
                    </div>
                  </div>

                  <div className="p-3 border-t space-y-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full px-3 py-2 text-left rounded hover:bg-blue-50 text-sm text-blue-600 border border-blue-600 transition"
                    >
                      {uploading ? "Uploading..." : "📷 Change Profile Photo"}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </div>

                  <div className="p-2 border-t">
                    <button
                      onClick={handleLogout}
                      className="w-full px-3 py-2 text-left rounded hover:bg-gray-50 text-sm text-red-600"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
