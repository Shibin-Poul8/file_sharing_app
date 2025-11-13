import { Resend } from "resend";
import { NextResponse } from "next/server";
import { db } from "../../firebase/config";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const resend = new Resend(process.env.RESEND_API_KEY);

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

    // Build download page link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const link = `${baseUrl}/download?email=${encodeURIComponent(recipient)}`;

    // Send email with download page link
    await resend.emails.send({
      from: "noreply@resend.dev",
      to: recipient,
      subject: `You have received a file: ${fileName}`,
      html: `
        <div style="font-family:sans-serif;padding:20px;">
          <h2 style="color:#2563eb;">📁 File Sharing App</h2>
          <p>Hello,</p>
          <p>Someone shared <strong>${fileName}</strong> with you.</p>
          <a href="${link}" style="
            background:#2563eb;
            color:white;
            padding:10px 16px;
            border-radius:6px;
            text-decoration:none;
            display:inline-block;
            margin-top:10px;">
            View Files
          </a>
          <p style="margin-top:20px;font-size:12px;color:#666;">
            This link opens your secure download page.
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
