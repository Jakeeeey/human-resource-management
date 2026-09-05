/**
 * Fillable fields for the Job Offer Letter, matching the MEN2 Marketing
 * reference layout (letterhead + double rule + centered title + recipient
 * block + five body paragraphs + signatory block).
 * Print only: nothing is persisted.
 */
export interface JobOfferFormData {
    offerDate: string;
    candidateName: string;
    addressLine: string;
    contactNumber: string;
    salutationName: string;
    companyName: string;
    position: string;
    baseLocation: string;
    department: string;
    division: string;
    monthlySalary: string;
    dailyRate: string;
    payDays: string;
    evalMonths: string;
    probationText: string;
    signatoryName: string;
    signatoryTitle: string;
    headerAddress: string;
    headerContact: string;
    headerEmail: string;
}

export const EMPTY_JOB_OFFER: JobOfferFormData = {
    offerDate: "",
    candidateName: "",
    addressLine: "",
    contactNumber: "",
    salutationName: "",
    companyName: "Men2 Marketing & Distribution Enterprise Corporation",
    position: "",
    baseLocation: "",
    department: "",
    division: "",
    monthlySalary: "",
    dailyRate: "",
    payDays: "15th and 31st",
    evalMonths: "3rd and 5th",
    probationText: "six months (180 days)",
    signatoryName: "",
    signatoryTitle: "HR Officer",
    headerAddress: "Gonzales St. Bonuan Boquig, Dagupan City Pangasinan",
    headerContact: "(075) 658-2182",
    headerEmail: "recruit@men2corp.com",
};
