"use client";

import { useCallback, useState } from "react";

import {
    postManualSend,
    type MsManualSendInput,
    type MsSendOutcome,
} from "../providers/msSend";

export interface UseMsSendResult {
    data: MsSendOutcome | null;
    isLoading: boolean;
    error: string | null;
    sendManual: (input: MsManualSendInput) => Promise<MsSendOutcome | null>;
}

export function useMsSend(): UseMsSendResult {
    const [data, setData] = useState<MsSendOutcome | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sendManual = useCallback(async (input: MsManualSendInput): Promise<MsSendOutcome | null> => {
        setIsLoading(true);
        setError(null);
        try {
            const outcome = await postManualSend(input);
            setData(outcome);
            return outcome;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { data, isLoading, error, sendManual };
}
