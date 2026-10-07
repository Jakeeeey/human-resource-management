"use client";

// RequestStatusPill.tsx — shared renderer for a request's EFFECTIVE status
// (utils/requestStatus.ts). Used by the open-requests list and the
// request/recommendation detail views so the same status value always renders
// with the same colour on every surface.

const STATUS_PILL_TINTS: Record<string, string> = {
    Closed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    Full: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    Open: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

export function RequestStatusPill({ status }: { status: string }) {
    const tint = STATUS_PILL_TINTS[status] ?? "bg-zinc-500/10 text-zinc-600 border-zinc-500/20";
    return (
        <span className={`inline-block w-[110px] rounded-full border px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wider ${tint}`}>
            {status}
        </span>
    );
}
