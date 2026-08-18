import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * PDF Templates Proxy API
 * This server-side route avoids CORS and secures the Directus token.
 */
export async function GET() {
    try {
        const cookieStore = await cookies();
        const userToken = cookieStore.get("vos_access_token")?.value;
        const staticToken = process.env.DIRECTUS_STATIC_TOKEN;
        const activeToken = userToken || staticToken;
        
        const response = await fetch(`${API_BASE_URL}/items/pdf_templates`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {}),
            },
        });

        if (!response.ok) {
            if (response.status === 403 || response.status === 401) {
                // If the collection doesn't exist, user lacks permission, or token is invalid, fail gracefully
                return NextResponse.json({ data: [] });
            }
            throw new Error(`Directus error: ${response.status}`);
        }
        
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('API Error (GET pdf_templates):', error);
        return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const userToken = cookieStore.get("vos_access_token")?.value;
        const staticToken = process.env.DIRECTUS_STATIC_TOKEN;
        const activeToken = userToken || staticToken;

        const body = await request.json();
        const response = await fetch(`${API_BASE_URL}/items/pdf_templates`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {}),
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error(`Directus error: ${response.status}`);
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('API Error (POST pdf_templates):', error);
        return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
    }
}


