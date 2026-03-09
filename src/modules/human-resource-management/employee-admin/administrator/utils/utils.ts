import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"
import { toast } from "sonner"

/**
 * Global cn utility wrapper or local definition
 * Note: Importing from @/lib/utils if available is better, but since the user asked to FIX it here,
 * we can provide a self-contained version for the module.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Returns the current Manila time as an ISO string (naive, no offset).
 * This ensures literal storage of Manila time in the database.
 */
export function getManilaTimeISO(): string {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const findPart = (type: string) => parts.find((p) => p.type === type)?.value;

    const year = findPart("year");
    const month = findPart("month");
    const day = findPart("day");
    const hour = findPart("hour");
    const minute = findPart("minute");
    const second = findPart("second");

    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

/**
 * Formats any date string into Manila time for display.
 */
export function formatInManilaTime(dateStr: string | null | undefined, formatStr: string = "MMM dd, yyyy • hh:mm a"): string {
    if (!dateStr) return "N/A";

    try {
        const date = new Date(dateStr);

        // Create a formatter for Manila time
        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            hour12: false,
        });

        const parts = formatter.formatToParts(date);
        const findPart = (type: string) => parts.find((p) => p.type === type)?.value;

        // Construct a new date object that represents the same calendar time as Manila time
        const year = parseInt(findPart("year") || "0");
        const month = parseInt(findPart("month") || "0") - 1;
        const day = parseInt(findPart("day") || "0");
        const hour = parseInt(findPart("hour") || "0");
        const minute = parseInt(findPart("minute") || "0");
        const second = parseInt(findPart("second") || "0");

        const manilaCalendarDate = new Date(year, month, day, hour, minute, second);
        return format(manilaCalendarDate, formatStr);
    } catch (err) {
        console.error("Error formatting Manila time:", err);
        return dateStr;
    }
}

/**
 * Standardized "Server is Down" toast notification.
 * Used when fetch/network errors occur.
 */
export function toastServerDown(error?: unknown) {
    const err = error as Error | undefined;
    const message = err?.message || "";
    const isNetworkError =
        message.toLowerCase().includes("fetch failed") ||
        message.toLowerCase().includes("network error") ||
        message.toLowerCase().includes("econnrefused") ||
        message.toLowerCase().includes("failed to fetch");

    if (isNetworkError || !message) {
        toast.error("Server is down", {
            description: "Please contact Administrator.",
        });
    } else {
        toast.error("An error occurred", {
            description: message,
        });
    }
}

/**
 * Constructs a full Directus asset URL from a file ID/UUID.
 * Uses NEXT_PUBLIC_API_BASE_URL from environment variables.
 */
export function getDirectusAssetUrl(fileId: string | null | undefined): string {
    if (!fileId) return "";

    // If it's already a full URL (legacy or external), return it as is
    if (fileId.startsWith("http")) return fileId;

    const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    return `${DIRECTUS_URL}/assets/${fileId}`;
}
