import { NextRequest, NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const LIMIT = 1000;

const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

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
        let message = text;
        try {
            const parsed = JSON.parse(text);
            message = parsed?.errors?.[0]?.message || text;
        } catch {
        }
        throw new Error(message);
    }

    if (res.status === 204) {
        return null;
    }

    return res.json();
}

interface CriterionRow {
    id: number;
    template_id: number;
    name: string;
    weight_percentage: number;
    is_quiz_criterion: boolean;
    sort: number;
}

interface CriterionInput {
    name: string;
    weight_percentage: number;
    is_quiz_criterion: boolean;
    sort: number;
}

function validateCriteria(stage: string, criteria: CriterionInput[]): string | null {
    const quizRows = criteria.filter((c) => c.is_quiz_criterion);
    if (stage === "Initial" && quizRows.length !== 1) {
        return "An Initial-stage template must have exactly one Quiz Score criterion.";
    }
    if (stage === "Final" && quizRows.length !== 0) {
        return "A Final-stage template cannot have a Quiz Score criterion.";
    }
    const total = criteria.reduce((sum, c) => sum + (Number(c.weight_percentage) || 0), 0);
    if (Math.abs(total - 100) > 0.01) {
        return `Criteria weights must add up to exactly 100% (received ${total}%).`;
    }
    return null;
}

async function clearOtherDefaultsForStage(stage: string, exceptId: number) {
    const res = await dFetch(
        `/items/interview_criteria_template?filter[stage][_eq]=${stage}&limit=${LIMIT}&fields=id,is_default_for_stage`
    );
    const others = ((res?.data || []) as { id: number; is_default_for_stage: unknown }[]).filter(
        (t) => t.id !== exceptId && (t.is_default_for_stage === true || t.is_default_for_stage === 1)
    );
    await Promise.all(
        others.map((t) =>
            dFetch(`/items/interview_criteria_template/${t.id}`, {
                method: "PATCH",
                body: JSON.stringify({ is_default_for_stage: false }),
            })
        )
    );
}

async function replaceCriteria(templateId: number, criteria: CriterionInput[]) {
    const existingRes = await dFetch(
        `/items/interview_criterion?filter[template_id][_eq]=${templateId}&limit=${LIMIT}&fields=id`
    );
    const existingIds: number[] = (existingRes?.data || []).map((r: { id: number }) => r.id);
    if (existingIds.length) {
        await dFetch(`/items/interview_criterion`, {
            method: "DELETE",
            body: JSON.stringify(existingIds),
        });
    }

    if (!criteria.length) return;
    await dFetch(`/items/interview_criterion`, {
        method: "POST",
        body: JSON.stringify(
            criteria.map((c) => ({
                template_id: templateId,
                name: c.name,
                weight_percentage: c.weight_percentage,
                is_quiz_criterion: c.is_quiz_criterion,
                sort: c.sort,
            }))
        ),
    });
}

export async function GET() {
    try {
        const templatesRes = await dFetch(
            `/items/interview_criteria_template?limit=${LIMIT}&sort=-created_at`
        );

        if (templatesRes.error) {
            return NextResponse.json({ error: templatesRes.error }, { status: 500 });
        }

        const templates: { id: number; [key: string]: unknown }[] = templatesRes.data || [];
        if (!templates.length) {
            return NextResponse.json({ templates: [] });
        }

        const templateIds = templates.map((t) => t.id);
        const criteriaRes = await dFetch(
            `/items/interview_criterion?filter[template_id][_in]=${templateIds.join(",")}&limit=${LIMIT}&sort=sort`
        );
        const criteriaByTemplateId = new Map<number, CriterionRow[]>();
        for (const row of (criteriaRes?.data || []) as CriterionRow[]) {
            const list = criteriaByTemplateId.get(row.template_id) || [];
            list.push(row);
            criteriaByTemplateId.set(row.template_id, list);
        }

        const enriched = templates.map((t) => ({
            ...t,
            criteria: criteriaByTemplateId.get(t.id) || [],
        }));

        return NextResponse.json({ templates: enriched });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { criteria, ...templateData } = body as {
        criteria: CriterionInput[];
        stage: string;
        [key: string]: unknown;
    };

    const validationError = validateCriteria(String(templateData.stage ?? ""), criteria || []);
    if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
    }

    try {
        const created = await dFetch(`/items/interview_criteria_template`, {
            method: "POST",
            body: JSON.stringify(templateData),
        });

        const templateId = created?.data?.id;
        if (templateId && Array.isArray(criteria) && criteria.length) {
            await replaceCriteria(templateId, criteria);
        }

        if (templateId && templateData.is_default_for_stage) {
            await clearOtherDefaultsForStage(String(templateData.stage), templateId);
        }

        return NextResponse.json({ success: true, data: created?.data });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Create failed" },
            { status: 500 }
        );
    }
}

export async function PATCH(req: NextRequest) {
    const body = await req.json();
    const { id, criteria, ...rest } = body as {
        id: number;
        criteria?: CriterionInput[];
        stage?: string;
        [key: string]: unknown;
    };

    try {
        if (Array.isArray(criteria)) {
            let effectiveStage = rest.stage;
            if (effectiveStage === undefined) {
                const currentRes = await dFetch(
                    `/items/interview_criteria_template/${id}?fields=stage`
                );
                effectiveStage = currentRes?.data?.stage;
            }
            const validationError = validateCriteria(String(effectiveStage ?? ""), criteria);
            if (validationError) {
                return NextResponse.json({ error: validationError }, { status: 400 });
            }
        }

        await dFetch(`/items/interview_criteria_template/${id}`, {
            method: "PATCH",
            body: JSON.stringify(rest),
        });

        if (Array.isArray(criteria)) {
            await replaceCriteria(id, criteria);
        }

        if (rest.is_default_for_stage) {
            const stageForClear =
                rest.stage ??
                (
                    await dFetch(`/items/interview_criteria_template/${id}?fields=stage`)
                )?.data?.stage;
            await clearOtherDefaultsForStage(String(stageForClear), id);
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Update failed" },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    try {
        const sheetsRes = await dFetch(
            `/items/interview_score_sheet?filter[template_id][_eq]=${id}&aggregate[count]=*`
        );
        const sheetCount = Number(sheetsRes?.data?.[0]?.count ?? 0);

        if (sheetCount > 0) {
            return NextResponse.json(
                {
                    error: `This template has ${sheetCount} recorded score sheet(s) and can't be deleted. Archive it instead to keep it out of use while preserving the history.`,
                    hasScoreSheets: true,
                },
                { status: 409 }
            );
        }

        await dFetch(`/items/interview_criteria_template/${id}`, { method: "DELETE" });

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Delete failed" },
            { status: 500 }
        );
    }
}
