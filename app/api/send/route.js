// app/api/send/route.js
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  try {
    const { recipient, fileUrl, fileName } = await req.json();

    const htmlContent = `
      <p>You have received a file from the Cloud File Sharing app.</p>
      <p>Download it here: <a href="${fileUrl}" target="_blank">${fileName}</a></p>
    `;

    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: recipient,
      subject: "File from Cloud File Sharing",
      html: htmlContent,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message });
  }
}
