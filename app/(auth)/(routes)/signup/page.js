"use client";
import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../../firebase/config";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { generateECDHKeyPair } from "../../../_utils/cryptoClient";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");

    if (!name || !phone || !email || !password || !confirmPassword) {
      setError("Please fill all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;
      const userRef = doc(db, "users", user.uid);

      // Generate ECDH keys and store public one
      try {
        const { publicKey, privateJwk } = await generateECDHKeyPair();

        // Store private key only on user's browser
        localStorage.setItem(
          `ecdh_private_${user.uid}`,
          JSON.stringify(privateJwk)
        );

        // Save user profile
        await setDoc(userRef, {
          name,
          email: user.email,
          phone,
          organization,
          publicKey,
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn("ECDH key generation failed", e);

        await setDoc(userRef, {
          name,
          email: user.email,
          phone,
          organization,
          createdAt: serverTimestamp(),
        });
      }

      // 🌟 FIX: redirect directly to Upload page after signup
      router.push("/Upload");

    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered.");
      } else if (err.code === "auth/weak-password") {
        setError("Weak password: minimum 6 characters.");
      } else {
        setError(err.message || "Sign up failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSignUp}
        className="bg-white shadow-lg rounded-2xl p-8 w-96"
      >
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">
          Sign Up
        </h2>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <input
          type="text"
          placeholder="Full name"
          className="w-full border p-3 rounded mb-4 text-gray-800"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          type="tel"
          placeholder="Phone number"
          className="w-full border p-3 rounded mb-4 text-gray-800"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <input
          type="email"
          placeholder="Email"
          className="w-full border p-3 rounded mb-4 text-gray-800"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full border p-3 rounded mb-4 text-gray-800"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          placeholder="Confirm Password"
          className="w-full border p-3 rounded mb-4 text-gray-800"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className={`w-full ${
            loading ? "bg-blue-400" : "bg-blue-600"
          } text-white py-2 rounded hover:bg-blue-700`}
        >
          {loading ? "Creating..." : "Create Account"}
        </button>

        <p className="text-sm text-center mt-4 text-gray-400">
          Already have an account?{" "}
          <a href="/signin" className="text-blue-500 hover:underline">
            Login
          </a>
        </p>
      </form>
    </div>
  );
}
