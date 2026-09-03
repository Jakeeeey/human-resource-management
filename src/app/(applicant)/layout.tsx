import * as React from "react";

/**
 * Chrome-less shell for the walk-in applicant flow (application form -> quiz).
 *
 * Renders with NO sidebar / header / subsystem nav so an applicant handed the
 * tablet can't wander into HR functions. It is NOT a security boundary (the
 * routes run inside the HR operator's authenticated session, same origin) --
 * real lockdown is the tablet's OS kiosk mode. See
 * playbook-erp-human-resource-management-architecture.md sec 19.
 *
 * The root layout still supplies <html>/theme/<Toaster>.
 */
export default function ApplicantLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-dvh bg-background text-foreground">{children}</div>
    );
}
