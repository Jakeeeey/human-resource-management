export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { ensureBulkDriver } = await import(
            "@/modules/human-resource-management/mailing-studio/studio-outbox/server/bulk-driver"
        );
        ensureBulkDriver();
    }
}
