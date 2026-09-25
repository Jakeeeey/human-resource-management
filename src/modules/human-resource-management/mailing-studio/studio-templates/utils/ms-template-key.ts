export const MS_TEMPLATE_KEY_PATTERN = /^[a-z0-9._-]+$/;

export const MS_TEMPLATE_KEY_HINT =
    "Lowercase letters, numbers, dots, underscores and hyphens only (e.g. onboarding.welcome-v2).";

export function isTemplateKey(value: string): boolean {
    return MS_TEMPLATE_KEY_PATTERN.test(value);
}
