interface CampaignVariablesNoticeProps {
    readonly variables: readonly string[];
}

export function CampaignVariablesNotice({ variables }: CampaignVariablesNoticeProps) {
    if (variables.length === 0) return null;
    return (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5" role="status">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                Heads up — this template uses variables.
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-amber-700/90 dark:text-amber-400/90">
                {variables.map((name) => `{{${name}}}`).join(", ")} will be sent blank in bulk mail, so the email will
                show a gap where the value would normally appear. That’s fine if it’s intentional.
            </p>
        </div>
    );
}
