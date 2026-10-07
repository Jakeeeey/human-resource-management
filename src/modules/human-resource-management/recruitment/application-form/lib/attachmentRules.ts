export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

export const ATTACHMENT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/gif";

export const ATTACHMENT_HELP_TEXT = "Accepted formats: PDF, JPG, PNG, WEBP, GIF. Maximum size: 5 MB per file.";

export function attachmentFileError(file: { name: string; type: string; size: number }): string | null {
    if (!ATTACHMENT_ACCEPT.split(",").includes(file.type)) {
        return `"${file.name}" can't be attached. Accepted formats: PDF, JPG, PNG, WEBP, GIF.`;
    }
    if (file.size > ATTACHMENT_MAX_BYTES) {
        return `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. The maximum size is 5 MB.`;
    }
    return null;
}

export function resumeError(rows: { type: string; file: { name: string } | null }[]): string | null {
    return rows.some((r) => r.type === "Resume" && r.file)
        ? null
        : "Please attach your resume (Document Type: Resume) before submitting.";
}
