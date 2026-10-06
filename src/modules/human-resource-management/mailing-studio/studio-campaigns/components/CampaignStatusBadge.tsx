import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { CAMPAIGN_STATUS_LABELS, type CampaignStatus } from "../types";

const TONES: Record<CampaignStatus, string> = {
    draft: "border-border bg-muted text-muted-foreground",
    scheduled: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
    queued: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    sending: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    sent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    cancelled: "border-border bg-muted text-muted-foreground",
    failed: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
    return (
        <Badge className={cn(TONES[status])} variant="outline">
            {CAMPAIGN_STATUS_LABELS[status]}
        </Badge>
    );
}
