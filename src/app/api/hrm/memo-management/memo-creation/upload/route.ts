import { NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8055";
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const directusFormData = new FormData();
        directusFormData.append("file", file);

        const response = await fetch(`${DIRECTUS_URL}/files`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${STATIC_TOKEN}`,
            },
            body: directusFormData,
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Directus file upload error:", errText);
            return NextResponse.json({ error: "Failed to upload file to Directus" }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json({ id: data.data.id, filename: data.data.filename_download });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
