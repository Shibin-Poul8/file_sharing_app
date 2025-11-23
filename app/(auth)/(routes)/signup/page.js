"use client";
import React, { useState } from "react";
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, GithubAuthProvider, FacebookAuthProvider } from "firebase/auth";
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
  const [socialLoading, setSocialLoading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    setShowSignIn(false);
    if (!name) {
      setError("Please enter your full name.");
      return;
    }
    if (!phone) {
      setError("Please enter your phone number.");
      return;
    }
    if (!email) {
      setError("Please enter your email.");
      return;
    }
    if (!password || !confirmPassword) {
      setError("Please enter and confirm your password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Generate ECDH key pair for user and persist public key in Firestore.
      // Private JWK is stored locally in browser (localStorage). This is a lightweight approach — for production consider better key backup.
      try {
        const { publicKey, privateJwk } = await generateECDHKeyPair();
        // save private locally
        try {
          localStorage.setItem(`ecdh_private_${user.uid}`, JSON.stringify(privateJwk));
        } catch (e) {
          console.warn('Could not save private key to localStorage', e);
        }
        // include publicKey in profile
        await setDoc(userRef, {
          name: name || "",
          email: user.email || email,
          phone: phone || "",
          organization: organization || "",
          publicKey: publicKey,
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        console.error('Failed to generate/store ECDH keypair', e);
        // fallback to creating profile without publicKey
        await setDoc(userRef, {
          name: name || "",
          email: user.email || email,
          phone: phone || "",
          organization: organization || "",
          createdAt: serverTimestamp(),
        });
      }

      // Create a simple profile document in Firestore at users/{uid}
      // After creating profile, navigate to sign-in (or dashboard if you prefer)
      router.push("/signin");
    } catch (err) {
      console.error('Firebase signUp error', err);
      if (err && err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. If this is your account, please sign in.');
        setShowSignIn(true);
      } else if (err && err.code === 'auth/weak-password') {
        setError('Weak password: please use at least 6 characters.');
      } else {
        setError(err.message || 'Sign up failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const ensureUserProfile = async (user) => {
    try {
      const userRef = doc(db, "users", user.uid);
      // If user already has a publicKey in their profile, keep it. Otherwise generate and persist.
      const publicKeyData = { publicKey: null };
      try {
        const { publicKey, privateJwk } = await generateECDHKeyPair();
        publicKeyData.publicKey = publicKey;
        try { localStorage.setItem(`ecdh_private_${user.uid}`, JSON.stringify(privateJwk)); } catch (e) { console.warn('Could not store private key locally', e); }
      } catch (e) {
        console.warn('Could not generate ECDH keypair for social sign-in', e);
      }

      await setDoc(userRef, {
        name: user.displayName || name || "",
        email: user.email || email || "",
        phone: phone || "",
        organization: organization || "",
        avatarUrl: user.photoURL || null,
        ...publicKeyData,
        createdAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('Failed to write profile', e);
    }
  };

  const handleSocialSignIn = async (providerName) => {
    setError("");
    setSocialLoading(true);
    let provider;
    try {
      if (providerName === 'google') provider = new GoogleAuthProvider();
      else if (providerName === 'github') provider = new GithubAuthProvider();
      else if (providerName === 'facebook') provider = new FacebookAuthProvider();
      else throw new Error('Unsupported provider');

      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      // Ensure a minimal profile exists in Firestore (do not store password)
      await ensureUserProfile(user);
      router.push('/Upload');
    } catch (err) {
      console.error('Social sign-in error', err);
      setError(err.message || 'Social sign-in failed');
    } finally {
      setSocialLoading(false);
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
          type="text"
          placeholder="Full name"
          autoComplete="name"
          className="w-full border p-3 rounded mb-4 placeholder -[#1f2937] text-gray-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <input
          type="tel"
          placeholder="Phone number"
          autoComplete="tel"
          className="w-full border p-3 rounded mb-4 placeholder -[#1f2937] text-gray-500"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />

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

        <input
          type="password"
          placeholder="Confirm Password"
          autoComplete="new-password"
          className="w-full border p-3 rounded mb-4 placeholder -[#1f2937] text-gray-500"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Organization (optional)"
          className="w-full border p-3 rounded mb-4 placeholder -[#1f2937] text-gray-500"
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
        />

        <div className="my-3">
          <p className="text-sm text-gray-500 mb-2">Or sign up with</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleSocialSignIn('google')}
              disabled={socialLoading}
              className="flex-1 bg-red-500 text-white py-2 rounded hover:opacity-90"
            >
              {socialLoading ? 'Please wait...' : 'Google'}
            </button>
            <button
              type="button"
              onClick={() => handleSocialSignIn('github')}
              disabled={socialLoading}
              className="flex-1 bg-gray-800 text-white py-2 rounded hover:opacity-90"
            >
              GitHub
            </button>
            <button
              type="button"
              onClick={() => handleSocialSignIn('facebook')}
              disabled={socialLoading}
              className="flex-1 bg-blue-700 text-white py-2 rounded hover:opacity-90"
            >
              Facebook
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full ${loading ? 'bg-blue-400' : 'bg-blue-600'} text-white py-2 rounded hover:bg-blue-700`}
          suppressHydrationWarning
        >
          {loading ? 'Creating...' : 'Create Account'}
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
