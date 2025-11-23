"use client";
import React from "react";
import Link from "next/link";

export default function Hero() {
  return (
    <>
      <header className="fixed top-0 left-0 right-0 bg-white shadow-md z-20">
        <nav className="mx-auto max-w-screen-xl px-4 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-blue-600">FileShare</div>
          <div className="flex gap-4">
            <Link href="/login" className="text-gray-600 hover:text-blue-600">
              Login
            </Link>
            <Link href="/signup" className="text-blue-600 hover:text-blue-700">
              Sign Up
            </Link>
          </div>
        </nav>
      </header>
      
      <section className="fixed inset-0 bg-gray-50 flex items-center z-10 pt-20">
        <div className="mx-auto max-w-screen-xl px-4 text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl lg:text-6xl">
            <span className="text-blue-600">Upload</span>, Save, and{" "}
            <span className="text-blue-600">Share</span> Files Effortlessly
          </h1>

          <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
            Securely upload, manage, and share your files from anywhere using our
            cloud-powered file-sharing platform.
          </p>

          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/signup"
              className="inline-block rounded-md bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
