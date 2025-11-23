# VirusTotal API Integration Guide

## Overview
Your file-sharing app now includes **VirusTotal API integration** to scan uploaded files for malware and viruses before they are shared.

## Features
✅ Scans files using VirusTotal's comprehensive antivirus engine  
✅ Displays detection results (safe/malware/suspicious)  
✅ Prevents uploading of malicious files  
✅ Shows vendor detection count and details  

## Setup Instructions

### 1. Get VirusTotal API Key
1. Go to [VirusTotal](https://www.virustotal.com)
2. Sign up for a free account (or log in if you have one)
3. Navigate to **Settings → API Key**
4. Copy your API key

### 2. Add Environment Variable
Add the API key to your `.env.local` file:
```
VIRUSTOTAL_API_KEY=your_api_key_here
```

If you don't have a `.env.local` file yet, create one in the project root and add the key above.

### 3. Restart Development Server
```bash
npm run dev
```

## How It Works

### Frontend Flow (`app/(dashboard)/(routes)/Upload/page.js`)
1. User selects or drags a file
2. User clicks **🔍 Scan for Viruses** button
3. File is sent to the backend scan endpoint
4. Results are displayed:
   - ✅ **Green**: File is safe - can proceed with upload
   - ⚠️ **Red**: Malware detected - upload is blocked
5. Only safe files can be uploaded to Firebase

### Backend Flow (`app/api/scan-virus/route.js`)
1. Receives file from frontend
2. Uploads file to VirusTotal API
3. Polls the analysis endpoint until complete
4. Returns detection results:
   - `safe`: Boolean indicating if file is safe
   - `malicious`: Number of vendors detecting malware
   - `suspicious`: Number of vendors detecting suspicious behavior
   - `undetected`: Number of vendors with no detections
   - `total`: Total vendors that analyzed the file

## API Response Example
```json
{
  "success": true,
  "data": {
    "safe": true,
    "malicious": 0,
    "suspicious": 0,
    "undetected": 75,
    "total": 75,
    "analysisId": "xxx-xxx-xxx"
  }
}
```

## Scanning Results Interpretation
- **Safe File**: `malicious === 0` ✅
- **Infected File**: `malicious > 0` ⚠️
- **Suspicious File**: `suspicious > 0` and `malicious === 0` ⚠️

## File Size Limits
- VirusTotal Free API: Up to 550 MB
- VirusTotal Premium: Up to 5 GB

## Scanning Speed
- Typical scan: 5-30 seconds
- Timeout: 30 seconds (if file takes longer, an error is shown)

## Cost
- **Free Plan**: 4 requests per minute, 500k per month
- **Premium Plans**: Higher limits available

## Troubleshooting

### "VIRUSTOTAL_API_KEY is not configured"
- Ensure `VIRUSTOTAL_API_KEY` is in `.env.local`
- Restart your dev server after adding the key
- Verify the key is correct on VirusTotal website

### Scan times out
- File might be too large or VirusTotal is busy
- Try scanning again
- For large files (>100MB), consider increasing timeout in `app/api/scan-virus/route.js` (currently 30 seconds)

### "Scan failed" error
- Check your internet connection
- Verify VirusTotal API key is valid
- Check browser console for detailed error message
- Ensure you haven't exceeded API rate limits

## Customization

### Change Scan Timeout
Edit `app/api/scan-virus/route.js`, line with `maxAttempts = 30`:
```javascript
const maxAttempts = 60; // 60 seconds instead of 30
```

### Auto-scan on File Selection
Currently, scanning is manual. To auto-scan, modify `Upload/page.js`:
```javascript
const handleFileChange = (file) => {
  setFile(file);
  handleScanVirus(); // Auto-scan
};
```

### Add Email Notification of Scan Results
Modify `api/send/route.js` to include scan info in the email sent to recipients.

## Security Notes
- API key is only used server-side (hidden from client)
- Files are only temporarily uploaded to VirusTotal for analysis
- No file data is stored permanently
- VirusTotal has strict privacy policies

## Additional Resources
- [VirusTotal API Documentation](https://developers.virustotal.com/reference)
- [VirusTotal Privacy Policy](https://www.virustotal.com/gui/privacy)
- [VirusTotal Terms of Service](https://www.virustotal.com/gui/terms)
