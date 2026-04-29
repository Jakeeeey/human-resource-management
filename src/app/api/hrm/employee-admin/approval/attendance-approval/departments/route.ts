import { NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function GET() {
  try {
    const token = process.env.DIRECTUS_STATIC_TOKEN ||
      process.env.DIRECTUS_TOKEN ||
      process.env.NEXT_PUBLIC_DIRECTUS_STATIC_TOKEN ||
      "";

    const baseUrl = DIRECTUS_URL?.endsWith('/') ? DIRECTUS_URL.slice(0, -1) : DIRECTUS_URL;
    const url = `${baseUrl}/items/department?fields=department_id,department_name&sort=department_name&limit=1000`;



    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ERROR] Directus department fetch failed: ${response.status} - route.ts:26`, errorText);
      throw new Error(`Directus error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Fetch departments error: - route.ts:34", error);
    return NextResponse.json({ data: [] });
  }
}
