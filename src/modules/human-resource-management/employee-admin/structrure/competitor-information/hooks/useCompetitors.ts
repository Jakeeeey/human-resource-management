"use client";

import { useCompetitorFetchContext } from "../providers/fetchProvider";

export function useCompetitors() {
    return useCompetitorFetchContext();
}
