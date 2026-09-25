import { msPost } from "./msApi";

export interface MsSendOutcome {
    ok: boolean;
    reason?: string;
    status?: string;
    idempotency_key?: string;
    customized?: boolean;
}

export interface MsManualSendInput {
    template_id: string | number;
    to_email: string;
    subject?: string;
    body_html?: string;
}

export async function postManualSend(input: MsManualSendInput): Promise<MsSendOutcome> {
    const data = await msPost<MsSendOutcome>(`/studio-send/manual-send`, input);
    if (!data) throw new Error("Manual send returned no outcome.");
    return data;
}
