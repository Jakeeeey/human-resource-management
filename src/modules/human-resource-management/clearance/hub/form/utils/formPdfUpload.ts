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

export interface UploadFormPdfInput {
    documentId: number;
    bytes: Uint8Array;
    fileName: string;
}

export interface UploadFormPdfResult {
    fileId: string;
    recordId: number;
    alreadyFiled: boolean;
}

export function toFormUploadFileName(employeeName: string, refNo: string): string {
    const cleaned = employeeName
        .split("")
        .filter((ch) => ch >= " " && !"<>:/\\|?*\"".includes(ch))
        .join("")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
    const who = cleaned === "" ? "Employee" : cleaned;
    const ref = refNo.trim() === "" ? "pending" : refNo.trim();
    return `Clearance - ${who} - ${ref}.pdf`;
}

export async function uploadFormPdf(input: UploadFormPdfInput): Promise<UploadFormPdfResult> {
    if (
        !Number.isInteger(input.documentId) ||
        input.documentId <= 0 ||
        !(input.bytes instanceof Uint8Array) ||
        input.bytes.byteLength === 0 ||
        input.fileName.trim() === ""
    ) {
        throw new Error("Cannot upload the clearance PDF. Please try again.");
    }
    const uploadForm = new FormData();
    uploadForm.append(
        "file",
        new Blob([input.bytes as unknown as BlobPart], { type: "application/pdf" }),
        input.fileName
    );
    const uploadRes = await fetch("/api/hrm/clearance/form/upload", {
        method: "POST",
        body: uploadForm,
    });
    const uploadBody = await readBody(uploadRes);
    const fileId = readFileId(uploadBody);
    if (!uploadRes.ok || fileId === null) {
        throw new Error("Could not upload the clearance PDF. Please try again.");
    }
    const attachRes = await fetch(`/api/hrm/clearance/form/${input.documentId}/attach-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_file_id: fileId }),
    });
    if (!attachRes.ok) {
        throw new Error("Could not attach the clearance PDF. Please try again.");
    }
    const fileRes = await fetch(`/api/hrm/clearance/form/${input.documentId}/file-record`, {
        method: "POST",
    });
    const fileBody = await readBody(fileRes);
    if (!fileRes.ok || !isRecord(fileBody) || !isRecord(fileBody.data)) {
        throw new Error("Could not file the clearance PDF to the 201 file. Please try again.");
    }
    const recordId = typeof fileBody.data.record_id === "number" ? fileBody.data.record_id : null;
    if (recordId === null) {
        throw new Error("Could not file the clearance PDF to the 201 file. Please try again.");
    }
    return {
        fileId,
        recordId,
        alreadyFiled: fileBody.data.already_filed === true,
    };
}
