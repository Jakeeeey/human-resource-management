"use client";

import { useState } from "react";
import { CompanyProfileProvider } from "./providers/CompanyProfileProvider";
import { CompanyProfileView } from "./components/CompanyProfileView";
import { CompanyProfileForm } from "./components/CompanyProfileForm";

/**
 * Company Profile Module Page
 * Manages the transition between View and Edit modes for the company profile.
 */
export default function CompanyProfilePage() {
    const [isEditing, setIsEditing] = useState(false);

    return (
        <CompanyProfileProvider>
            <div className="max-w-7xl mx-auto px-4 py-8 md:px-8">
                {isEditing ? (
                    <CompanyProfileForm onCancel={() => setIsEditing(false)} />
                ) : (
                    <CompanyProfileView onEdit={() => setIsEditing(true)} />
                )}
            </div>
        </CompanyProfileProvider>
    );
}
