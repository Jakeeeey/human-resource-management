const SOA_PDF_FROZEN_CODE = "CLEARANCE_SOA_FROZEN";
const MAX_SOA_PDF_BYTES = 10 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

async function readBody(res: Response): Promise<unknown> {
    try {
        return await res.json();
    } catch {
        return null;
    }
}

function readFileId(body: unknown): string | null {
    if (!isRecord(body) || !isRecord(body.data)) return null;
    const id = (body.data as { id?: unknown }).id;
    return typeof id === "string" && id !== "" ? id : null;
}

export interface UploadSoa201StagedInput {
    documentId: number;
    bytes: Uint8Array;
    fileName: string;
}

export function pickSoaPdfFile(): Promise<File | null> {
    return new Promise((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/pdf,.pdf";
        input.style.display = "none";
        document.body.appendChild(input);
        const cleanup = (): void => {
            input.removeEventListener("change", onChange);
            input.removeEventListener("cancel", onCancel);
            input.remove();
        };
        const onChange = (): void => {
            const file = input.files?.[0] ?? null;
            cleanup();
            if (file === null) {
                resolve(null);
                return;
            }
            if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
                reject(new Error("Only PDF files can be uploaded."));
                return;
            }
            if (file.size > MAX_SOA_PDF_BYTES) {
                reject(new Error("File too large. Maximum size is 10 MB."));
                return;
            }
            resolve(file);
        };
        const onCancel = (): void => {
            cleanup();
            resolve(null);
        };
        input.addEventListener("change", onChange);
        input.addEventListener("cancel", onCancel);
        input.click();
    });
}

export async function uploadSoa201Staged(
    input: UploadSoa201StagedInput
): Promise<{ fileId: string }> {
    if (
        !Number.isInteger(input.documentId) ||
        input.documentId <= 0 ||
        !(input.bytes instanceof Uint8Array) ||
        input.bytes.byteLength === 0 ||
        input.fileName.trim() === ""
    ) {
        throw new Error("Cannot store the approved PDF. Please try again.");
    }
    const uploadForm = new FormData();
    uploadForm.append(
        "file",
        new Blob([input.bytes as unknown as BlobPart], { type: "application/pdf" }),
        input.fileName
    );
    const uploadRes = await fetch("/api/hrm/clearance/soa/upload", {
        method: "POST",
        body: uploadForm,
    });
    const uploadBody = await readBody(uploadRes);
    const fileId = readFileId(uploadBody);
    if (!uploadRes.ok || fileId === null || fileId === "") {
        throw new Error("Could not store the approved PDF. Please try again.");
    }
    return { fileId };
}

export async function fileSoa201(input: { documentId: number; fileId: string }): Promise<void> {
    const attachRes = await fetch(`/api/hrm/clearance/soa/${input.documentId}/attach-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_file_id: input.fileId }),
    });
    if (!attachRes.ok) {
        const attachBody = await readBody(attachRes);
        const code =
            isRecord(attachBody) && typeof attachBody.code === "string" ? attachBody.code : null;
        if (code !== SOA_PDF_FROZEN_CODE) {
            throw new Error("Could not attach the approved PDF. Please try again.");
        }
    }
    const fileRes = await fetch(`/api/hrm/clearance/soa/${input.documentId}/file-record`, {
        method: "POST",
    });
    const fileBody = await readBody(fileRes);
    if (!fileRes.ok || !isRecord(fileBody) || !isRecord(fileBody.data)) {
        throw new Error("Could not file the approved PDF to the 201 file. Please try again.");
    }
    const recordId = typeof fileBody.data.record_id === "number" ? fileBody.data.record_id : null;
    if (recordId === null) {
        throw new Error("Could not file the approved PDF to the 201 file. Please try again.");
    }
}
