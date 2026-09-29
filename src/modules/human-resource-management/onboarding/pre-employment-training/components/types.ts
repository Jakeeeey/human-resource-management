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
    companyName: "Men2 Marketing Corporation",
    companyId: null,
    headerAddress: "Gonzales St. Bonuan Boquig, Dagupan City Pangasinan",
    headerContact: "(075) 658-2182",
    headerEmail: "recruit@men2corp.com",
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
