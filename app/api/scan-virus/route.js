import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY;
const VIRUSTOTAL_API_URL = "https://www.virustotal.com/api/v3";

/**
 * Scans a file using VirusTotal API
 * @param {File} file - The file to scan
 * @returns {Object} Scan results with malicious count and vendor details
 */
async function scanFileWithVirusTotal(fileBuffer, fileName) {
  if (!VIRUSTOTAL_API_KEY) {
    throw new Error("VIRUSTOTAL_API_KEY is not configured");
  }

  try {
    // Create FormData for file upload
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: "application/octet-stream" });
    formData.append("file", blob, fileName);

    // Upload file to VirusTotal
    const uploadResponse = await fetch(
      `${VIRUSTOTAL_API_URL}/files`,
      {
        method: "POST",
        headers: {
          "x-apikey": VIRUSTOTAL_API_KEY,
        },
        body: formData,
      }
    );

    // Attempt to parse response body even on non-OK to handle cases like "Conflict"
    let uploadData = null;
    try {
      uploadData = await uploadResponse.json();
    } catch (e) {
      // ignore JSON parse errors
      uploadData = null;
    }

    if (!uploadResponse.ok) {
      // Some VirusTotal responses (e.g. Conflict / duplicate file) may include an existing analysis id in the body.
      const possibleId = uploadData && uploadData.data && uploadData.data.id;
      if (possibleId) {
        // proceed using the provided id
        console.warn(`VirusTotal upload returned ${uploadResponse.status} ${uploadResponse.statusText} but provided an analysis id. Proceeding to poll.`);
        var analysisId = possibleId;
      } else {
        // try to include helpful message from VT response body
        const errMsg = (uploadData && (uploadData.error?.message || uploadData.error?.details || JSON.stringify(uploadData))) || uploadResponse.statusText;
        throw new Error(`VirusTotal upload failed: ${uploadResponse.status} ${errMsg}`);
      }
    } else {
      const possibleId = uploadData && uploadData.data && uploadData.data.id;
      if (!possibleId) {
        throw new Error('VirusTotal upload did not return an analysis id');
      }
      var analysisId = possibleId;
    }

    // Poll for analysis results (with timeout)
    let analysisResult = null;
    let attempts = 0;
    const maxAttempts = 180; // 2 minutes max wait

    while (attempts < maxAttempts) {
      const analysisResponse = await fetch(
        `${VIRUSTOTAL_API_URL}/analyses/${analysisId}`,
        {
          method: "GET",
          headers: {
            "x-apikey": VIRUSTOTAL_API_KEY,
          },
        }
      );

      if (!analysisResponse.ok) {
        throw new Error(
          `Failed to get analysis: ${analysisResponse.statusText}`
        );
      }

      const analysisData = await analysisResponse.json();
      const status = analysisData.data.attributes.status;

      if (status === "completed") {
        analysisResult = analysisData.data.attributes.stats;
        break;
      }

      // Wait 1 second before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    if (!analysisResult) {
      throw new Error("Analysis timeout - file scan took too long");
    }

    return {
      safe: analysisResult.malicious === 0,
      malicious: analysisResult.malicious || 0,
      suspicious: analysisResult.suspicious || 0,
      undetected: analysisResult.undetected || 0,
      total: analysisResult.undetected +
        analysisResult.malicious +
        (analysisResult.suspicious || 0),
      analysisId,
    };
  } catch (error) {
    console.error("VirusTotal scan error:", error);
    throw error;
  }
}

export async function POST(req) {
  try {
    // Get file data from request
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file provided" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;

    // Scan with VirusTotal
    const scanResult = await scanFileWithVirusTotal(buffer, fileName);

    return NextResponse.json({
      success: true,
      data: scanResult,
    });
  } catch (error) {
    console.error("Virus scan API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Scan failed",
      },
      { status: 500 }
    );
  }
}
