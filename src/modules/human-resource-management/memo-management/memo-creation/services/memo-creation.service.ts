import { Memo } from "../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const headers = {
    Authorization: `Bearer ${STATIC_TOKEN}`,
    "Content-Type": "application/json",
};

export const memoCreationService = {
    async fetchAll(): Promise<Memo[]> {
        try {
            const url =
                `${API_BASE_URL}/items/memo` +
                `?fields=*,created_by.user_id,created_by.user_fname,created_by.user_lname,` +
                `updated_by.user_id,updated_by.user_fname,updated_by.user_lname` +
                `&sort=-created_at`;

            const response = await fetch(url, { headers });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [fetchAll]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const rows: Record<string, unknown>[] = result.data;

            return rows.map((row) => normalizeMemo(row));
        } catch (e) {
            console.error("Error fetching memos:", e);
            throw new Error("INTERNAL_FAIL: Failed to fetch memos");
        }
    },

    async create(memo: Partial<Memo>): Promise<Memo> {
        try {
            const response = await fetch(`${API_BASE_URL}/items/memo`, {
                method: "POST",
                headers,
                body: JSON.stringify(memo),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [create]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return normalizeMemo(result.data);
        } catch (e) {
            console.error("Error creating memo:", e);
            throw new Error("VALIDATION_FAILED: Failed to submit memo");
        }
    },

    async update(id: string | number, data: Partial<Memo>): Promise<Memo> {
        try {
            const response = await fetch(`${API_BASE_URL}/items/memo/${id}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [update:${id}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return normalizeMemo(result.data);
        } catch (e) {
            console.error("Error updating memo:", e);
            throw new Error("VALIDATION_FAILED: Failed to update memo");
        }
    },
    
    async getNextSequence(): Promise<number> {
        try {
            const dateObj = new Date();
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, "0");
            const date = String(dateObj.getDate()).padStart(2, "0");
            const datePrefix = `${year}${month}${date}`;
            
            const listUrl = `${API_BASE_URL}/items/memo?filter[memo_id][_starts_with]=MM-${datePrefix}-&sort=-memo_id&limit=1`;
            const listRes = await fetch(listUrl, { headers });
            let nextSequence = 1;
            if (listRes.ok) {
                const listData = await listRes.json();
                if (listData.data && listData.data.length > 0) {
                    const latestId = listData.data[0].memo_id;
                    const seqStr = latestId.split("-").pop();
                    if (seqStr) {
                        nextSequence = parseInt(seqStr, 10) + 1;
                    }
                }
            }
            return nextSequence;
        } catch {
            return 1;
        }
    }
};

function normalizeMemo(row: Record<string, unknown>): Memo {
    const creatorObj = row.created_by as Record<string, unknown> | number | null;
    const updaterObj = row.updated_by as Record<string, unknown> | number | null;

    const creatorIsObj = creatorObj && typeof creatorObj === "object";
    const updaterIsObj = updaterObj && typeof updaterObj === "object";

    return {
        id: row.id as number,
        memo_id: row.memo_id as string,
        subject: row.subject as string,
        attachment: row.attachment as string,
        created_at: (row.created_at as string) ?? null,
        created_by: creatorIsObj ? (creatorObj.user_id as number) : (creatorObj as number | null) ?? null,
        updated_at: (row.updated_at as string) ?? null,
        updated_by: updaterIsObj ? (updaterObj.user_id as number) : (updaterObj as number | null) ?? null,
        created_by_name: creatorIsObj
            ? `${creatorObj.user_fname ?? ""} ${creatorObj.user_lname ?? ""}`.trim() || undefined
            : undefined,
        updated_by_name: updaterIsObj
            ? `${updaterObj.user_fname ?? ""} ${updaterObj.user_lname ?? ""}`.trim() || undefined
            : undefined,
    } as unknown as Memo;
}
