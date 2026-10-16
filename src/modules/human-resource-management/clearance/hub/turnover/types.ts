export interface TurnoverItem {
    id: string;
    label: string;
}

export interface TurnoverSection {
    id: string;
    number: string | null;
    title: string;
    columnLabel: string;
    officers: string[];
    items: TurnoverItem[];
}

export const TURNOVER_GENERAL_FIELDS = [
    { key: "employee_name", label: "Employee Name" },
    { key: "position", label: "Position" },
    { key: "department", label: "Department" },
    { key: "effectivity_date", label: "Effectivity Date of Turnover" },
    { key: "immediate_superior", label: "Immediate Superior" },
] as const;

export const TURNOVER_CERTIFICATION_TEXT =
    "I hereby certify that all company properties, documents, records, and responsibilities under my accountability have been properly turned over and/or returned to the Company.";

export const TURNOVER_SECTIONS: TurnoverSection[] = [
    {
        id: "hr",
        number: "1",
        title: "HUMAN RESOURCES DEPARTMENT",
        columnLabel: "Returned/Completed",
        officers: ["HR Officer"],
        items: [
            { id: "hr.company_id", label: "Company ID" },
            { id: "hr.uniform", label: "Uniform / Corporate Attire" },
            { id: "hr.clearance_form", label: "Clearance Form" },
            { id: "hr.exit_interview", label: "Exit Interview" },
            { id: "hr.company_documents", label: "Company Documents" },
            { id: "hr.company_vehicle_keys", label: "Company Vehicle Keys" },
            { id: "hr.office_keys", label: "Office Keys" },
            { id: "hr.office_equipment", label: "Office Equipment" },
            { id: "hr.laptop_mobile_tablet", label: "Laptop/Mobile / Tablet / Charger & Accessories" },
            { id: "hr.staff_house_clearance", label: "Staff House Clearance" },
            { id: "hr.removal_gc_viber", label: "Removal GC Viber / Messenger" },
        ],
    },
    {
        id: "mis",
        number: "2",
        title: "MIS DEPARTMENT",
        columnLabel: "Returned/Completed",
        officers: ["MIS Officer"],
        items: [
            { id: "mis.email_deactivation", label: "Company Email Deactivation" },
            { id: "mis.system_access_removal", label: "System Access Removal" },
            { id: "mis.files_backup_transfer", label: "Files Backup / Transfer" },
            { id: "mis.other_it_assets", label: "Other IT Assets" },
        ],
    },
    {
        id: "finance",
        number: "3",
        title: "FINANCE / ACCOUNTING DEPARTMENT",
        columnLabel: "Returned/Completed",
        officers: ["Accounting Officer"],
        items: [
            { id: "finance.cash_advances", label: "Cash Advances Liquidated" },
            { id: "finance.revolving_fund", label: "Revolving Fund Settlement" },
            { id: "finance.collection_remittance", label: "Collection Remittance" },
            { id: "finance.outstanding_accountabilities", label: "Outstanding Accountabilities" },
            { id: "finance.financial_documents", label: "Financial Documents" },
            { id: "finance.official_receipts", label: "Official Receipts / Invoices" },
            { id: "finance.other_financial_obligations", label: "Other Financial Obligations" },
        ],
    },
    {
        id: "audit",
        number: "4",
        title: "AUDIT DEPARTMENT",
        columnLabel: "Returned/Completed",
        officers: ["Audit Manager"],
        items: [
            { id: "audit.audit_findings", label: "Audit Findings Cleared" },
            { id: "audit.accountability_verification", label: "Accountability Verification" },
            { id: "audit.inventory_reconciliation", label: "Inventory / Asset Reconciliation" },
            { id: "audit.required_reports", label: "Submission of Required Reports" },
            { id: "audit.pending_discrepancies", label: "Clearance of Pending Discrepancies" },
            { id: "audit.records_reviewed", label: "Company Records Reviewed" },
            { id: "audit.confidential_documents", label: "Turnover of Confidential Documents" },
            { id: "audit.other_audit_requirements", label: "Other Audit Requirements" },
        ],
    },
    {
        id: "csd",
        number: "5",
        title: "CUSTOMER SERVICE DEPARTMENT",
        columnLabel: "Returned/Completed",
        officers: ["CSD Officer"],
        items: [{ id: "csd.pending_dr", label: "Pending DR" }],
    },
    {
        id: "sales",
        number: "6",
        title: "SALES DEPARTMENT",
        columnLabel: "Returned/Completed",
        officers: ["Internal Operations Officer"],
        items: [
            { id: "sales.customer_lists", label: "Customer Lists / Database" },
            { id: "sales.sales_reports", label: "Sales Reports" },
            { id: "sales.inventory_accountability", label: "Inventory Accountability" },
            { id: "sales.collection_reports", label: "Collection Reports" },
            { id: "sales.marketing_materials", label: "Marketing Materials" },
            { id: "sales.price_lists", label: "Price Lists / Contracts" },
            { id: "sales.company_gadgets", label: "Company-issued Gadgets" },
            { id: "sales.pending_transactions", label: "Pending Transactions Endorsed" },
        ],
    },
    {
        id: "operations",
        number: "7",
        title: "OPERATIONS / WAREHOUSE DEPARTMENT",
        columnLabel: "Returned/Completed",
        officers: ["Warehouse Officer"],
        items: [
            { id: "operations.inventory_reconciliation", label: "Inventory Reconciliation" },
            { id: "operations.delivery_documents", label: "Delivery Documents" },
            { id: "operations.ppe", label: "PPE / Safety Equipment" },
            { id: "operations.pending_deliveries", label: "Pending Deliveries Endorsed" },
            { id: "operations.other_operational_assets", label: "Other Operational Assets" },
        ],
    },
    {
        id: "motorpool",
        number: null,
        title: "MOTORPOOL & LOGISTICS TURNOVER CHECKLIST",
        columnLabel: "Returned/Completed",
        officers: ["Logistics Officer", "Motorpool Officer"],
        items: [
            { id: "motorpool.vehicle_returned", label: "Company Vehicle Returned" },
            { id: "motorpool.vehicle_keys", label: "Vehicle Keys Surrendered" },
            { id: "motorpool.spare_keys", label: "Spare Keys Returned" },
            { id: "motorpool.orcr", label: "OR/CR Submitted" },
            { id: "motorpool.fuel_card", label: "Fuel Card Returned" },
            { id: "motorpool.vehicle_manual", label: "Vehicle Manual Submitted" },
            { id: "motorpool.maintenance_records", label: "Preventive Maintenance Records Submitted" },
            { id: "motorpool.tools_tire_jack", label: "Tools and Tire Jack Returned" },
            { id: "motorpool.spare_tire", label: "Spare Tire Verified" },
            { id: "motorpool.ewd", label: "Early Warning Device (EWD) Returned" },
            { id: "motorpool.accessories_complete", label: "Vehicle Accessories Complete" },
            { id: "motorpool.condition_inspected", label: "Vehicle Condition Inspected" },
            { id: "motorpool.damages_documented", label: "Existing Damages Documented" },
            { id: "motorpool.traffic_violations", label: "Traffic Violations Cleared" },
            { id: "motorpool.accident_report", label: "Accident / Damage Report Submitted" },
            { id: "motorpool.other_motorpool", label: "Other Motorpool Accountabilities Cleared" },
        ],
    },
    {
        id: "superior",
        number: "8",
        title: "IMMEDIATE SUPERIOR ENDORSEMENT",
        columnLabel: "Completed",
        officers: ["Immediate Superior"],
        items: [
            { id: "superior.pending_tasks", label: "Pending Tasks Endorsed" },
            { id: "superior.reports_submitted", label: "Reports Submitted" },
            { id: "superior.company_files", label: "Company Files Turned Over" },
            { id: "superior.client_supplier", label: "Client / Supplier Endorsement" },
            { id: "superior.team_handover", label: "Team Handover Conducted" },
        ],
    },
];

export const TURNOVER_TOTAL_ITEMS: number = TURNOVER_SECTIONS.reduce(
    (total, section) => total + section.items.length,
    0
);

export interface TurnoverItemValue {
    done: boolean;
    remarks: string;
}

export interface TurnoverGeneral {
    employee_name: string;
    position: string;
    department: string;
    effectivity_date: string;
    immediate_superior: string;
}

export interface TurnoverCertification {
    employee_name: string;
    date: string;
}

export interface TurnoverData {
    general: TurnoverGeneral;
    items: Record<string, TurnoverItemValue>;
    officers: Record<string, string>;
    certification: TurnoverCertification;
}

export type TurnoverStatus = "pending" | "approved";

export interface ClearanceTurnoverRow {
    id: number;
    request_id: number;
    status: TurnoverStatus;
    ref_no: string | null;
    pdf_file: string | null;
    data: TurnoverData;
    approved_at: string | null;
    approved_by: number | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface TurnoverPrintInput {
    data: TurnoverData;
    refNo: string | null;
    requestId: number;
    employeeName: string | null;
    companyName: string | null;
    company_address?: string | null;
    company_contact?: string | null;
    company_email?: string | null;
    logoDataUrl: string | null;
}

export function turnoverOfficerKey(sectionId: string, index: number): string {
    return `${sectionId}.${index}`;
}

export function createEmptyTurnoverData(): TurnoverData {
    const items: Record<string, TurnoverItemValue> = {};
    for (const section of TURNOVER_SECTIONS) {
        for (const item of section.items) {
            items[item.id] = { done: false, remarks: "" };
        }
    }
    const officers: Record<string, string> = {};
    for (const section of TURNOVER_SECTIONS) {
        for (let index = 0; index < section.officers.length; index += 1) {
            officers[turnoverOfficerKey(section.id, index)] = "";
        }
    }
    return {
        general: {
            employee_name: "",
            position: "",
            department: "",
            effectivity_date: "",
            immediate_superior: "",
        },
        items,
        officers,
        certification: { employee_name: "", date: "" },
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function toText(value: unknown): string {
    return typeof value === "string" ? value : "";
}

export function normalizeTurnoverData(raw: unknown): TurnoverData {
    const empty = createEmptyTurnoverData();
    const source = typeof raw === "string" ? safeParse(raw) : raw;
    if (!isRecord(source)) return empty;

    const general = isRecord(source.general) ? source.general : {};
    for (const field of TURNOVER_GENERAL_FIELDS) {
        empty.general[field.key] = toText(general[field.key]);
    }

    const items = isRecord(source.items) ? source.items : {};
    for (const section of TURNOVER_SECTIONS) {
        for (const item of section.items) {
            const entry = items[item.id];
            if (!isRecord(entry)) continue;
            empty.items[item.id] = { done: entry.done === true, remarks: toText(entry.remarks) };
        }
    }

    const officers = isRecord(source.officers) ? source.officers : {};
    for (const section of TURNOVER_SECTIONS) {
        for (let index = 0; index < section.officers.length; index += 1) {
            const key = turnoverOfficerKey(section.id, index);
            empty.officers[key] = toText(officers[key]);
        }
    }

    const certification = isRecord(source.certification) ? source.certification : {};
    empty.certification.employee_name = toText(certification.employee_name);
    empty.certification.date = toText(certification.date);
    return empty;
}

function safeParse(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

export function countTurnoverDone(data: TurnoverData): number {
    let done = 0;
    for (const section of TURNOVER_SECTIONS) {
        for (const item of section.items) {
            if (data.items[item.id]?.done === true) done += 1;
        }
    }
    return done;
}

export function countSectionDone(section: TurnoverSection, data: TurnoverData): number {
    let done = 0;
    for (const item of section.items) {
        if (data.items[item.id]?.done === true) done += 1;
    }
    return done;
}
