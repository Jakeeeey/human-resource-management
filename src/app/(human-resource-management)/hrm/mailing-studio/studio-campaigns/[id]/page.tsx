import Link from "next/link";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NavUser } from "@/components/shared/app-sidebar/nav-user";

import { cookies } from "next/headers";

import { CampaignDetailModule } from "@/modules/human-resource-management/mailing-studio/studio-campaigns";
import { getCampaign } from "@/modules/human-resource-management/mailing-studio/studio-campaigns/server/campaignService";
import type { MsCampaignRow } from "@/modules/human-resource-management/mailing-studio/studio-campaigns/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";
const CAMPAIGNS_HREF = "/hrm/mailing-studio/studio-campaigns";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;

        const p = parts[1];
        const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);

        const json = Buffer.from(padded, "base64").toString("utf8");
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function pickString(obj: Record<string, unknown> | null, keys: string[]): string {
    for (const k of keys) {
        const v = obj?.[k];
        if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
}

function buildHeaderUserFromToken(token: string | null | undefined) {
    const payload = token ? decodeJwtPayload(token) : null;

    const first = pickString(payload, ["Firstname", "FirstName", "firstName", "firstname", "first_name"]);
    const last = pickString(payload, ["LastName", "Lastname", "lastName", "lastname", "last_name"]);
    const email = pickString(payload, ["email", "Email"]);

    const name = [first, last].filter(Boolean).join(" ") || email || "User";

    return {
        name,
        email: email || "",
        avatar: "/avatars/shadcn.jpg",
    };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
    const headerUser = buildHeaderUserFromToken(token);

    const { id: rawId } = await params;
    const id = Number(rawId);
    const valid = Number.isInteger(id) && id > 0;

    let campaign: MsCampaignRow | null = null;
    let failed = false;
    if (valid) {
        try {
            campaign = await getCampaign(id);
        } catch {
            failed = true;
        }
    }

    const crumb = campaign?.campaign_name ?? "Campaign";

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b shadow-sm bg-background sm:h-16 overflow-hidden">
                <div className="flex h-full min-w-0 items-center gap-2 px-3 sm:px-4 overflow-hidden">
                    <SidebarTrigger className="-ml-1 shrink-0" />

                    <Separator
                        orientation="vertical"
                        className="hidden sm:block mr-2 data-[orientation=vertical]:h-4 shrink-0"
                    />

                    <div className="min-w-0 overflow-hidden">
                        <Breadcrumb>
                            <BreadcrumbList className="min-w-0 overflow-hidden">
                                <BreadcrumbItem className="hidden md:block shrink-0">
                                    <BreadcrumbLink href={CAMPAIGNS_HREF}>Mailing Studio</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="hidden md:block shrink-0">
                                    <BreadcrumbLink href={CAMPAIGNS_HREF}>Campaigns</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="min-w-0 shrink-0" />
                                <BreadcrumbItem className="min-w-0 overflow-hidden">
                                    <BreadcrumbPage className="truncate max-w-[56vw] sm:max-w-[60vw] md:max-w-none">
                                        {crumb}
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </div>

                <div className="flex h-full items-center px-2 sm:px-4 shrink-0 max-w-[48vw] sm:max-w-none overflow-hidden">
                    <NavUser user={headerUser} />
                </div>
            </header>

            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4">
                {campaign ? (
                    <CampaignDetailModule campaignId={campaign.id} initialCampaign={campaign} />
                ) : (
                    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 rounded-lg border bg-card py-16 text-center">
                        <p className="text-sm text-muted-foreground">
                            {failed
                                ? "Could not load that campaign — please try again later."
                                : `No campaign found for “${rawId}”.`}
                        </p>
                        <Button size="sm" asChild>
                            <Link href={CAMPAIGNS_HREF}>Back to campaigns</Link>
                        </Button>
                    </div>
                )}
            </main>
        </div>
    );
}
