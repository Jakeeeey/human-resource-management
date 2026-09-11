import { APPLICANT_STATUS_ERROR_CODES } from "@/modules/human-resource-management/shared/services/applicant-status-service";

type StatusAction = "recommend" | "close";

/**
 * Maps the single-writer status service's coded errors to HR-readable copy
 * (S4 finding #3: raw `quiz_completed -> recommended` transition text leaked
 * into toasts). The original error still reaches the server log.
 * @param error - Error thrown by `setApplicantStatus` (or any thrown value).
 * @param action - Module action that attempted the status write.
 * @returns Human copy, or null when the error is not a status-service error.
 */
export function humanizeApplicantStatusError(error: unknown, action: StatusAction): string | null {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (!message) return null;
    const mentions = (code: string) => message.includes(code);

    if (mentions(APPLICANT_STATUS_ERROR_CODES.transitionNotAllowed)) {
        return action === "recommend"
            ? "This applicant can't be recommended yet. Their initial interview must be graded Passed first."
            : "This applicant's hiring pipeline has already ended, so this recommendation can't be moved to that status.";
    }
    if (mentions(APPLICANT_STATUS_ERROR_CODES.invalidInput)) {
        return "The applicant reference is invalid. Refresh the page and try again.";
    }
    if (mentions(APPLICANT_STATUS_ERROR_CODES.unknownCurrent) || mentions(APPLICANT_STATUS_ERROR_CODES.readFailed)) {
        return "The applicant's current pipeline status couldn't be read. Refresh the page and try again.";
    }
    if (mentions(APPLICANT_STATUS_ERROR_CODES.writeFailed)) {
        return "The applicant's pipeline status couldn't be saved. Please try again.";
    }
    return null;
}
