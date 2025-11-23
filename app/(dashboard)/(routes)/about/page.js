export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow">

        <h1 className="text-3xl font-bold mb-4 text-blue-600">About CloudVault</h1>

        <p className="text-gray-700 mb-4">
          CloudVault is a small file-sharing tool built as part of a student project. 
          The goal was to create something simple and private,<br/> Upload a file, choose 
          who it’s for, and only that user can access it after signing in.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2 text-blue-600">How it works</h2>

        <ol className="list-decimal list-inside text-gray-600 space-y-2">
          <li>You upload a file, and it’s stored in Firebase Storage.</li>
          <li>The app saves a metadata entry in Firestore with the recipient’s email.</li>
          <li>The recipient gets an email containing a CloudVault link.</li>
          <li>After signing in, they can view and download the files shared with them.</li>
        </ol>

        <h2 className="text-2xl font-semibold mt-6 mb-2 text-blue-600">Tech Stack</h2>

        <ul className="list-disc list-inside text-gray-700 space-y-2">
          <li><strong>Next.js</strong> for UI and API routes.</li>
          <li><strong>Firebase Auth</strong> for login and user management.</li>
          <li><strong>Firestore</strong> for storing file metadata.</li>
          <li><strong>Firebase Storage</strong> for file uploads.</li>
          <li><strong>SMTP</strong> for sending recipient notifications.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-2 text-blue-600">Project Team</h2>

        <p className="text-gray-700 white-space-pre-line">
          Developed by a small student team <br/>
		  K B Shibin Poul <br/> Abhilash K S <br/> Harsha Patil H D <br/>
		  working through requirements, building 
          the features, and making sure the whole flow stays simple and reliable.
        </p>

      </div>
    </div>
  );
}
