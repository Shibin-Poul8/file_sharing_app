"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";

export default function Header() {
  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="Logo" width={36} height={40} />
          <span className="text-xl font-bold text-blue-600">FileShare</span>
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

        {/* Auth Buttons */}
        <div className="flex items-center gap-4">
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
        </div>
      </div>
    </header>
  );
}
