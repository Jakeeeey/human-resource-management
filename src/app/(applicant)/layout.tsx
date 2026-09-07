import * as React from "react";

export default function ApplicantLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-dvh bg-background text-foreground">{children}</div>
    );
}
