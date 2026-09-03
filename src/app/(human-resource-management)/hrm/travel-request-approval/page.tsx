import React from "react";
import TravelRequestApprovalPage from "@/modules/human-resource-management/travel-request-approval/TravelRequestApprovalPage";
import { TravelRequestApprovalProvider } from "@/modules/human-resource-management/travel-request-approval/providers/TravelRequestApprovalProvider";

export const metadata = {
  title: "Travel Request Approvals | HR System",
  description: "Approve or reject employee travel requests.",
};

export default function Page() {
  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Travel Requests</h1>
        <p className="text-muted-foreground mt-1">Review and manage employee travel requests from the Employee Relations system.</p>
      </div>
      <TravelRequestApprovalProvider>
        <TravelRequestApprovalPage />
      </TravelRequestApprovalProvider>
    </div>
  );
}
