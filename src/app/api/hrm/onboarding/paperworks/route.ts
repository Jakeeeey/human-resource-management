import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  getPhilippineTime,
  mapWriteFailure,
  readSigningSession,
  serverError,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/signing/server/signingApiServer";
import {
  PaperworksCreateSchema,
  PaperworksListQuerySchema,
} from "@/modules/human-resource-management/onboarding/signing/types/signing-api.schema";
import { PaperworksSchema } from "@/modules/human-resource-management/onboarding/signing/types/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/paperworks — list per-applicant paperwork batch
// rollups, optionally scoped with `?applicant_id=` / `?status=`.
// POST /api/hrm/onboarding/paperworks — create one batch;
// UNIQUE(applicant_id) conflicts answer 409 and a missing applicant (FK)
// answers 400. Server-side only: the Directus token never reaches the
// browser.

export async function GET(req: NextRequest) {
  try {
    if (!readSigningSession(req)) return unauthorized();

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = PaperworksListQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed(query.error.flatten().fieldErrors);
    }

    const filters: string[] = [];
    if (query.data.applicant_id !== undefined) {
      filters.push(`filter[applicant_id][_eq]=${query.data.applicant_id}`);
    }
    if (query.data.status !== undefined) {
      filters.push(`filter[status][_eq]=${query.data.status}`);
    }
    const suffix =
      filters.length > 0 ? `?${filters.join("&")}&limit=100` : "?limit=100";
    const result = (await dFetch(`/items/paperworks${suffix}`)) as {
      data?: unknown[];
      errors?: unknown;
    };
    if (result?.errors) {
      console.error(
        "[onboarding-paperworks] list failed:",
        JSON.stringify(result.errors)
      );
      return serverError();
    }
    const rows = Array.isArray(result?.data) ? result.data : [];

    const parsed: unknown[] = [];
    for (const row of rows) {
      const rowParsed = PaperworksSchema.safeParse(row);
      if (!rowParsed.success) {
        console.error(
          "[onboarding-paperworks] row contract mismatch:",
          JSON.stringify(rowParsed.error.flatten())
        );
        return serverError();
      }
      parsed.push(rowParsed.data);
    }
    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    console.error("[onboarding-paperworks] list error:", error);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!readSigningSession(req)) return unauthorized();

    const body: unknown = await req.json().catch(() => null);
    const validation = PaperworksCreateSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const now = getPhilippineTime();
    const created = (await dFetch("/items/paperworks", {
      method: "POST",
      body: JSON.stringify({
        ...validation.data,
        created_at: now,
        updated_at: now,
      }),
    })) as { data?: unknown; errors?: unknown };

    if (created?.errors || !created?.data) {
      console.error(
        "[onboarding-paperworks] create failed:",
        JSON.stringify(created)
      );
      const failure = mapWriteFailure(created);
      return NextResponse.json(
        { success: false, message: failure.message },
        { status: failure.status }
      );
    }

    const parsed = PaperworksSchema.safeParse(created.data);
    if (!parsed.success) {
      console.error(
        "[onboarding-paperworks] created row contract mismatch:",
        JSON.stringify(parsed.error.flatten())
      );
      return serverError();
    }
    return NextResponse.json(
      { success: true, data: parsed.data },
      { status: 201 }
    );
  } catch (error) {
    console.error("[onboarding-paperworks] create error:", error);
    return serverError();
  }
}
