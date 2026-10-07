/**
 * Returns the correctly pluralized noun for a count so UI copy never leaks
 * machine artifacts like "question(s)" / "quiz(zes)".
 *
 * @param count - The quantity the noun describes.
 * @param singular - Singular form, e.g. "question".
 * @param plural - Optional irregular plural, e.g. "quizzes". Defaults to `${singular}s`.
 * @returns The noun form matching `count`.
 */
export function pluralize(count: number, singular: string, plural?: string): string {
    if (count === 1) return singular;
    return plural ?? `${singular}s`;
}

/**
 * Returns `"is"` for a single item and `"are"` otherwise, for verb agreement
 * in count-driven sentences.
 */
export function isAre(count: number): string {
    return count === 1 ? "is" : "are";
}
