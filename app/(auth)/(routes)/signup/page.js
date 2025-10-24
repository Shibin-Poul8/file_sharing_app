"use client";
import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../../firebase/config";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSignIn, setShowSignIn] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    // basic client-side validation
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Optionally inspect userCredential.user
      router.push("/signin");
    } catch (err) {
      // Log full error for debugging
      // eslint-disable-next-line no-console
      console.error('Firebase signUp error', err);
      // Handle common Firebase error codes with clear guidance
      if (err && err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. If this is your account, please sign in.');
        setShowSignIn(true);
      } else if (err && err.code === 'auth/weak-password') {
        setError('Weak password: please use at least 6 characters.');
        setShowSignIn(false);
      } else {
        setError(err.code ? `${err.code}: ${err.message}` : err.message || 'Sign up failed');
        setShowSignIn(false);
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

        {error && (
          <div className="mb-4">
            <p className="text-red-500 text-sm">{error}</p>
            {showSignIn && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => router.push('/signin')}
                  className="text-sm text-blue-600 underline"
                >
                  Sign in
                </button>
              </div>
            )}
          </div>
        )}

        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          className="w-full border p-3 rounded mb-4 placeholder -[#1f2937] text-gray-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          suppressHydrationWarning
        />

        <input
          type="password"
          placeholder="Password"
          autoComplete="new-password"
          className="w-full border p-3 rounded mb-4 placeholder -[#1f2937] text-gray-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          suppressHydrationWarning
        />

        <button
          type="submit"
          disabled={loading}
          className={`w-full ${loading ? 'bg-blue-400' : 'bg-blue-600'} text-white py-2 rounded hover:bg-blue-700`}
          suppressHydrationWarning
        >
          {loading ? 'Creating...' : 'Create Account'}
        </button>

        <p className="text-sm text-center mt-4">
          Already have an account?{" "}
          <a href="/signin" className="text-blue-500 hover:underline">
            Login
          </a>
        </p>
      </form>
    </div>
  );
}
