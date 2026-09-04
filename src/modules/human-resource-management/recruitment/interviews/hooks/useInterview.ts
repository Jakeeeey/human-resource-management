import { useState, useMemo, useCallback } from "react";
import { useInterviewContext } from "../providers/InterviewProvider";
import { Interview } from "../types";

/**
 * Thin context wrapper adding client-side search, view handling, and
 * rec-scoped derivation helpers for the interview grading module.
 *
 * Search joins display text from context (users → name with `User #id`
 * fallback) via Map lookups and matches the query against the joined text
 * plus stage/verdict/notes. Never filters the interview rows by joined
 * display fields directly — those fields exist only on the lookup arrays,
 * not on Interview (FKs only).
 *
 * Derivation rules (must match the T4 API, rec-scoped): a recommendation
 * leaves the pending set only when a Final interview with a graded
 * (Passed/Failed) verdict exists for that recommendation_id. Pending finals
 * stay eligible — they are awaiting the explicit verdict step.
 */
export function useInterview() {
    const context = useInterviewContext();
    const [searchQuery, setSearchQuery] = useState("");

    const handleView = (interview: Interview) => {
        context.setSelectedInterview(interview);
    };

    const userMap = useMemo(
        () => new Map(context.users.map((user) => [user.id, user.name])),
        [context.users],
    );

    const userDisplay = useCallback(
        (id: number | null | undefined) => {
            if (id == null) return "";
            return userMap.get(id) ?? userMap.get(String(id)) ?? `User #${id}`;
        },
        [userMap],
    );

    const filteredInterviews = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return context.interviews;
        return context.interviews.filter((interview) => {
            const joined = `${interview.stage} ${interview.verdict} ${interview.notes ?? ""} ${userDisplay(interview.interviewed_by ?? undefined)}`.toLowerCase();
            return joined.includes(query);
        });
    }, [context.interviews, searchQuery, userDisplay]);

    const filteredInitial = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return context.eligibleInitial;
        return context.eligibleInitial.filter((row) => {
            const joined = `${row.id} ${row.quiz_score ?? ""} ${row.latestInitialVerdict ?? ""}`.toLowerCase();
            return joined.includes(query);
        });
    }, [context.eligibleInitial, searchQuery]);

    const filteredFinal = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return context.eligibleFinal;
        return context.eligibleFinal.filter((row) => {
            const joined = `${row.id} ${row.status} ${row.latestFinalVerdict ?? ""}`.toLowerCase();
            return joined.includes(query);
        });
    }, [context.eligibleFinal, searchQuery]);

    /**
     * Latest interview for an application. The API returns rows latest-first
     * (sort=-created_at), so the first match wins.
     * @param applicationId - Application id to look up.
     * @returns Latest interview for the application, or null when never graded.
     */
    const latestPerApplication = useCallback(
        (applicationId: number): Interview | null => {
            return context.interviews.find((interview) => interview.application_id === applicationId) ?? null;
        },
        [context.interviews],
    );

    /**
     * Whether a recommendation already has a graded (Passed/Failed) Final.
     * Used by the score entry dialog for the app-level double-grade confirm.
     * @param recommendationId - Recommendation id to check.
     * @returns True when a graded Final exists for the recommendation.
     */
    const hasGradedFinal = useCallback(
        (recommendationId: number): boolean => {
            return context.interviews.some(
                (interview) =>
                    interview.stage === "Final" &&
                    interview.recommendation_id === recommendationId &&
                    interview.verdict !== "Pending",
            );
        },
        [context.interviews],
    );

    /**
     * Final-tab pending set: eligibleFinal recs with no graded final.
     * Rec-scoped — a Pending final keeps its rec eligible (awaiting verdict).
     */
    const pendingFinals = useMemo(
        () => context.eligibleFinal.filter((row) => !hasGradedFinal(row.id)),
        [context.eligibleFinal, hasGradedFinal],
    );

    return {
        ...context,
        searchQuery,
        setSearchQuery,
        handleView,
        filteredInterviews,
        filteredInitial,
        filteredFinal,
        latestPerApplication,
        pendingFinals,
        hasGradedFinal,
        userDisplay,
    };
}
