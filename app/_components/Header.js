"use client";
import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect fill='%23E5E7EB' width='100%' height='100%'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='28' fill='%239CA3AF'>U</text></svg>";

export default function Header() {
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [profileName, setProfileName] = useState(null);
  const [profileEmail, setProfileEmail] = useState(null);
  const [profilePhone, setProfilePhone] = useState(null);
  const [profileOrg, setProfileOrg] = useState(null);
  const [profileCreatedAt, setProfileCreatedAt] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const router = useRouter();
  

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const ref = doc(db, "users", u.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data();
            setAvatarUrl(data?.avatarUrl || u.photoURL || null);
            setProfileName(data?.name || u.displayName || null);
            setProfileEmail(data?.email || u.email || null);
            setProfilePhone(data?.phone || null);
            setProfileOrg(data?.organization || null);
            setProfileCreatedAt(data?.createdAt || null);
          } else {
            setAvatarUrl(u.photoURL || null);
            setProfileName(u.displayName || null);
            setProfileEmail(u.email || null);
            setProfilePhone(null);
            setProfileOrg(null);
            setProfileCreatedAt(null);
          }
        } catch (err) {
          console.error("Failed to load avatar:", err);
          setAvatarUrl(u.photoURL || null);
          setProfileName(u.displayName || null);
          setProfileEmail(u.email || null);
        }
      } else {
        setAvatarUrl(null);
        setProfileName(null);
        setProfileEmail(null);
        setProfilePhone(null);
        setProfileOrg(null);
        setProfileCreatedAt(null);
      }
    });

    return () => unsub();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      router.replace("/");
      setMenuOpen(false);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  useEffect(() => {
    function onDocClick(e) {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [menuOpen]);

  const formatTimestamp = (ts) => {
    if (!ts) return "Unknown";
    try {
      if (typeof ts.toDate === "function") return ts.toDate().toLocaleDateString();
      if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleDateString();
      return new Date(ts).toLocaleDateString();
    } catch (e) {
      return "Unknown";
    }
  };

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="Logo" width={36} height={40} />
          <span className="text-x1 font-bold text-blue-600">CloudVault</span>
        </div>

        {/* Navigation */}
        <nav aria-label="Global" className="hidden md:block">
          <ul className="flex items-center gap-6 text-sm font-medium text-gray-700">
            <li>
              <Link href="/" className="hover:text-blue-600 transition">
                Home
              </Link>
            </li>
            <li>
              <Link href="/Upload" className="hover:text-blue-600 transition">
                Upload
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-blue-600 transition">
                About
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-blue-600 transition">
                Contact Us
              </Link>
            </li>
          </ul>
        </nav>

        {/* Auth Buttons / Profile */}
        <div className="flex items-center gap-4">
          {!user ? (
            <>
              <Link
                href="/signin"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
              >
                Login
              </Link>

              <Link
                href="/signup"
                className="hidden sm:block rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 transition"
              >
                Sign Up
              </Link>
            </>
          ) : (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((s) => !s)}
                aria-haspopup="true"
                aria-expanded={menuOpen}
                className="p-0"
              >
                <img
                  src={avatarUrl || DEFAULT_AVATAR}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover border"
                />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border rounded-md shadow-lg z-40">
                  <div className="p-3 border-b">
                    <p className="text-sm font-medium text-gray-800">{profileName || "User"}</p>
                    <p className="text-xs text-gray-500 truncate">{profileEmail || ""}</p>
                  </div>
                  <div className="p-3 text-sm text-gray-700 space-y-1">
                    <div>
                      <span className="text-xs text-gray-500">Phone: </span>
                      <span>{profilePhone || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Organization: </span>
                      <span>{profileOrg || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Joined: </span>
                      <span>{formatTimestamp(profileCreatedAt)}</span>
                    </div>
                  </div>
                  <div className="p-2 border-t">
                    <button onClick={handleLogout} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 text-sm text-red-600">Logout</button>
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
