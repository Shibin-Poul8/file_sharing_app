export default function AboutPage() {
	return (
		<div className="min-h-screen bg-gray-50 py-12">
			<div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow">
			<h1 className="text-3xl font-bold mb-4 text-blue-600">About FileShare</h1>

				<p className="text-gray-700 mb-4">
					FileShare is a lightweight file sharing app built with Next.js and
					Firebase. It lets a sender upload a file, send a link to a recipient
					(or save metadata) and the recipient can open the link, sign in, and
					download the shared files.
				</p>

				<h2 className="text-2xl font-semibold mt-6 mb-2 text-blue-600">How it works</h2>
				<ol className="list-decimal list-inside text-gray-600 space-y-2">
					<li>
						Sender chooses a file (or drags and drops) and uploads it to Firebase
						Storage. The app returns a download URL.
					</li>
					<li>
						The sender provides the recipient's email and clicks Send. The app
						stores a small metadata document in Firestore (collection
						<code className="mx-1">sharedFiles</code>) containing the
						recipient email, file URL, filename, size and timestamp.
					</li>
					<li>
						Optionally the app can send an email (via an API or Cloud Function)
						with the link to the recipient. The recipient opens the link.
					</li>
					<li>
						If the recipient is not signed in they are prompted to sign in. After
						signing in the app queries Firestore for files shared to that email
						and shows download links.
					</li>
				</ol>

				<h2 className="text-2xl font-semibold mt-6 mb-2 text-blue-600">Firebase usage</h2>
				<p className="text-gray-700 mb-2">
					This project uses Firebase for three purposes:
				</p>
				<ul className="list-disc list-inside text-gray-700 space-y-2">
					<li>
						<strong>Authentication</strong> — via Firebase Auth to sign in users.
					</li>
					<li>
						<strong>Storage</strong> — files are stored in Firebase Storage and
						served via secure download URLs.
					</li>
					<li>
						<strong>Firestore</strong> — lightweight metadata for shared files
						is stored in a collection (example: <code>sharedFiles</code>).
					</li>
				</ul>

				

				<h2 className="text-2xl font-semibold mt-6 mb-2 text-blue-600">Security notes</h2>
				<ul className="list-disc list-inside text-gray-700 space-y-2">
					<li>Consider using time-limited share tokens instead of exposing raw URLs.</li>
					<li>Protect Firestore rules to ensure only intended recipients can access metadata.</li>
					<li>Use Firebase Storage rules to control read access where appropriate.</li>
				</ul>

				

			</div>
		</div>
	);
}

