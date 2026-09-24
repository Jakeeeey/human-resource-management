import type { ManpowerRequest } from "../types";

interface NamedUser {
    id: number | string;
    name: string;
}

export function requesterName(
    request: Pick<ManpowerRequest, "requested_by">,
    users: NamedUser[] = []
): string {
    const requester = request.requested_by;
    if (requester === null || requester === undefined || requester === "") return "—";

    if (typeof requester === "object") {
        const { user_fname, user_lname, user_id } = requester as {
            user_fname?: string | null;
            user_lname?: string | null;
            user_id?: number | string | null;
        };
        const full = [user_fname, user_lname].filter(Boolean).join(" ").trim();
        if (full) return full;
        return user_id != null ? users.find((u) => String(u.id) === String(user_id))?.name ?? String(user_id) : "—";
    }

    return users.find((u) => String(u.id) === String(requester))?.name ?? String(requester);
}
