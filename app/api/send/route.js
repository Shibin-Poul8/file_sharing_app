import { Resend } from "resend";
import { NextResponse } from "next/server";
import { db } from "../../../firebase/config";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  try {
    const { recipient, fileUrl, fileName } = await req.json();

    // Save file metadata in Firestore
    const docRef = await addDoc(collection(db, "sharedFiles"), {
      recipientEmail: recipient,
      fileUrl,
      fileName,
      createdAt: serverTimestamp(),
    });

    // Secure download link
    const secureLink = `https://localhost:3000/download?file=${docRef.id}`;

    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: recipient,
      subject: "You've received a file",
      html: `
        <p>Hey,</p>
        <p>You’ve received a file: <strong>${fileName}</strong></p>
        <p>Download it securely here (login required):</p>
        <a href="${secureLink}" target="_blank">${secureLink}</a>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ success: false, error: error.message });
  }
}
