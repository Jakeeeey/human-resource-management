import { useManpowerRecommendationContext } from "../providers/ManpowerRecommendationProvider";
import { ManpowerRecommendation } from "../types";

/**
 * Thin context wrapper exposing recommendation view handling.
 *
 * S4 finding #6: the unused client-side recommendation search was removed —
 * the page renders REQUESTS (recommendations live inside each request's detail
 * dialog), so a `filteredRecommendations` list had no consumer.
 */
export function useManpowerRecommendation() {
    const context = useManpowerRecommendationContext();

    const handleView = (recommendation: ManpowerRecommendation) => {
        context.setSelectedRecommendation(recommendation);
        context.setIsViewOpen(true);
    };

    return {
        ...context,
        handleView,
    };
}
