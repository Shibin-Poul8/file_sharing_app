// app/(auth)/(routes)/signin/page.js
"use client";
import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../../firebase/config";
import { useRouter, useSearchParams } from "next/navigation";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = (searchParams && searchParams.get("redirect")) || "/Upload";

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push(redirectTo);
    } catch (err) {
      console.error("SignIn error:", err);
      setError(err.message || "Sign in failed.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSignIn} className="bg-white shadow-lg rounded-2xl p-8 w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">Sign In</h2>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <input type="email" placeholder="Email" className="w-full border p-3 rounded mb-4" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" className="w-full border p-3 rounded mb-4" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Login</button>
        <p className="text-sm text-center mt-4 text-gray-600">Don’t have an account? <a href="/signup" className="text-blue-500 hover:underline">Sign up</a></p>
      </form>
    </div>
  );
}
