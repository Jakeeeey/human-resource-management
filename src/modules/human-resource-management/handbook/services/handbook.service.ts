import { Handbook } from "../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const headers = {
    Authorization: `Bearer ${STATIC_TOKEN}`,
    "Content-Type": "application/json",
};

export const handbookService = {
    async fetchAll(): Promise<Handbook[]> {
        try {
            const url =
                `${API_BASE_URL}/items/company_handbook` +
                `?fields=*,created_by.user_id,created_by.user_fname,created_by.user_lname,updated_by.user_id,updated_by.user_fname,updated_by.user_lname` +
                `&sort=-created_at`;

            const response = await fetch(url, { headers });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [fetchAll]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const rows: Record<string, unknown>[] = result.data;
            
            if (rows.length === 0) return [];

            // Manually fetch all attachments for these handbooks
            const handbookIds = rows.map((r) => r.id);
            const attUrl = `${API_BASE_URL}/items/company_handbook_attachments?filter[company_handbook_id][_in]=${handbookIds.join(",")}&limit=-1`;
            const attRes = await fetch(attUrl, { headers });
            let allAttachments: Record<string, unknown>[] = [];
            if (attRes.ok) {
                const attData = await attRes.json();
                allAttachments = attData.data || [];
            }

            return rows.map((row) => {
                const rowAttachments = allAttachments.filter(a => a.company_handbook_id === row.id);
                row.attachments = rowAttachments;
                return normalizeHandbook(row);
            });
        } catch (e) {
            console.error("Error fetching handbooks:", e);
            throw new Error("INTERNAL_FAIL: Failed to fetch handbooks");
        }
    },

    async fetchById(id: number): Promise<Handbook | null> {
        try {
            const url =
                `${API_BASE_URL}/items/company_handbook/${id}` +
                `?fields=*,created_by.user_id,created_by.user_fname,created_by.user_lname,updated_by.user_id,updated_by.user_fname,updated_by.user_lname`;

            const response = await fetch(url, { headers });
            if (response.status === 404) return null;
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [fetchById:${id}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const row = result.data;

            // Fetch attachments for this specific handbook
            const attUrl = `${API_BASE_URL}/items/company_handbook_attachments?filter[company_handbook_id][_eq]=${id}&limit=-1`;
            const attRes = await fetch(attUrl, { headers });
            if (attRes.ok) {
                const attData = await attRes.json();
                row.attachments = attData.data || [];
            } else {
                row.attachments = [];
            }

            return normalizeHandbook(row);
        } catch (e) {
            console.error("Error fetching handbook:", e);
            throw new Error("INTERNAL_FAIL: Failed to fetch handbook");
        }
    },

    async create(handbook: Handbook): Promise<Handbook> {
        try {
            const body: Record<string, unknown> = {
                title: handbook.title,
                description: handbook.description ?? null,
            };
            if (handbook.created_by != null) body.created_by = handbook.created_by;

            const response = await fetch(`${API_BASE_URL}/items/company_handbook`, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [create handbook]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const createdHandbook = result.data;

            // Now handle attachments if any
            if (handbook.attachments && handbook.attachments.length > 0) {
                await Promise.all(
                    handbook.attachments.map(async (att) => {
                        const attResponse = await fetch(`${API_BASE_URL}/items/company_handbook_attachments`, {
                            method: "POST",
                            headers,
                            body: JSON.stringify({
                                company_handbook_id: createdHandbook.id,
                                file_url: att.file_url,
                                file_name: att.file_name,
                            }),
                        });
                        if (!attResponse.ok) {
                            const err = await attResponse.text();
                            console.error(`Failed to insert attachment ${att.file_name}:`, err);
                        }
                    })
                );
            }

            return await this.fetchById(createdHandbook.id) as Handbook;
        } catch (e) {
            console.error("Error creating handbook:", e);
            throw new Error("VALIDATION_FAILED: Failed to submit handbook");
        }
    },

    async update(id: number, data: Partial<Handbook>): Promise<Handbook> {
        try {
            const body: Record<string, unknown> = {};
            if (data.title !== undefined) body.title = data.title;
            if (data.description !== undefined) body.description = data.description;
            if (data.updated_by !== undefined) body.updated_by = data.updated_by;

            const response = await fetch(`${API_BASE_URL}/items/company_handbook/${id}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [update:${id}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Handle attachments update if provided
            if (data.attachments !== undefined) {
                // Fetch existing attachments
                const attUrl = `${API_BASE_URL}/items/company_handbook_attachments?filter[company_handbook_id][_eq]=${id}&limit=-1`;
                const attRes = await fetch(attUrl, { headers });
                let existingAtts: { id: number }[] = [];
                if (attRes.ok) {
                    const attData = await attRes.json();
                    existingAtts = attData.data || [];
                }

                const existingIds = existingAtts.map(a => a.id);
                const newIds = data.attachments.filter(a => a.id).map(a => a.id);
                
                // Delete attachments that were removed
                const idsToDelete = existingIds.filter(id => !newIds.includes(id));
                if (idsToDelete.length > 0) {
                    await fetch(`${API_BASE_URL}/items/company_handbook_attachments`, {
                        method: "DELETE",
                        headers,
                        body: JSON.stringify(idsToDelete),
                    });
                }

                // Add new attachments (those without id)
                const attachmentsToAdd = data.attachments.filter(a => !a.id);
                if (attachmentsToAdd.length > 0) {
                    await Promise.all(
                        attachmentsToAdd.map(async (att) => {
                            await fetch(`${API_BASE_URL}/items/company_handbook_attachments`, {
                                method: "POST",
                                headers,
                                body: JSON.stringify({
                                    company_handbook_id: id,
                                    file_url: att.file_url,
                                    file_name: att.file_name,
                                }),
                            });
                        })
                    );
                }
            }

            return await this.fetchById(id) as Handbook;
        } catch (e) {
            console.error("Error updating handbook:", e);
            throw new Error("VALIDATION_FAILED: Failed to update handbook");
        }
    },

    async remove(id: number): Promise<void> {
        try {
            // Manually delete attachments first to avoid foreign key issues
            const attUrl = `${API_BASE_URL}/items/company_handbook_attachments?filter[company_handbook_id][_eq]=${id}&limit=-1`;
            const attRes = await fetch(attUrl, { headers });
            if (attRes.ok) {
                const attData = await attRes.json();
                const attIds = attData.data?.map((a: Record<string, unknown>) => a.id) || [];
                if (attIds.length > 0) {
                    await fetch(`${API_BASE_URL}/items/company_handbook_attachments`, {
                        method: "DELETE",
                        headers,
                        body: JSON.stringify(attIds),
                    });
                }
            }

            const response = await fetch(`${API_BASE_URL}/items/company_handbook/${id}`, {
                method: "DELETE",
                headers,
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [delete:${id}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (e) {
            console.error("Error deleting handbook:", e);
            throw new Error("INTERNAL_FAIL: Failed to delete handbook");
        }
    },
};

function normalizeHandbook(row: Record<string, unknown>): Handbook {
    const creatorObj = row.created_by as Record<string, unknown> | number | null;
    const creatorIsObj = creatorObj && typeof creatorObj === "object";

    const updaterObj = row.updated_by as Record<string, unknown> | number | null;
    const updaterIsObj = updaterObj && typeof updaterObj === "object";

    const attachmentsRaw = row.attachments || row.company_handbook_attachments || [];
    
    return {
        id: row.id as number,
        title: row.title as string,
        description: (row.description as string) ?? null,
        created_at: (row.created_at as string) ?? null,
        created_by: creatorIsObj ? (creatorObj.user_id as number) : (creatorObj as number | null) ?? null,
        created_by_name: creatorIsObj
            ? `${creatorObj.user_fname ?? ""} ${creatorObj.user_lname ?? ""}`.trim() || undefined
            : undefined,
        updated_at: (row.updated_at as string) ?? null,
        updated_by: updaterIsObj ? (updaterObj.user_id as number) : (updaterObj as number | null) ?? null,
        updated_by_name: updaterIsObj
            ? `${updaterObj.user_fname ?? ""} ${updaterObj.user_lname ?? ""}`.trim() || undefined
            : undefined,
        attachments: Array.isArray(attachmentsRaw)
            ? (attachmentsRaw as Record<string, unknown>[]).map((att) => ({
                  id: att.id as number,
                  company_handbook_id: att.company_handbook_id as number,
                  file_url: att.file_url as string,
                  file_name: att.file_name as string,
              }))
            : [],
    };
}
