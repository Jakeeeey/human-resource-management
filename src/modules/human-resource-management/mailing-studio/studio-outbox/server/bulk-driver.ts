import { msLogRedacted } from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/services/mail-transport";
import { promoteDueScheduledCampaigns } from "@/modules/human-resource-management/mailing-studio/studio-campaigns/server/campaignService";

import { MS_BULK_DRAIN_BATCH_SIZE, runBulkDrain } from "./bulk-drain-service";

const TICK_MS = 30000;
const STARTUP_DELAY_MS = 5000;
const PROMOTE_LIMIT = 20;
const DRIVER_FLAG = "__msBulkDriverStarted";

let inFlight = false;

async function tick(): Promise<void> {
    if (inFlight) return;
    inFlight = true;
    try {
        try {
            await promoteDueScheduledCampaigns(PROMOTE_LIMIT);
        } catch (error) {
            msLogRedacted("[ms-bulk-driver] promote failed:", error);
        }
        try {
            await runBulkDrain(MS_BULK_DRAIN_BATCH_SIZE, {
                publicBaseUrl: (process.env.MAIL_PUBLIC_BASE_URL ?? "").trim(),
            });
        } catch (error) {
            msLogRedacted("[ms-bulk-driver] drain failed:", error);
        }
    } finally {
        inFlight = false;
    }
}

export function ensureBulkDriver(): void {
    const state = globalThis as unknown as Record<string, unknown>;
    if (state[DRIVER_FLAG] === true) return;
    state[DRIVER_FLAG] = true;
    const steady = setInterval(() => {
        void tick();
    }, TICK_MS);
    (steady as unknown as NodeJS.Timeout).unref?.();
    const first = setTimeout(() => {
        void tick();
    }, STARTUP_DELAY_MS);
    (first as unknown as NodeJS.Timeout).unref?.();
}
