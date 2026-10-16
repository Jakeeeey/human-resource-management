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

export const MAX_TURNOVER_PDF_BYTES = 10 * 1024 * 1024;

function isPdfFile(file: File): boolean {
    if (file.type.trim().toLowerCase() === "application/pdf") return true;
    return file.name.trim().toLowerCase().endsWith(".pdf");
}

export function pickTurnoverPdfFile(): Promise<File | null> {
    return new Promise<File | null>((resolve, reject) => {
        if (typeof document === "undefined") {
            resolve(null);
            return;
        }
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/pdf,.pdf";
        input.style.position = "fixed";
        input.style.left = "-10000px";
        const pick = (): void => {
            if (input.files === null || input.files.length === 0) {
                input.remove();
                resolve(null);
                return;
            }
            const file = input.files[0];
            input.remove();
            if (!isPdfFile(file)) {
                reject(new Error("Only PDF files can be uploaded."));
                return;
            }
            if (file.size > MAX_TURNOVER_PDF_BYTES) {
                reject(new Error("File too large. Maximum size is 10 MB."));
                return;
            }
            resolve(file);
        };
        input.addEventListener("change", pick, { once: true });
        input.addEventListener(
            "cancel",
            () => {
                input.remove();
                resolve(null);
            },
            { once: true }
        );
        document.body.appendChild(input);
        input.click();
    });
}

export async function uploadTurnover201Staged(input: {
    documentId: number;
    bytes: Uint8Array;
    fileName: string;
}): Promise<{ fileId: string }> {
    if (
        !Number.isInteger(input.documentId) ||
        input.documentId <= 0 ||
        !(input.bytes instanceof Uint8Array) ||
        input.bytes.byteLength === 0 ||
        input.fileName.trim() === ""
    ) {
        throw new Error("Cannot upload the turnover PDF. Please try again.");
    }
    const uploadForm = new FormData();
    uploadForm.append(
        "file",
        new Blob([input.bytes as unknown as BlobPart], { type: "application/pdf" }),
        input.fileName
    );
    const uploadRes = await fetch("/api/hrm/clearance/turnover/upload", {
        method: "POST",
        body: uploadForm,
    });
    const uploadBody = await readBody(uploadRes);
    const fileId = readFileId(uploadBody);
    if (!uploadRes.ok || fileId === null) {
        throw new Error("Could not upload the turnover PDF. Please try again.");
    }
    return { fileId };
}

export async function fileTurnover201(input: {
    documentId: number;
    fileId: string;
}): Promise<void> {
    const attachRes = await fetch(`/api/hrm/clearance/turnover/${input.documentId}/attach-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_file_id: input.fileId }),
    });
    if (!attachRes.ok) {
        throw new Error("Could not attach the turnover PDF. Please try again.");
    }
    const fileRes = await fetch(`/api/hrm/clearance/turnover/${input.documentId}/file-record`, {
        method: "POST",
    });
    const fileBody = await readBody(fileRes);
    if (!fileRes.ok || !isRecord(fileBody) || !isRecord(fileBody.data)) {
        throw new Error("Could not file the turnover PDF to the 201 file. Please try again.");
    }
    const recordId = typeof fileBody.data.record_id === "number" ? fileBody.data.record_id : null;
    if (recordId === null) {
        throw new Error("Could not file the turnover PDF to the 201 file. Please try again.");
    }
}
