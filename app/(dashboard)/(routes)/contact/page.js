"use client";
import React from "react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow">
        <h1 className="text-3xl font-bold mb-4 text-blue-600">Developers</h1>

        <p className="text-gray-700 mb-4">Contact information for the project developers. Replace placeholders with real contact details if needed.</p>

        <h2 className="text-2xl font-semibold mt-6 mb-2 text-blue-700">Team</h2>
        <ul className="list-disc list-inside text-gray-700 space-y-4">
          <li>
            <strong>K B Shibin Poul</strong>
            <div className="text-sm text-gray-700">Email: <a href="mailto:shibin.poul@example.com" className="text-blue-600 underline">shibin.poul@gmail.com</a></div>
            <div className="text-sm text-gray-700">Phone: <a href="tel:+919876543210" className="text-blue-600 underline">+91 98765 43210</a></div>
          </li>

          <li>
            <strong>Abhilash K S</strong>
            <div className="text-sm text-gray-700">Email: <a href="mailto:abhilash.ks@example.com" className="text-blue-600 underline">abhilashks0505@gmail.com</a></div>
            <div className="text-sm text-gray-700">Phone: <a href="tel:+919123456789" className="text-blue-600 underline">+91 7899490916</a></div>
          </li>

          <li>
            <strong>Harsha Patil H D</strong>
            <div className="text-sm text-gray-700">Email: <a href="mailto:harsha.patil@example.com" className="text-blue-600 underline">harshapatil@gmail.com</a></div>
            <div className="text-sm text-gray-700">Phone: <a href="tel:+919988777665" className="text-blue-600 underline">+91 99887 77665</a></div>
          </li>
        </ul>

      </div>
    </div>
  );
}
