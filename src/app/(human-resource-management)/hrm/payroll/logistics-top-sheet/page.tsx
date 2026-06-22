import { LogisticsTopSheetModule } from "@/modules/human-resource-management/payroll/logistics-top-sheet/LogisticsTopSheetModule";

export const metadata = {
    title: "Logistics Payroll Top Sheet | HRM",
    description: "Generate and view top sheet report for logistics staff",
};

export default function LogisticsTopSheetPage() {
    return <LogisticsTopSheetModule />;
}
