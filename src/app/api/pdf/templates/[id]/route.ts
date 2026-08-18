import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const cookieStore = await cookies();
        const userToken = cookieStore.get("vos_access_token")?.value;
        const staticToken = process.env.DIRECTUS_STATIC_TOKEN;
        const activeToken = userToken || staticToken;

        const { id } = await params;
        const body = await request.json();
        const response = await fetch(`${API_BASE_URL}/items/pdf_templates/${id}`, {
            method: 'PATCH',
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
        console.error('API Error (PATCH pdf_templates):', error);
        return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const cookieStore = await cookies();
        const userToken = cookieStore.get("vos_access_token")?.value;
        const staticToken = process.env.DIRECTUS_STATIC_TOKEN;
        const activeToken = userToken || staticToken;

        const { id } = await params;
        const response = await fetch(`${API_BASE_URL}/items/pdf_templates/${id}`, {
            method: 'DELETE',
            headers: {
                ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {}),
            },
        });

        if (!response.ok) throw new Error(`Directus error: ${response.status}`);
        
        // Directus DELETE usually returns 204 No Content
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('API Error (DELETE pdf_templates):', error);
        return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }
}
