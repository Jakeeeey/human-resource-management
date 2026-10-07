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
    const params = new URLSearchParams();
    if (tab !== "overview") {
        params.set("tab", tab);
    }
    if (requestId !== undefined) {
        params.set("request", String(requestId));
    }
    if (print === true) {
        params.set("print", "1");
    }
    const query = params.toString();
    if (query === "") {
        return "/hrm/clearance/hub";
    }
    return `/hrm/clearance/hub?${query}`;
}
