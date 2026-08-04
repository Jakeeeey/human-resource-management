import { Metadata } from "next";
import LogisticsPayrollPage from "@/modules/human-resource-management/payroll/logistics-payroll/LogisticsPayrollPage";

export const metadata: Metadata = {
    title: "Logistics Payroll | Human Resource Management",
    description: "Manage logistics payroll additions and cutoffs",
};

export default function Page() {
    return <LogisticsPayrollPage />;
}
