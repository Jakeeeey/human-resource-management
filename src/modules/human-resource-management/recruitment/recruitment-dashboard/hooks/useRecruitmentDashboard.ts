"use client";

import * as React from "react";
import type { RecruitmentDashboardData } from "../types";

type DashboardState = {
    readonly data: RecruitmentDashboardData | null;
    readonly isLoading: boolean;
    readonly isError: boolean;
    readonly errorMessage: string | null;
    readonly reload: () => void;
};

export function useRecruitmentDashboard(): DashboardState {
    const [data, setData] = React.useState<RecruitmentDashboardData | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const [nonce, setNonce] = React.useState(0);

    React.useEffect(() => {
        let active = true;
        setIsLoading(true);
        setErrorMessage(null);
        fetch("/api/hrm/recruitment-dashboard", { cache: "no-store" })
            .then((res) => {
                if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
                return res.json() as Promise<{ data?: RecruitmentDashboardData }>;
            })
            .then((body) => {
                if (!active) return;
                if (!body.data) throw new Error("Dashboard payload was empty");
                setData(body.data);
            })
            .catch((error: unknown) => {
                if (!active) return;
                setErrorMessage(error instanceof Error ? error.message : "Unknown error");
            })
            .finally(() => {
                if (active) setIsLoading(false);
            });
        return () => {
            active = false;
        };
    }, [nonce]);

    const reload = React.useCallback(() => setNonce((n) => n + 1), []);

    return { data, isLoading, isError: errorMessage !== null, errorMessage, reload };
}
