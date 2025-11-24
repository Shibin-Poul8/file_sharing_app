import { db } from "../../../../firebase/config";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function POST(req) {
  try {
    const { name, email, phone, organization, passwordHash } = await req.json();

    if (!email || !name || !passwordHash) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, name, passwordHash" }),
        { status: 400 }
      );
    }

    // Create signup request document
    const signupRequestRef = await addDoc(collection(db, "signupRequests"), {
      name,
      email,
      phone: phone || "",
      organization: organization || "",
      passwordHash,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        requestId: signupRequestRef.id,
        message: "Signup request submitted. Awaiting admin approval.",
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating signup request:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create signup request" }),
      { status: 500 }
    );
  }
}
