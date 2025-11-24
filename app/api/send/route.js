import { NextResponse } from "next/server";
import { db } from "../../firebase/config.js";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// Prefer RESEND API if configured (simpler and reliable). Fall back to Nodemailer/Gmail.
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

    const html = `
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
        <p style="margin-top:20px;font-size:12px;color:#666;">CloudVault — Secure File Sharing Service</p>
      </div>
    `;

    // If RESEND_API_KEY present, use Resend API (no SMTP setup required)
    if (process.env.RESEND_API_KEY) {
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "CloudVault <no-reply@resend.example>",
            to: [recipient],
            subject: `CloudVault: You received a file - ${fileName}`,
            html,
          }),
        });

        if (!resp.ok) {
          const body = await resp.text();
          console.error("Resend send failed:", resp.status, body);
          return NextResponse.json({ success: false, error: `Resend error: ${resp.status}` });
        }

        return NextResponse.json({ success: true });
      } catch (resendErr) {
        console.error("Resend API error:", resendErr);
        // fall through to nodemailer fallback below
      }
    }

    // Nodemailer/Gmail fallback
    const nodemailer = await import("nodemailer");
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    try {
      await transporter.verify();
    } catch (verifyErr) {
      console.error("SMTP verify failed:", verifyErr);
      return NextResponse.json({ success: false, error: 'SMTP verify failed: ' + (verifyErr.message || verifyErr.toString()) });
    }

    await transporter.sendMail({
      from: `"CloudVault" <${process.env.GMAIL_USER}>`,
      to: recipient,
      subject: `CloudVault: You received a file - ${fileName}`,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error sending email:", err);
    return NextResponse.json({ success: false, error: err.message });
  }
}
