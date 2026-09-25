"use client";

const SHORTCUTS: readonly { readonly keys: string; readonly action: string }[] = [
    { keys: "Delete", action: "Remove selected blocks" },
    { keys: "← → ↑ ↓", action: "Nudge selection (Shift = 10 px)" },
    { keys: "Esc", action: "Deselect all" },
    { keys: "Ctrl/⌘ + A", action: "Select every block" },
    { keys: "Ctrl/⌘ + C / V", action: "Copy and paste selection" },
    { keys: "Ctrl/⌘ + D", action: "Duplicate selection" },
    { keys: "Ctrl/⌘ + Z / Y", action: "Undo / redo" },
    { keys: "Ctrl/⌘ + S", action: "Save design" },
    { keys: "Ctrl + wheel", action: "Zoom the canvas" },
];

/**
 * First-run Help panel: keyboard map, zoom, and how sending works. The rail
 * entry is the discoverability home for shortcuts that have no visible
 * control (Escape, Ctrl+A, copy/paste).
 */
export function HelpPanel() {
    return (
        <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
            <div className="flex h-11 shrink-0 items-center border-b px-4">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Help
                </span>
            </div>

            <div className="flex flex-col gap-5 overflow-y-auto p-4">
                <section className="flex flex-col gap-2">
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Getting started
                    </h3>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Add blocks from Elements, arrange them on the 600 px
                        artboard, then Preview to see the receiver view before
                        you Send test.
                    </p>
                </section>

                <section className="flex flex-col gap-2">
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Shortcuts
                    </h3>
                    <dl className="flex flex-col gap-1.5">
                        {SHORTCUTS.map(({ keys, action }) => (
                            <div className="flex items-baseline justify-between gap-2" key={keys}>
                                <dt className="shrink-0 font-mono text-[10px] text-foreground">
                                    {keys}
                                </dt>
                                <dd className="text-right text-[11px] leading-snug text-muted-foreground">
                                    {action}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>

                <section className="flex flex-col gap-2">
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        How sending works
                    </h3>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Send test compiles the live canvas — unsaved edits
                        included — and sends it through the configured mail
                        provider to one recipient. Delivery status lands in
                        Outbox; a failed row keeps its reason code there.
                    </p>
                </section>
            </div>
        </aside>
    );
}
