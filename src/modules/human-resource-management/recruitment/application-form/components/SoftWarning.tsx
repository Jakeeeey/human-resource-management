import { AlertTriangle } from "lucide-react";

export function SoftWarning({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <p
            role="status"
            aria-live="polite"
            className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500"
        >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Heads up: {message}</span>
        </p>
    );
}
