export function SoftWarning({ message }: { message: string | null }) {
    if (!message) return null;
    return <p className="text-xs text-amber-600 dark:text-amber-500">{message}</p>;
}
