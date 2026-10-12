import type { ClearanceDocumentKey } from "../types";

export type ClearanceHubTab = "overview" | "form" | "soa" | "quit-claims";

export function parseClearanceHubTab(raw: string | null): ClearanceHubTab {
    if (raw === "form" || raw === "soa" || raw === "quit-claims") {
        return raw;
    }
    return "overview";
}

export function clearanceHubTabForDocument(key: ClearanceDocumentKey): Exclude<ClearanceHubTab, "overview"> {
    if (key === "soa") {
        return "soa";
    }
    if (key === "quit_claim") {
        return "quit-claims";
    }
    return "form";
}

export function clearanceHubTabHref(tab: ClearanceHubTab, requestId?: number, print?: boolean): string {
    if (requestId === undefined) {
        return "/hrm/clearance/hub";
    }
    const params = new URLSearchParams();
    params.set("request", String(requestId));
    if (tab !== "overview") {
        params.set("tab", tab);
    }
    if (print === true) {
        params.set("print", "1");
    }
    return `/hrm/clearance/hub/${requestId}?${params.toString()}`;
}
