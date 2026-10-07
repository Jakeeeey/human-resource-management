export const ISSUED_QUITCLAIM_UPLOAD_ERROR_CODES = {
    invalidInput: "CLEARANCE_QUITCLAIM_UPLOAD_INVALID_INPUT",
    uploadFailed: "CLEARANCE_QUITCLAIM_UPLOAD_FAILED",
    configMissing: "CLEARANCE_QUITCLAIM_UPLOAD_NOT_CONFIGURED",
} as const;

const EMPLOYEE_FILE_FOLDER_NAME = "201_emp_files";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PDF_MAGIC = "%PDF-";

function fail(code: string, detail: string): never {
    throw new Error(`${code}: ${detail}`);
}

function directusErrorText(body: unknown): string | null {
    if (typeof body !== "object" || body === null) return null;
    const errors = (body as { errors?: unknown }).errors;
    if (!Array.isArray(errors) || errors.length === 0) return null;
    return errors
        .map((entry) =>
            typeof (entry as { message?: unknown }).message === "string"
                ? (entry as { message: string }).message
                : JSON.stringify(entry)
        )
        .join("; ");
}

function readFileId(body: unknown): string | null {
    if (typeof body !== "object" || body === null) return null;
    const data = (body as { data?: unknown }).data;
    if (typeof data !== "object" || data === null) return null;
    const id = (data as { id?: unknown }).id;
    return typeof id === "string" && id !== "" ? id : null;
}

function readFolderId(body: unknown): string | null {
    if (typeof body !== "object" || body === null) return null;
    const data = (body as { data?: unknown }).data;
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0] as { id?: unknown };
    return typeof first.id === "string" && first.id !== "" ? first.id : null;
}

async function resolveEmployeeFolderId(base: string, headers: Record<string, string>): Promise<string | null> {
    const found: unknown = await fetch(
        `${base}/folders?filter[name][_eq]=${encodeURIComponent(EMPLOYEE_FILE_FOLDER_NAME)}&fields=id&limit=1`,
        { headers }
    )
        .then((res) => (res.ok ? res.json().catch(() => null) : null))
        .catch(() => null);
    const folderId = readFolderId(found);
    if (folderId !== null) return folderId;
    const created: unknown = await fetch(`${base}/folders`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name: EMPLOYEE_FILE_FOLDER_NAME }),
    })
        .then((res) => res.json().catch(() => null))
        .catch(() => null);
    return readFileId(created);
}

export async function uploadIssuedQuitClaimPdf(bytes: Uint8Array, fileName: string): Promise<string> {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || fileName.trim() === "") {
        fail(ISSUED_QUITCLAIM_UPLOAD_ERROR_CODES.invalidInput, "bytes and fileName are required");
    }
    if (bytes.byteLength > MAX_FILE_BYTES) {
        fail(ISSUED_QUITCLAIM_UPLOAD_ERROR_CODES.uploadFailed, "File too large (Max 10MB)");
    }
    const magic = new TextDecoder().decode(bytes.slice(0, PDF_MAGIC.length));
    if (magic !== PDF_MAGIC) {
        fail(ISSUED_QUITCLAIM_UPLOAD_ERROR_CODES.uploadFailed, "File content is not a PDF document");
    }
    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!base || base.trim() === "") {
        fail(ISSUED_QUITCLAIM_UPLOAD_ERROR_CODES.configMissing, "Directus base URL is not configured");
    }
    const token = process.env.DIRECTUS_STATIC_TOKEN;
    const headers: Record<string, string> =
        token && token.trim() !== "" ? { Authorization: `Bearer ${token}` } : {};
    const folderId = await resolveEmployeeFolderId(base, headers);
    const form = new FormData();
    if (folderId !== null) {
        form.append("folder", folderId);
    }
    form.append(
        "file",
        new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
        fileName
    );
    const uploadBody: unknown = await fetch(`${base}/files`, {
        method: "POST",
        headers,
        body: form,
    })
        .then((res) => res.json().catch(() => null) as Promise<unknown>)
        .catch(() => null);
    const uploadError = directusErrorText(uploadBody);
    if (uploadError) {
        fail(ISSUED_QUITCLAIM_UPLOAD_ERROR_CODES.uploadFailed, `filing upload rejected (${uploadError})`);
    }
    const fileId = readFileId(uploadBody);
    if (fileId === null) {
        fail(ISSUED_QUITCLAIM_UPLOAD_ERROR_CODES.uploadFailed, "upload returned no Directus file id");
    }
    return fileId;
}
