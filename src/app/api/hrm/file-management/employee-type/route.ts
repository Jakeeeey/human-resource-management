import { NextRequest, NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
const LIMIT = 1000;

async function dFetch(path: string, options?: RequestInit) {
	const res = await fetch(`${DIRECTUS_URL}${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${STATIC_TOKEN}`,
			...(options?.headers || {}),
		},
	});

	if (!res.ok) {
		const text = await res.text();
		console.error("DIRECTUS ERROR:", text);
		try {
			const parsed = JSON.parse(text);
			return { error: parsed };
		} catch {
			throw new Error(text);
		}
	}

	if (res.status === 204) {
		return null;
	}

	return res.json();
}

export async function GET() {
	try {
		const r = await dFetch(`/items/employee_type?limit=${LIMIT}&fields=*`);
		if (r.error) {
			return NextResponse.json({ error: r.error }, { status: 500 });
		}

		return NextResponse.json({ records: r.data || [] });
	} catch (err: unknown) {
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : "Unknown error" },
			{ status: 500 }
		);
	}
}

export async function POST(req: NextRequest) {
	const body = await req.json();

	const created = await dFetch(`/items/employee_type`, {
		method: "POST",
		body: JSON.stringify(body),
	});

	return NextResponse.json({ success: true, data: created?.data });
}

export async function PATCH(req: NextRequest) {
	const body = await req.json();
	const { id, ...rest } = body;

	await dFetch(`/items/employee_type/${id}`, {
		method: "PATCH",
		body: JSON.stringify(rest),
	});

	return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
	const id = req.nextUrl.searchParams.get("id");

	await dFetch(`/items/employee_type/${id}`, {
		method: "DELETE",
	});

	return NextResponse.json({ success: true });
}
