"use client";

import { useCallback, useState } from "react";

import {
    fetchApplicantEmail,
    postManualSend,
    postSendNow,
    type MsManualSendInput,
    type MsSendNowInput,
    type MsSendOutcome,
} from "../providers/msSend";

export interface UseMsSendResult {
    /** Last dispatch outcome ({ ok, reason?, status }) — null until a send. */
    data: MsSendOutcome | null;
    isLoading: boolean;
    error: string | null;
    sendManual: (input: MsManualSendInput) => Promise<MsSendOutcome | null>;
    sendNow: (input: MsSendNowInput) => Promise<MsSendOutcome | null>;
    lookupApplicantEmail: (applicationId: string) => Promise<string | null>;
}

/**
 * Action hook for the Send tab via the real manual-send / send-now /
 * applicant-email routes. Action-style (no list to refetch): data holds the
 * last outcome, isLoading covers the in-flight send, error the last failure.
 * @returns { data, isLoading, error } plus sendManual/sendNow/lookup actions.
 */
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

    const sendNow = useCallback(async (input: MsSendNowInput): Promise<MsSendOutcome | null> => {
        setIsLoading(true);
        setError(null);
        try {
            const outcome = await postSendNow(input);
            setData(outcome);
            return outcome;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const lookupApplicantEmail = useCallback(async (applicationId: string): Promise<string | null> => {
        setError(null);
        try {
            return await fetchApplicantEmail(applicationId);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
            return null;
        }
    }, []);

    return { data, isLoading, error, sendManual, sendNow, lookupApplicantEmail };
}
