import { z } from "zod";

/**
 * Company Profile Schema based on Directus API structure
 */
export const CompanyProfileSchema = z.object({
    company_id: z.number().optional(),
    company_name: z.string().min(1, "Company Name is required"),
    company_code: z.string().min(1, "Company Code is required"),
    company_type: z.string().nullable().optional(),
    company_address: z.string().nullable().optional(),
    company_brgy: z.string().nullable().optional(),
    company_city: z.string().nullable().optional(),
    company_province: z.string().nullable().optional(),
    company_zipCode: z.string().nullable().optional(),
    company_contact: z.string().nullable().optional(),
    company_email: z.string().email("Invalid email").nullable().optional().or(z.literal("")),
    company_outlook: z.string().nullable().optional(),
    company_gmail: z.string().nullable().optional(),
    company_facebook: z.string().nullable().optional(),
    company_website: z.string().nullable().optional(),
    company_tin: z.string().nullable().optional(),
    company_registrationNumber: z.string().nullable().optional(),
    company_dateAdmitted: z.string().nullable().optional(),
    company_logo: z.string().nullable().optional(),
    company_tags: z.string().nullable().optional(),
    company_department: z.string().nullable().optional(),
});

export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;

/**
 * Hook/State specific types can go here if needed
 */
