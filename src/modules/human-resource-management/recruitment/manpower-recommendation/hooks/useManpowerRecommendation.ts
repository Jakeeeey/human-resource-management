import { useState, useMemo } from "react";
import { useManpowerRecommendationContext } from "../providers/ManpowerRecommendationProvider";
import { ManpowerRecommendation } from "../types";

/**
 * Thin context wrapper adding client-side search and view handling.
 *
 * Search joins display names from context (openRequests → request_no + position,
 * applicants → full_name) via Map lookups and matches the query against the
 * joined text plus status. Never filters the junction type by request_no /
 * position / full_name directly — those fields exist only on the joined
 * lookup arrays, not on ManpowerRecommendation (FKs only).
 */
export function useManpowerRecommendation() {
    const context = useManpowerRecommendationContext();
    const [searchQuery, setSearchQuery] = useState("");

    const handleView = (recommendation: ManpowerRecommendation) => {
        context.setSelectedRecommendation(recommendation);
        context.setIsViewOpen(true);
    };

    const filteredRecommendations = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return context.recommendations;
        const requestMap = new Map(
            context.openRequests.map((request) => [request.id, `${request.request_no} ${request.position}`]),
        );
        const applicantMap = new Map(
            context.applicants.map((applicant) => [applicant.id, applicant.full_name]),
        );
        return context.recommendations.filter((recommendation) => {
            const joined = `${requestMap.get(recommendation.manpower_request_id) ?? ""} ${applicantMap.get(recommendation.applicant_id) ?? ""} ${recommendation.status}`.toLowerCase();
            return joined.includes(query);
        });
    }, [context.recommendations, context.openRequests, context.applicants, searchQuery]);

    return {
        ...context,
        searchQuery,
        setSearchQuery,
        handleView,
        filteredRecommendations,
    };
}
