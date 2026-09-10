import { NextRequest, NextResponse } from "next/server";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { setApplicantStatus } from "@/modules/human-resource-management/shared/services/applicant-status-service";
import type { SubmitApplicationPayload } from "@/modules/human-resource-management/application-form/types";

export const runtime = "nodejs";

const HOW_HEARD = ["Walk-In", "Advertisement", "Friend/Family", "MEN2 Employee", "Other"];
const SEX = ["Male", "Female"];
const CIVIL_STATUS = ["Single", "Married", "Widowed", "Separated", "Divorced"];

function firstError(res: unknown): string | null {
    const r = res as { errors?: { message?: string }[] } | null | undefined;
    if (r && Array.isArray(r.errors) && r.errors.length) {
        return r.errors[0]?.message || "Directus request failed";
    }
    return null;
}

async function insertChildren(
    table: string,
    applicationId: number,
    rows: object[]
): Promise<string | null> {
    if (!rows.length) return null;
    const res = await dFetch(`/items/${table}`, {
        method: "POST",
        body: JSON.stringify(
            rows.map((r, i) => ({ ...r, application_id: applicationId, sort: i }))
        ),
    });
    return firstError(res);
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as SubmitApplicationPayload;

        const firstName = body.first_name?.trim() || "";
        const middleName = body.middle_name?.trim() || "";
        const lastName = body.last_name?.trim() || "";
        const position = body.position_applied_for?.trim() || "";
        const phone = body.phone?.trim() || "";
        const birthdate = body.birthdate?.trim() || "";
        const sex = body.sex?.trim() || "";
        const howHeard = body.how_heard && HOW_HEARD.includes(body.how_heard) ? body.how_heard : null;
        const howHeardOther = howHeard === "Other" ? body.how_heard_other?.trim() || null : null;
        const civilStatus =
            body.civil_status && CIVIL_STATUS.includes(body.civil_status) ? body.civil_status : null;

        const missing: string[] = [];
        if (!firstName) missing.push("first name");
        if (!lastName) missing.push("last name");
        if (!position) missing.push("position applied for");
        if (!phone) missing.push("contact number");
        if (!birthdate) missing.push("birthdate");
        if (!SEX.includes(sex)) missing.push("sex");
        if (body.certification_agreed !== true) missing.push("certification agreement");
        if (missing.length) {
            return NextResponse.json(
                { error: `Please complete: ${missing.join(", ")}.` },
                { status: 400 }
            );
        }

        const token = req.cookies.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const createdBy = payload?.sub ? Number(payload.sub) || null : null;

        const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

        // NO DEDUP / NO REUSE: every submission creates a fresh `applicant` instance.
        // One person applying twice yields two applicant rows, each with exactly one
        // application (the `application.applicant_id` UNIQUE key still holds).
        const createdApplicant = await dFetch(`/items/applicant`, {
            method: "POST",
            body: JSON.stringify({
                full_name: fullName,
                position_applied_for: position,
                created_by: createdBy,
            }),
        });
        const applicantErr = firstError(createdApplicant);
        if (applicantErr || !createdApplicant?.data?.id) {
            return NextResponse.json(
                { error: applicantErr || "Failed to create applicant record." },
                { status: 502 }
            );
        }
        const applicantId: number = createdApplicant.data.id;

        // The row starts at the DB default `draft`; the SINGLE status writer advances
        // it to `submitted` (creation IS the submission moment).
        try {
            await setApplicantStatus({ applicantId, status: "submitted" });
        } catch (err: unknown) {
            console.error(
                "[application-form] failed to set applicant status:",
                err instanceof Error ? err.message : err
            );
            return NextResponse.json({ error: "Failed to submit application." }, { status: 502 });
        }

        const nowIso = new Date().toISOString();
        const createdApplication = await dFetch(`/items/application`, {
            method: "POST",
            body: JSON.stringify({
                applicant_id: applicantId,
                position_applied_for: position,
                how_heard: howHeard,
                how_heard_other: howHeardOther,

                first_name: firstName,
                middle_name: middleName || null,
                last_name: lastName,
                nickname: body.nickname ?? null,
                address: body.address ?? null,
                phone,
                email: body.email ?? null,
                birthdate,
                birthplace: body.birthplace ?? null,
                sex,
                height_cm: body.height_cm ?? null,
                weight_kg: body.weight_kg ?? null,
                civil_status: civilStatus,
                religion: body.religion ?? null,
                sss_no: body.sss_no ?? null,
                tin: body.tin ?? null,
                philhealth_no: body.philhealth_no ?? null,
                pagibig_no: body.pagibig_no ?? null,
                drivers_license_no: body.drivers_license_no ?? null,
                photo_file: body.photo_file ?? null,

                special_skills: body.special_skills ?? null,
                languages: body.languages ?? null,
                organizational_affiliations: body.organizational_affiliations ?? null,
                hobbies_interests: body.hobbies_interests ?? null,

                has_company_relatives: Boolean(body.has_company_relatives),

                certification_agreed: true,
                certification_text_snapshot: body.certification_text_snapshot ?? null,
                certification_signed_at: nowIso,
                signature_file: body.signature_file ?? null,

                source: "hrm-assisted",
                submitted_at: nowIso,
                created_by: createdBy,
            }),
        });
        const applicationErr = firstError(createdApplication);
        if (applicationErr || !createdApplication?.data?.id) {
            return NextResponse.json(
                { error: applicationErr || "Failed to create application." },
                { status: 502 }
            );
        }
        const applicationId: number = createdApplication.data.id;

        const childInserts: [string, object[]][] = [
            ["application_family_member", body.family_members || []],
            ["application_company_relative", body.company_relatives || []],
            ["application_education", body.education || []],
            ["application_licensure_exam", body.licensure_exams || []],
            ["application_work_experience", body.work_experience || []],
            ["application_reference", body.references || []],
            ["application_training", body.trainings || []],
            [
                "application_attachment",
                (body.attachments || []).map((a) => ({ ...a, uploaded_at: nowIso })),
            ],
        ];

        const childErrors = (
            await Promise.all(
                childInserts.map(([table, rows]) => insertChildren(table, applicationId, rows))
            )
        ).filter((e): e is string => Boolean(e));

        if (childErrors.length) {
            console.error("[application-form] one or more child inserts failed:", childErrors);
        }

        return NextResponse.json({
            applicant_id: applicantId,
            application_id: applicationId,
            ...(childErrors.length
                ? { warning: "Application saved, but some sections may not have been saved. Please tell HR." }
                : {}),
        });
    } catch (err: unknown) {
        console.error("[application-form] submit failed:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
        );
    }
}
