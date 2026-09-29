interface MsEnvelope<T> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: Record<string, string[]>;
}

async function unwrap<T>(res: Response): Promise<T | undefined> {
    let envelope: MsEnvelope<T> | null = null;
    try {
        envelope = (await res.json()) as MsEnvelope<T>;
    } catch {
        envelope = null;
    }
    if (!res.ok || !envelope || envelope.success !== true) {
        const fallback = `Mailing Studio request failed (HTTP ${res.status})`;
        const message = envelope?.message ?? fallback;
        const details = fieldErrorDetails(envelope?.errors);
        throw new Error(details ? `${message} — ${details}` : message);
    }
    return envelope.data;
}

function fieldErrorDetails(errors: Record<string, string[]> | undefined): string | null {
    if (!errors) return null;
    const parts: string[] = [];
    for (const [field, messages] of Object.entries(errors)) {
        if (messages.length > 0) parts.push(`${field}: ${messages.join(", ")}`);
    }
    return parts.length > 0 ? parts.join("; ") : null;
}

export async function msGet<T>(path: string): Promise<T | undefined> {
    const res = await fetch(`/api/hrm/mailing-studio${path}`);
    return unwrap<T>(res);
}

export async function msPost<T>(path: string, body: unknown): Promise<T | undefined> {
    const res = await fetch(`/api/hrm/mailing-studio${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return unwrap<T>(res);
}

export async function msPatch<T>(path: string, body: unknown): Promise<T | undefined> {
    const res = await fetch(`/api/hrm/mailing-studio${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return unwrap<T>(res);
}

export async function msDelete<T>(path: string): Promise<T | undefined> {
    const res = await fetch(`/api/hrm/mailing-studio${path}`, { method: "DELETE" });
    return unwrap<T>(res);
}
