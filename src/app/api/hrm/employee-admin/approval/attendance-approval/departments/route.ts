import { NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function GET() {
  try {
    const token = process.env.DIRECTUS_STATIC_TOKEN || "";
    
    const response = await fetch(`${DIRECTUS_URL}/items/department?fields=department_id,department_name&sort=department_name`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Directus error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Fetch departments error:", error);
    return NextResponse.json({ data: [] });
  }
}
