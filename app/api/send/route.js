import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { db } from "../../firebase/config.js";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function POST(req) {
  try {
    const { recipient, fileUrl, fileName } = await req.json();

    if (!recipient || !fileUrl) {
      return NextResponse.json({ success: false, message: "Missing fields" });
    }

    // Save file info to Firestore
    await addDoc(collection(db, "sharedFiles"), {
      recipientEmail: recipient,
      fileUrl,
      fileName,
      createdAt: serverTimestamp(),
    });

    // Build receiver page link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const link = `${baseUrl}/reciever`;

    // Setup Gmail SMTP Transport
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,            // your Gmail
        pass: process.env.GMAIL_APP_PASSWORD,    // Google App Password
      },
    });

    // Send email
    await transporter.sendMail({
      from: `"CloudVault" <${process.env.GMAIL_USER}>`,  // Display name spoofing
      to: recipient,
      subject: `CloudVault: You received a file - ${fileName}`,
      html: `
        <div style="font-family:sans-serif;padding:20px;">
          <h2 style="color:#2563eb;">📁 CloudVault File Delivery</h2>
          <p>Hello,</p>

          <p>You have received <strong>${fileName}</strong> securely via <strong>CloudVault</strong>.</p>

          <a href="${link}" style="
            background:#2563eb;
            color:white;
            padding:10px 16px;
            border-radius:6px;
            text-decoration:none;
            display:inline-block;
            margin-top:10px;">
            View Your Files
          </a>

          <p style="margin-top:20px;font-size:12px;color:#666;">
            CloudVault — Secure File Sharing Service
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error sending email:", err);
    return NextResponse.json({ success: false, error: err.message });
  }
}
