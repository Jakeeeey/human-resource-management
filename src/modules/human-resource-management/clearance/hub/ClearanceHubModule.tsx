"use client";

import { Suspense } from "react";
import type { JSX } from "react";

import { ClearanceHubProvider } from "./providers/ClearanceHubProvider";
import { ClearanceHubOverview } from "./components/HubOverview";

export default function ClearanceHubModule(): JSX.Element {
    return (
        <ClearanceHubProvider>
            <Suspense>
                <ClearanceHubOverview />
            </Suspense>
        </ClearanceHubProvider>
    );
}
