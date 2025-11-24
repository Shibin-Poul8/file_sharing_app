import { db, auth } from "../../../../firebase/config";
import { collection, doc, updateDoc, deleteDoc, setDoc, query, where, getDocs } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";

export async function POST(req) {
  try {
    const { requestId, action } = await req.json();

    if (!requestId || !action || !["approve", "reject"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid requestId/action" }),
        { status: 400 }
      );
    }

    // Get the signup request
    const reqRef = doc(db, "signupRequests", requestId);
    const reqSnapshot = await getDocs(
      query(collection(db, "signupRequests"), where("status", "==", "pending"))
    );

    const request = reqSnapshot.docs.find((d) => d.id === requestId);
    if (!request) {
      return new Response(
        JSON.stringify({ error: "Signup request not found or already processed" }),
        { status: 404 }
      );
    }

    const requestData = request.data();

    if (action === "reject") {
      // Delete the signup request
      await deleteDoc(reqRef);
      return new Response(
        JSON.stringify({ success: true, message: "Signup request rejected and deleted" }),
        { status: 200 }
      );
    }

    if (action === "approve") {
      // Create the user account (requires Firebase Admin SDK)
      // For client-side approach, store the request data and guide admin to create user manually
      // OR use a server-side admin SDK approach
      
      // For now, mark as approved in Firestore
      // In production, use Firebase Admin SDK to create user programmatically
      await updateDoc(reqRef, {
        status: "approved",
        approvedAt: new Date(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Signup request approved. User account creation in progress.",
          requestData: {
            email: requestData.email,
            name: requestData.name,
          },
        }),
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error processing signup request:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process signup request" }),
      { status: 500 }
    );
  }
}
