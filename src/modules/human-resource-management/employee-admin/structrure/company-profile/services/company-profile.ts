import { CompanyProfile } from "../types/company-profile.schema";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const headers = {
    Authorization: `Bearer ${STATIC_TOKEN}`,
    "Content-Type": "application/json",
};

/**
 * Company Profile Service
 * Handles interaction with Directus API for company information.
 */
export const companyProfileService = {
    /**
     * Fetches the company profile.
     * Assuming there's only one company record or we fetch by ID.
     * Based on the user's provided API response, it's an array item.
     */
    async fetchProfile(): Promise<CompanyProfile | null> {
        try {
            const url = `${API_BASE_URL}/items/company`;
            const response = await fetch(url, { headers });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [${url}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            const data = result.data;

            if (Array.isArray(data) && data.length > 0) {
                return data[0] as CompanyProfile;
            } else if (data && !Array.isArray(data)) {
                return data as CompanyProfile;
            }

            return null;
        } catch (e) {
            const error = e as Error;
            console.error("Error fetching company profile:", error);
            throw new Error("INTERNAL_FAIL: Failed to fetch company profile");
        }
    },

    /**
     * Updates the company profile.
     */
    async updateProfile(id: number, profile: Partial<CompanyProfile>): Promise<CompanyProfile> {
        try {
            const response = await fetch(`${API_BASE_URL}/items/company/${id}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify(profile),
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                console.error("Directus PATCH Error:", errorBody);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.data as CompanyProfile;
        } catch (e) {
            const error = e as Error;
            console.error("Error updating company profile:", error);
            throw new Error("VALIDATION_FAILED: Failed to update company profile");
        }
    },
};
