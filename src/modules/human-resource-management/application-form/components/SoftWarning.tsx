// A non-blocking hint line -- never wired into react-hook-form's error state,
// never prevents submit. Renders nothing when there's nothing to say.

export function SoftWarning({ message }: { message: string | null }) {
    if (!message) return null;
    return <p className="text-xs text-amber-600 dark:text-amber-500">{message}</p>;
}
