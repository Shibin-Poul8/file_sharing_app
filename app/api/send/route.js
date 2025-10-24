// app/api/send/route.js
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  try {
    const { recipient, fileUrl, fileName } = await req.json();

    const htmlContent = `
  <div style="font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 20px;">
    <div style="
      max-width: 500px;
      margin: auto;
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      padding: 30px;
      text-align: center;
    ">
      <h2 style="font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 16px;">
        📁 You’ve received a file!
      </h2>
      <p style="color: #6b7280; font-size: 16px; margin-bottom: 24px;">
        Someone shared a file with you via the CloudVault.
      </p>
      <a href="${fileUrl}" target="_blank" style="
        display: inline-block;
        padding: 12px 24px;
        background-color: #3b82f6;
        color: white;
        font-weight: 600;
        border-radius: 8px;
        text-decoration: none;
      ">
        Access ${fileName}
      </a>
      <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
        If you didn’t expect this email, you can safely ignore it.
      </p>
    </div>
  </div>
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
