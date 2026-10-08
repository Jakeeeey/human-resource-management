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

export const APPROVED_QUITCLAIM_FROZEN_CODE = "CLEARANCE_QUITCLAIM_FROZEN";

export interface FreezeApprovedQuitClaimPdfInput {
    documentId: number;
    bytes: Uint8Array;
    fileName: string;
}

export interface FreezeApprovedQuitClaimPdfResult {
    fileId: string;
    recordId: number;
    alreadyFiled: boolean;
}

export async function freezeApprovedQuitClaimPdf(
    input: FreezeApprovedQuitClaimPdfInput
): Promise<FreezeApprovedQuitClaimPdfResult> {
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
    const attachRes = await fetch(`/api/hrm/clearance/quit-claims/${input.documentId}/attach-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_file_id: fileId }),
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
    return {
        fileId,
        recordId,
        alreadyFiled: fileBody.data.already_filed === true,
    };
}
