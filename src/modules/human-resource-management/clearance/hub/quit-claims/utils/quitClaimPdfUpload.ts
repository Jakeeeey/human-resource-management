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

const APPROVED_QUITCLAIM_FROZEN_CODE = "CLEARANCE_QUITCLAIM_FROZEN";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function uploadQuitClaim201Staged(input: {
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
        throw new Error("Cannot store the approved PDF. Please try again.");
    }
    const uploadForm = new FormData();
    uploadForm.append(
        "file",
        new Blob([input.bytes as unknown as BlobPart], { type: "application/pdf" }),
        input.fileName
    );
    const uploadRes = await fetch("/api/hrm/clearance/quit-claims/upload", {
        method: "POST",
        body: uploadForm,
    });
    const uploadBody = await readBody(uploadRes);
    const fileId =
        isRecord(uploadBody) && isRecord(uploadBody.data) && typeof uploadBody.data.id === "string"
            ? uploadBody.data.id
            : null;
    if (!uploadRes.ok || fileId === null || fileId === "") {
        throw new Error("Could not store the approved PDF. Please try again.");
    }
    return { fileId };
}

export async function fileQuitClaim201(input: {
    documentId: number;
    fileId: string;
}): Promise<void> {
    const attachRes = await fetch(`/api/hrm/clearance/quit-claims/${input.documentId}/attach-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_file_id: input.fileId }),
    });
    if (!attachRes.ok) {
        const attachBody = await readBody(attachRes);
        const code =
            isRecord(attachBody) && typeof attachBody.code === "string" ? attachBody.code : null;
        if (code !== APPROVED_QUITCLAIM_FROZEN_CODE) {
            throw new Error("Could not attach the approved PDF. Please try again.");
        }
    }
    const fileRes = await fetch(`/api/hrm/clearance/quit-claims/${input.documentId}/file-record`, {
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

export function pickQuitClaimPdfFile(): Promise<File | null> {
    return new Promise((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/pdf,.pdf";
        input.style.display = "none";
        let settled = false;
        const cleanup = (): void => {
            input.remove();
        };
        const succeed = (file: File | null): void => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(file);
        };
        const fail = (message: string): void => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new Error(message));
        };
        input.addEventListener("change", () => {
            const file = input.files && input.files.length > 0 ? input.files[0] ?? null : null;
            if (file === null) {
                succeed(null);
                return;
            }
            const isPdf =
                file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
            if (!isPdf) {
                fail("Only PDF files can be uploaded.");
                return;
            }
            if (file.size > MAX_FILE_BYTES) {
                fail("File too large. Maximum size is 10 MB.");
                return;
            }
            succeed(file);
        });
        input.addEventListener("cancel", () => {
            succeed(null);
        });
        document.body.appendChild(input);
        input.click();
    });
}
