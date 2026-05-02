import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!DIRECTUS_URL) {
	throw new Error("NEXT_PUBLIC_API_BASE_URL is not defined in environment variables");
}

const STATIC_TOKEN =
	process.env.DIRECTUS_STATIC_TOKEN ||
	process.env.DIRECTUS_TOKEN ||
	process.env.NEXT_PUBLIC_DIRECTUS_STATIC_TOKEN;

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

async function resolveUserId() {
	const cookieStore = await cookies();
	const token = cookieStore.get(COOKIE_NAME)?.value;
	if (!token) return null;
	const payload = decodeJwtPayload(token) || {};

	const directId = payload.id || payload.user_id || payload.sub;
	if (typeof directId === "number" || typeof directId === "string") {
		return directId;
	}

	const email =
		payload.email ||
		payload.Email ||
		payload.user_email ||
		payload.userEmail ||
		null;

	if (!email || typeof email !== "string") return null;

	const res = await dFetch(
		`/items/user?filter[user_email][_eq]=${encodeURIComponent(email)}` +
			"&limit=1&fields=user_id"
	);

	const user = res?.data?.[0];
	return user?.user_id || null;
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
			...(STATIC_TOKEN ? { Authorization: `Bearer ${STATIC_TOKEN}` } : {}),
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
		const r = await dFetch(`/items/competitors?limit=${LIMIT}&fields=*`);
		if (r?.error) {
			return NextResponse.json({ error: r.error }, { status: 500 });
		}

		const records = r?.data || [];
		const userIds = Array.from(
			new Set(
				records
					.flatMap((record: Record<string, unknown>) => [
						record.created_by,
						record.updated_by,
						record.user_created,
						record.user_updated,
					])
					.filter(
						(value: unknown) =>
							typeof value === "number" || typeof value === "string"
					)
					.map((value: number | string) => String(value))
			)
		);

		const userMap = new Map<string, Record<string, unknown>>();
		if (userIds.length > 0) {
			const usersRes = await dFetch(
				`/items/user?filter[user_id][_in]=${userIds.join(",")}` +
					"&fields=user_id,user_fname,user_mname,user_lname,user_email"
			);

			if (!usersRes?.error) {
				(usersRes?.data || []).forEach((user: Record<string, unknown>) => {
					userMap.set(String(user.user_id), user);
				});
			}
		}

		const enriched = records.map((record: Record<string, unknown>) => {
			const createdBy =
				record.created_by ?? record.user_created ?? null;
			const updatedBy =
				record.updated_by ?? record.user_updated ?? null;

			const createdByKey =
				typeof createdBy === "number" || typeof createdBy === "string"
					? String(createdBy)
					: null;
			const updatedByKey =
				typeof updatedBy === "number" || typeof updatedBy === "string"
					? String(updatedBy)
					: null;

			const createdByDisplay = createdByKey
				? userMap.get(createdByKey) || createdBy
				: createdBy;

			return {
				...record,
				created_by: createdByDisplay,
				updated_by: updatedByKey
					? userMap.get(updatedByKey) || updatedBy
					: updatedBy,
				created_at:
					record.created_at || record.date_created || record.createdAt,
			};
		});

		return NextResponse.json({ competitors: enriched });
	} catch (err: unknown) {
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : "Unknown error" },
			{ status: 500 }
		);
	}
}

export async function POST(req: NextRequest) {
	const body = await req.json();
	const userId = await resolveUserId();
	const timestamp = getTimestamp();

	const created = await dFetch(`/items/competitors`, {
		method: "POST",
		body: JSON.stringify({
			...body,
			created_by: userId,
			created_at: timestamp,
		}),
	});

	return NextResponse.json({ success: true, data: created?.data });
}

export async function PATCH(req: NextRequest) {
	const body = await req.json();
	const { id, ...rest } = body;

	await dFetch(`/items/competitors/${id}`, {
		method: "PATCH",
		body: JSON.stringify({
			...rest,
		}),
	});

	return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
	const id = req.nextUrl.searchParams.get("id");

	await dFetch(`/items/competitors/${id}`, { method: "DELETE" });

	return NextResponse.json({ success: true });
}
