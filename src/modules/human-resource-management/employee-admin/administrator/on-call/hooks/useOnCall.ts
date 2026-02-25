"use client";

import { useOnCallContext } from "../providers/OnCallProvider";

/**
 * useOnCall Hook
 * Consumer of OnCallContext to provide shared state and actions.
 */
export function useOnCall() {
    return useOnCallContext();
}
