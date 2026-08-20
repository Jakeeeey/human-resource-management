import { useManpowerRequestContext } from "../providers/ManpowerRequestProvider";
import { useState } from "react";
import { ManpowerRequest } from "../types";

export function useManpowerRequest() {
    const context = useManpowerRequestContext();
    const [searchQuery, setSearchQuery] = useState("");

    const handleView = (request: ManpowerRequest) => {
        context.setSelectedRequest(request);
        context.setIsViewOpen(true);
    };

    return {
        ...context,
        searchQuery,
        setSearchQuery,
        handleView,
    };
}
