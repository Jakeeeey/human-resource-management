import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
const COOKIE_NAME = "vos_access_token";
const LIMIT = 1000;

function decodeJwtPayload(token: string) {
	try {
		const parts = token.split(".");
		if (parts.length < 2) return null;
		const p = parts[1];
		const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
		const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
		const json = Buffer.from(padded, "base64").toString("utf8");
		return JSON.parse(json);
	} catch {
		return null;
	}
}

async function getUserId() {
	const cookieStore = await cookies();
	const token = cookieStore.get(COOKIE_NAME)?.value;
	if (!token) return null;
	const payload = decodeJwtPayload(token);
	return payload?.id || payload?.user_id || payload?.sub || null;
}

function getTimestamp() {
	const now = new Date();
	const pad = (value: number) => String(value).padStart(2, "0");
	return [
		`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
		`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
	].join(" ");
}

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
		const r = await dFetch(`/items/employment_status?limit=${LIMIT}&fields=*`);
		if (r.error) {
			return NextResponse.json({ error: r.error }, { status: 500 });
		}

		const records = r.data || [];
		const userIds = Array.from(
			new Set(
				records
					.flatMap((record: Record<string, unknown>) => [
						record.created_by,
						record.updated_by,
					])
					.filter(
						(value: unknown) =>
							typeof value === "number" || typeof value === "string"
					)
					.map((value: number | string) => String(value))
			)
		);

		if (userIds.length === 0) {
			return NextResponse.json({ records });
		}

		const usersRes = await dFetch(
			`/items/user?filter[user_id][_in]=${userIds.join(",")}` +
				"&fields=user_id,user_fname,user_mname,user_lname,user_email"
		);

		if (usersRes?.error) {
			return NextResponse.json({ records });
		}

		const userMap = new Map(
			(usersRes?.data || []).map((user: Record<string, unknown>) => [
				String(user.user_id),
				user,
			])
		);

		const enriched = records.map((record: Record<string, unknown>) => {
			const createdByKey =
				typeof record.created_by === "number" || typeof record.created_by === "string"
					? String(record.created_by)
					: null;
			const updatedByKey =
				typeof record.updated_by === "number" || typeof record.updated_by === "string"
					? String(record.updated_by)
					: null;

			return {
				...record,
				created_by: createdByKey ? userMap.get(createdByKey) || record.created_by : record.created_by,
				updated_by: updatedByKey ? userMap.get(updatedByKey) || record.updated_by : record.updated_by,
			};
		});

		return NextResponse.json({ records: enriched });
	} catch (err: unknown) {
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : "Unknown error" },
			{ status: 500 }
		);
	}
}

export async function POST(req: NextRequest) {
	const body = await req.json();
	const userId = await getUserId();
	const timestamp = getTimestamp();

	const created = await dFetch(`/items/employment_status`, {
		method: "POST",
		body: JSON.stringify({
			...body,
			created_by: userId,
			created_at: timestamp,
			updated_by: userId,
			updated_at: timestamp,
		}),
	});

	return NextResponse.json({ success: true, data: created?.data });
}

export async function PATCH(req: NextRequest) {
	const body = await req.json();
	const { id, ...rest } = body;
	const userId = await getUserId();
	const timestamp = getTimestamp();

	await dFetch(`/items/employment_status/${id}`, {
		method: "PATCH",
		body: JSON.stringify({
			...rest,
			updated_by: userId,
			updated_at: timestamp,
		}),
	});

	return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
	const id = req.nextUrl.searchParams.get("id");

	await dFetch(`/items/employment_status/${id}`, {
		method: "DELETE",
	});

	return NextResponse.json({ success: true });
}
