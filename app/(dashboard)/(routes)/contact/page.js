"use client";
import React from "react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow">
        <h1 className="text-3xl font-bold mb-4 text-blue-600">Team</h1>

        <ul className="space-y-4">
          <li className="flex items-start gap-4">
            <img
              src="/Shibin.jpg"
              alt="K B Shibin Poul"
              className="w-16 h-16 rounded-full object-cover"
            />
            <div>
              <div className="font-semibold text-gray-500">K B Shibin Poul</div>
              <div className="text-sm text-gray-700">Email: <a href="mailto:shibinpaulkaggodlu@gmail.com" className="text-blue-600 underline">shibinpaulkaggodlu@gmail.com</a></div>
              <div className="text-sm text-gray-700">Phone: <a href="tel:9483929423" className="text-blue-600 underline">+91 9483929423</a></div>
            </div>
          </li>

          <li className="flex items-start gap-4">
            <img
              src="/Abhi.jpg"
              alt="Abhilash K S"
              className="w-16 h-16 rounded-full object-cover"
            />
            <div>
              <div className="font-semibold text-gray-500">Abhilash K S</div>
              <div className="text-sm text-gray-700">Email: <a href="mailto:abhilashks0505@gmail.com" className="text-blue-600 underline">abhilashks0505@gmail.com</a></div>
              <div className="text-sm text-gray-700">Phone: <a href="tel:7899490916" className="text-blue-600 underline">+91 7899490916</a></div>
            </div>
          </li>

          <li className="flex items-start gap-4">
            <img
              src="/Harsha.jpg"
              alt="Harsha Patil H D"
              className="w-16 h-16 rounded-full object-cover"
            />
            <div>
              <div className="font-semibold text-gray-500">Harsha Patil H D</div>
              <div className="text-sm text-gray-700">Email: <a href="mailto:harshapatilhd474@gmail.com" className="text-blue-600 underline">harshapatilhd474@gmail.com</a></div>
              <div className="text-sm text-gray-700">Phone: <a href="tel:7019598474" className="text-blue-600 underline">+91 70195 98474</a></div>
            </div>
          </li>
        </ul>

      </div>
    </div>
  );
}