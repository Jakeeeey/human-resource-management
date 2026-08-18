import { Metadata } from "next";
import { ScheduleSummaryModule } from "@/modules/human-resource-management/manufacturing/schedule-summary";

export const metadata: Metadata = {
    title: "Schedule Summary | Manufacturing",
    description: "View a summary of all production schedules and operations.",
};

export default function ScheduleSummaryPage() {
    return <ScheduleSummaryModule />;
}
