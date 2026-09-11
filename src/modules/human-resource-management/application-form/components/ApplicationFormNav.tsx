"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export const FORM_SECTIONS = [
    { id: "section-application", label: "Application" },
    { id: "section-personal", label: "Personal" },
    { id: "section-family", label: "Family" },
    { id: "section-company", label: "Company" },
    { id: "section-education", label: "Education" },
    { id: "section-licensure", label: "Licensure" },
    { id: "section-skills", label: "Skills" },
    { id: "section-work", label: "Work" },
    { id: "section-references", label: "References" },
    { id: "section-trainings", label: "Trainings" },
    { id: "section-attachments", label: "Attachments" },
    { id: "section-certification", label: "Certify" },
] as const;

// Viewport-top distance at which a section counts as "current": the sticky
// nav height (~44px) plus the `scroll-mt-28` anchor offset (112px) with slack.
const ACTIVE_TOP_OFFSET = 140;

export function ApplicationFormNav() {
    const [activeId, setActiveId] = useState<string>(FORM_SECTIONS[0].id);
    const [edges, setEdges] = useState({ left: false, right: false });
    const navRef = useRef<HTMLElement | null>(null);
    const pillRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

    // Reveal an edge fade only when there is actually content clipped off it,
    // so the hint is truthful at both ends of the scroll range.
    const syncEdges = useCallback(() => {
        const nav = navRef.current;
        if (!nav) return;
        const maxScroll = nav.scrollWidth - nav.clientWidth;
        setEdges({
            left: nav.scrollLeft > 4,
            right: maxScroll > 4 && nav.scrollLeft < maxScroll - 4,
        });
    }, []);

    useEffect(() => {
        let frame = 0;
        const updateActive = () => {
            frame = 0;
            let current: string = FORM_SECTIONS[0].id;
            for (const section of FORM_SECTIONS) {
                const el = document.getElementById(section.id);
                if (!el) continue;
                if (el.getBoundingClientRect().top <= ACTIVE_TOP_OFFSET) current = section.id;
                else break;
            }
            setActiveId(current);
        };
        const onScroll = () => {
            if (frame) return;
            frame = window.requestAnimationFrame(updateActive);
        };
        updateActive();
        syncEdges();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        window.addEventListener("resize", syncEdges);
        return () => {
            if (frame) window.cancelAnimationFrame(frame);
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            window.removeEventListener("resize", syncEdges);
        };
    }, [syncEdges]);

    // Keep the current pill revealed without nudging the page vertically.
    useEffect(() => {
        const nav = navRef.current;
        const pill = pillRefs.current[activeId];
        if (!nav || !pill) return;
        const navRect = nav.getBoundingClientRect();
        const pillRect = pill.getBoundingClientRect();
        if (pillRect.left < navRect.left + 8) {
            nav.scrollTo({
                left: nav.scrollLeft + (pillRect.left - navRect.left) - 12,
                behavior: "smooth",
            });
        } else if (pillRect.right > navRect.right - 8) {
            nav.scrollTo({
                left: nav.scrollLeft + (pillRect.right - navRect.right) + 12,
                behavior: "smooth",
            });
        }
    }, [activeId]);

    return (
        <div className="sticky top-0 z-20 -mx-6 border-b bg-background/95 backdrop-blur">
            <div className="relative">
                <nav
                    ref={navRef}
                    aria-label="Application sections"
                    onScroll={syncEdges}
                    className="flex gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    {FORM_SECTIONS.map((section) => {
                        const isActive = section.id === activeId;
                        return (
                            <a
                                key={section.id}
                                ref={(el) => {
                                    pillRefs.current[section.id] = el;
                                }}
                                href={`#${section.id}`}
                                aria-current={isActive ? "true" : undefined}
                                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                    isActive
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground"
                                }`}
                            >
                                {section.label}
                            </a>
                        );
                    })}
                </nav>
                {edges.left && (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background/95 to-transparent"
                    />
                )}
                {edges.right && (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background/95 to-transparent"
                    />
                )}
            </div>
        </div>
    );
}

export function StickySubmitBar({
    submitting,
    disabled,
}: {
    submitting: boolean;
    disabled: boolean;
}) {
    return (
        <div className="sticky bottom-0 z-20 -mx-6 -mb-6 rounded-b-xl border-t bg-background/95 px-6 py-4 backdrop-blur">
            <Button type="submit" className="w-full" disabled={disabled}>
                {submitting ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                    </>
                ) : (
                    "Submit Application"
                )}
            </Button>
        </div>
    );
}
