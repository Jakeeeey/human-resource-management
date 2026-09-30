export interface PreEmploymentTrainingFormData {
    applicantName: string;
    applicantAddress: string;
    salutationName: string;
    letterDate: string;
    position: string;
    companyName: string;
    companyId: number | null;
    headerAddress: string;
    headerContact: string;
    headerEmail: string;
    startDate: string;
    endDate: string;
    reportingTo: string;
    allowance: string;
    scheduleText: string;
    durationText: string;
    preparedByName: string;
    preparedByTitle: string;
    notedByName: string;
    notedByTitle: string;
    approvedByName: string;
    approvedByTitle: string;
    traineeName: string;
    traineeLabel: string;
}

export const EMPTY_PRE_EMPLOYMENT_TRAINING: PreEmploymentTrainingFormData = {
    applicantName: "",
    applicantAddress: "",
    salutationName: "",
    letterDate: "",
    position: "",
    companyName: "",
    companyId: null,
    headerAddress: "",
    headerContact: "",
    headerEmail: "",
    startDate: "",
    endDate: "",
    reportingTo: "",
    allowance: "",
    scheduleText: "Monday to Saturday | 8:30 AM to 5:30 PM",
    durationText: "Two (2) weeks",
    preparedByName: "",
    preparedByTitle: "HR Officer",
    notedByName: "",
    notedByTitle: "HR Supervisor",
    approvedByName: "",
    approvedByTitle: "HR Manager",
    traineeName: "",
    traineeLabel: "Conforme:",
};

export interface PreEmploymentTrainingLetterPrefill {
    applicantName?: string;
    applicantAddress?: string;
    salutationName?: string;
    position?: string;
    companyName?: string;
    headerAddress?: string;
    headerContact?: string;
    headerEmail?: string;
    logoDataUrl?: string | null;
}

export interface GeneratedTrainingLetter {
    blob: Blob;
    fileName: string;
    url: string;
}

export interface PreEmploymentTrainingLetterFormProps {
    prefill?: PreEmploymentTrainingLetterPrefill;
    onGenerated?: (result: GeneratedTrainingLetter, fields?: PreEmploymentTrainingFormData) => void;
}
