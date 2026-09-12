"use client";

import React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobOfferCombobox } from "./JobOfferCombobox";
import { FileText, Printer, Upload } from "lucide-react";
import { buildOfferPdf } from "./offerPdf";
import { EMPTY_JOB_OFFER, type JobOfferFormData } from "./types";

interface ApplicantOption {
    id: number;
    full_name: string;
    position_applied_for: string | null;
}

interface SigningEnvelopeOption {
    id: number;
    applicant_id: number;
    joboffer_id: number | null;
}

interface CompanyLogo {
    id: number;
    company_code: string;
    company_name: string;
    company_city: string | null;
    logo_data_url: string | null;
    is_default: boolean;
}

interface StructureDepartment {
    department_id: number;
    department_name: string;
}

interface StructureDivision {
    division_id: number;
    division_name: string;
    departments: StructureDepartment[];
}

function todayInputValue(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function formatLongDate(input: string): string {
    if (!input) return "________________";
    const d = new Date(`${input}T00:00:00`);
    if (Number.isNaN(d.getTime())) return input;
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatAmount(input: string): string {
    const n = Number(input.replace(/[^0-9.]/g, ""));
    if (!input.trim() || Number.isNaN(n)) return "________________";
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const blank = (v: string) => (v.trim() ? v : "________________");

function departmentDisplay(value: string): string {
    const name = value.trim();
    if (!name) return "________________";
    return /department$/i.test(name) ? name : `${name} Department`;
}

function salutationPrefix(sex: unknown, civilStatus: unknown): string | null {
    if (sex === "Male") return "Mr.";
    if (sex === "Female") return civilStatus === "Married" ? "Mrs." : "Ms.";
    return null;
}

function surnameOf(fullName: string): string {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    const last = parts.length > 0 ? parts[parts.length - 1] : "";
    return last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
}

function JobOfferContent() {
    const [form, setForm] = React.useState<JobOfferFormData>(() => ({
        ...EMPTY_JOB_OFFER,
        offerDate: todayInputValue(),
    }));
    const [applicants, setApplicants] = React.useState<ApplicantOption[]>([]);
    const [envelopes, setEnvelopes] = React.useState<SigningEnvelopeOption[]>([]);
    const [envelopesLoading, setEnvelopesLoading] = React.useState(true);
    const [selectedEnvelopeId, setSelectedEnvelopeId] = React.useState("");
    const [pdfFileId, setPdfFileId] = React.useState<string | null>(null);
    const [pdfFileName, setPdfFileName] = React.useState<string | null>(null);
    const [uploading, setUploading] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [logos, setLogos] = React.useState<CompanyLogo[]>([]);
    const [selectedLogoId, setSelectedLogoId] = React.useState<number | null>(null);
    const [logosError, setLogosError] = React.useState(false);
    const [structureDivisions, setStructureDivisions] = React.useState<StructureDivision[]>([]);
    const [structureDepartments, setStructureDepartments] = React.useState<StructureDepartment[]>([]);
    const [structureError, setStructureError] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/hrm/company-logos");
                if (!res.ok) {
                    if (!cancelled) setLogosError(true);
                    return;
                }
                const json = await res.json();
                if (cancelled) return;
                if (!Array.isArray(json.data) || json.data.length === 0) {
                    setLogosError(true);
                    return;
                }
                const rows = json.data as CompanyLogo[];
                setLogos(rows);
                const def = rows.find((r) => r.is_default) ?? rows[0];
                if (def) {
                    setSelectedLogoId(def.id);
                    setForm((f) => ({
                        ...f,
                        companyName: def.company_name,
                        baseLocation: def.company_city?.trim() ? def.company_city : f.baseLocation,
                    }));
                }
            } catch {
                // Logo picker is a convenience — the letterhead falls back
                // to the bundled MEN2 logo when the table is unreachable.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const selectedLogo = logos.find((l) => l.id === selectedLogoId) ?? null;

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/hrm/employee-admin/structure/division");
                if (!res.ok) {
                    if (!cancelled) setStructureError(true);
                    return;
                }
                const json = await res.json();
                if (cancelled) return;
                if (!Array.isArray(json.divisions) || !Array.isArray(json.departments)) {
                    setStructureError(true);
                    return;
                }
                setStructureDivisions(json.divisions as StructureDivision[]);
                setStructureDepartments(json.departments as StructureDepartment[]);
            } catch {
                if (!cancelled) setStructureError(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const loadEnvelopes = React.useCallback(async () => {
        try {
            const res = await fetch("/api/hrm/onboarding/signing-envelope?status=pending");
            if (!res.ok) return;
            const json = await res.json().catch(() => null);
            if (!Array.isArray(json?.data)) return;
            setEnvelopes(
                json.data.map((r: SigningEnvelopeOption) => ({
                    id: r.id,
                    applicant_id: r.applicant_id,
                    joboffer_id: r.joboffer_id,
                }))
            );
        } catch {
            // Envelope list is required — the save action stays disabled on failure.
        }
    }, []);

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [applicantRes, envelopeRes] = await Promise.all([
                    fetch("/api/hrm/applicants"),
                    fetch("/api/hrm/onboarding/signing-envelope?status=pending"),
                ]);
                if (applicantRes.ok) {
                    const json = await applicantRes.json().catch(() => null);
                    if (!cancelled && Array.isArray(json?.data)) {
                        setApplicants(
                            json.data.map(
                                (r: { id: number; full_name: string; position_applied_for: string | null }) => ({
                                    id: r.id,
                                    full_name: r.full_name,
                                    position_applied_for: r.position_applied_for,
                                })
                            )
                        );
                    }
                }
                if (envelopeRes.ok) {
                    const json = await envelopeRes.json().catch(() => null);
                    if (!cancelled && Array.isArray(json?.data)) {
                        setEnvelopes(
                            json.data.map((r: SigningEnvelopeOption) => ({
                                id: r.id,
                                applicant_id: r.applicant_id,
                                joboffer_id: r.joboffer_id,
                            }))
                        );
                    }
                }
            } finally {
                if (!cancelled) setEnvelopesLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const set = (key: keyof JobOfferFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value }));

    const selectedDepartmentId =
        structureDepartments.find((d) => d.department_name === form.department)?.department_id ?? null;
    const divisionOptions =
        selectedDepartmentId === null
            ? []
            : structureDivisions.filter((div) => div.departments.some((d) => d.department_id === selectedDepartmentId));

    let divisionPlaceholder = "Pick a division";
    if (selectedDepartmentId === null) divisionPlaceholder = "Select a department first";
    else if (divisionOptions.length === 0) divisionPlaceholder = "No divisions linked to this department";
    const divisionDisabled = selectedDepartmentId === null || divisionOptions.length === 0;

    const handleCompanyPick = (v: string) => {
        const id = Number(v);
        setSelectedLogoId(id);
        const row = logos.find((l) => l.id === id);
        if (row)
            setForm((f) => ({
                ...f,
                companyName: row.company_name,
                baseLocation: row.company_city?.trim() ? row.company_city : f.baseLocation,
            }));
    };

    const handleDepartmentPick = (name: string) => {        setForm((f) => {
            const deptId = structureDepartments.find((d) => d.department_name === name)?.department_id ?? null;
            const divisionStillValid =
                deptId !== null &&
                structureDivisions.some(
                    (div) => div.division_name === f.division && div.departments.some((d) => d.department_id === deptId)
                );
            return { ...f, department: name, division: divisionStillValid ? f.division : "" };
        });
    };

    const handleEnvelopePick = (value: string) => {
        const envelope = envelopes.find((e) => String(e.id) === value);
        if (!envelope) return;
        setSelectedEnvelopeId(value);
        const applicant = applicants.find((a) => a.id === envelope.applicant_id);
        setForm((f) => ({
            ...f,
            candidateName: applicant?.full_name ?? f.candidateName,
            position: applicant?.position_applied_for ?? f.position,
        }));
        // Autofill address/contact/salutation from the applicant's latest
        // application record and department/division from their committed
        // manpower request; every field stays editable and is untouched
        // when the application is unreachable.
        void (async () => {
            try {
                const res = await fetch(
                    `/api/hrm/applications/by-applicant?applicant_id=${envelope.applicant_id}`
                );
                if (!res.ok) return;
                const json = await res.json().catch(() => null);
                const application = json?.data?.application;
                if (!application) return;
                const committed = json?.data?.committed_request;
                const committedDepartment =
                    typeof committed?.department_name === "string" && committed.department_name.trim()
                        ? committed.department_name
                        : null;
                const committedDivision =
                    typeof committed?.division_name === "string" && committed.division_name.trim()
                        ? committed.division_name
                        : null;
                const prefix = salutationPrefix(application.sex, application.civil_status);
                const surname = surnameOf(applicant?.full_name ?? "");
                setForm((f) => ({
                    ...f,
                    addressLine:
                        typeof application.address === "string" && application.address.trim()
                            ? application.address
                            : f.addressLine,
                    contactNumber:
                        typeof application.phone === "string" && application.phone.trim()
                            ? application.phone
                            : f.contactNumber,
                    salutationName: prefix
                        ? surname
                            ? `${prefix} ${surname}`
                            : prefix
                        : f.salutationName,
                    department: committedDepartment ?? f.department,
                    division: committedDivision ?? f.division,
                }));
            } catch {
                // Autofill is a convenience — the fields stay manual on failure.
            }
        })();
    };

    const generateAndUploadOfferPdf = async (): Promise<string | null> => {
        setUploading(true);
        try {
            const blob = buildOfferPdf(form, selectedLogo?.logo_data_url ?? null);
            const candidateName = form.candidateName.trim() || "Candidate";
            const file = new File([blob], `Job-Offer-${candidateName}.pdf`, {
                type: "application/pdf",
            });
            const body = new FormData();
            body.append("file", file);
            const res = await fetch("/api/hrm/onboarding/job-offer/upload", {
                method: "POST",
                body,
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || typeof json?.data?.id !== "string") {
                toast.error(typeof json?.message === "string" ? json.message : "Upload failed");
                return null;
            }
            setPdfFileId(json.data.id);
            setPdfFileName(file.name);
            toast.success("Offer PDF uploaded");
            return json.data.id as string;
        } catch {
            toast.error("Failed to generate offer PDF");
            return null;
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async (pdfFileIdArg?: string) => {
        const envelope = envelopes.find((e) => String(e.id) === selectedEnvelopeId);
        if (!envelope) return;
        const id = pdfFileIdArg ?? pdfFileId;
        if (!id) return;
        setSaving(true);
        try {
            const res =
                envelope.joboffer_id !== null
                    ? await fetch(`/api/hrm/onboarding/job-offer/${envelope.joboffer_id}/offer`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                              pdf_file: id,
                              terms_snapshot: form,
                              status: "sent",
                              signing_envelope_id: envelope.id,
                          }),
                      })
                    : await fetch("/api/hrm/onboarding/job-offer", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                              applicant_id: envelope.applicant_id,
                              signing_envelope_id: envelope.id,
                              pdf_file: id,
                              terms_snapshot: form,
                              status: "sent",
                          }),
                      });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                toast.error(typeof json?.message === "string" ? json.message : "Failed to save job offer");
                return;
            }
            toast.success("Job offer saved");
            setPdfFileId(null);
            setPdfFileName(null);
            await loadEnvelopes();
        } catch {
            toast.error("Failed to save job offer");
        } finally {
            setSaving(false);
        }
    };

    const handleUploadOfferPdf = async () => {
        const envelope = envelopes.find((e) => String(e.id) === selectedEnvelopeId);
        if (!envelope) {
            toast.error("Select an open envelope first");
            return;
        }
        const id = await generateAndUploadOfferPdf();
        if (id) await handleSave(id);
    };

    const handlePrint = () => window.print();

    const envelopeOptions = envelopes.map((e) => {
        const applicant = applicants.find((a) => a.id === e.applicant_id);
        if (!applicant) return { value: String(e.id), label: `Applicant #${e.applicant_id}` };
        const label = applicant.position_applied_for
            ? `${applicant.full_name} — ${applicant.position_applied_for}`
            : applicant.full_name;
        return { value: String(e.id), label };
    });

    const field = "w-full";
    const label = "text-sm font-medium mb-1 block";
    const section = "text-xs font-bold uppercase tracking-wider text-muted-foreground pt-2";

    return (
        <div className="p-2 sm:p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen space-y-8">
            <style>{`@media print {
                @page { margin: 8mm 10mm 10mm 10mm; }
                body * { visibility: hidden; }
                #job-offer-print, #job-offer-print * { visibility: visible; }
                #job-offer-print { position: absolute; left: 0; top: 0; width: 100%; margin: 0; box-shadow: none !important; border: none !important; border-radius: 0 !important; }
            }`}</style>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-2xl shadow-sm border border-primary/20">
                        <FileText className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                            Job Offer
                        </h1>
                        <p className="text-muted-foreground/80 font-medium mt-1 text-base sm:text-lg">
                            Fill in the offer details
                        </p>
                    </div>
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-auto sm:items-end">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button onClick={handlePrint} className="w-full sm:w-auto" type="button">
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                        </Button>
                        <Button
                            onClick={() => void handleUploadOfferPdf()}
                            variant="outline"
                            className="w-full sm:w-auto bg-green-600 text-white hover:bg-green-700"
                            type="button"
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            {uploading ? "Uploading…" : saving ? "Saving…" : "Upload"}
                        </Button>
                    </div>
                    {pdfFileName ? (
                        <p
                            className="text-xs text-muted-foreground truncate max-w-full sm:max-w-[260px]"
                            title={pdfFileName}
                        >
                            {pdfFileName}
                        </p>
                    ) : null}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[400px_1fr] items-start">
                <div className="bg-card shadow-sm border rounded-xl p-6 space-y-4">
                    <div>
                        <span className={label}>Open signing envelope</span>
                        <JobOfferCombobox
                            options={envelopeOptions}
                            value={selectedEnvelopeId}
                            onValueChange={handleEnvelopePick}
                            placeholder={envelopesLoading ? "Loading envelopes..." : "Select open envelope"}
                            disabled={envelopesLoading}
                        />
                    </div>

                    <p className={section}>Recipient</p>
                    <div>
                        <span className={label}>Candidate name</span>
                        <Input className={field} value={form.candidateName} onChange={set("candidateName")} placeholder="JOSEPH U. PANINGBATAN" />
                    </div>
                    <div>
                        <span className={label}>Address line</span>
                        <Input className={field} value={form.addressLine} onChange={set("addressLine")} placeholder="#092 Tonton West, Lingayen Pangasinan" />
                    </div>
                    <div>
                        <span className={label}>Contact number</span>
                        <Input className={field} value={form.contactNumber} onChange={set("contactNumber")} placeholder="0945-501-2640" />
                    </div>
                    <div>
                        <span className={label}>Salutation (Dear ...)</span>
                        <Input className={field} value={form.salutationName} onChange={set("salutationName")} placeholder="Mr. Paningbatan" />
                    </div>

                    <p className={section}>Offer</p>
                    <div>
                        <span className={label}>Letter date</span>
                        <Input className={field} type="date" value={form.offerDate} onChange={set("offerDate")} />
                    </div>
                    <div>
                        <span className={label}>Company</span>
                        <JobOfferCombobox
                            options={logos.map((l) => ({ value: String(l.id), label: l.company_name }))}
                            value={selectedLogoId !== null ? String(selectedLogoId) : ""}
                            onValueChange={handleCompanyPick}
                            placeholder={logosError ? "Company list unavailable — using MEN2 default" : logos.length === 0 ? "Loading companies..." : "Pick a company"}
                            disabled={logos.length === 0}
                        />
                    </div>
                    <div>
                        <span className={label}>Position</span>
                        <Input className={field} value={form.position} onChange={set("position")} placeholder="Territory Sales Manager" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className={label}>Based in</span>
                            <Input className={field} value={form.baseLocation} onChange={set("baseLocation")} placeholder="Dagupan City" />
                        </div>
                        <div>
                            <span className={label}>Department</span>
                            {structureError ? (
                                <Input className={field} value={form.department} onChange={set("department")} placeholder="Sales Department" />
                            ) : (
                                <JobOfferCombobox
                                    options={structureDepartments.map((d) => ({ value: d.department_name, label: d.department_name }))}
                                    value={form.department}
                                    onValueChange={handleDepartmentPick}
                                    placeholder={structureDepartments.length === 0 ? "Loading departments..." : "Pick a department"}
                                    disabled={structureDepartments.length === 0}
                                />
                            )}
                        </div>
                    </div>
                    <div className={!structureError && divisionDisabled ? "opacity-50" : undefined}>
                        <span className={label}>Division</span>
                        {structureError ? (
                            <Input className={field} value={form.division} onChange={set("division")} placeholder="Dry Division" />
                        ) : (
                            <JobOfferCombobox
                                options={divisionOptions.map((div) => ({ value: div.division_name, label: div.division_name }))}
                                value={form.division}
                                onValueChange={(v) => setForm((f) => ({ ...f, division: v }))}
                                placeholder={divisionPlaceholder}
                                disabled={divisionDisabled}
                            />
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className={label}>Monthly salary (₱)</span>
                            <Input
                                className={field}
                                inputMode="decimal"
                                value={form.monthlySalary}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, monthlySalary: e.target.value.replace(/[^0-9.]/g, "") }))
                                }
                                placeholder="25000"
                            />
                        </div>
                        <div>
                            <span className={label}>Daily rate</span>
                            <Input
                                className={field}
                                inputMode="decimal"
                                value={form.dailyRate}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, dailyRate: e.target.value.replace(/[^0-9.]/g, "") }))
                                }
                                placeholder="961.53"
                            />
                        </div>
                    </div>
                    <div>
                        <span className={label}>Pay days</span>
                        <Input className={field} value={form.payDays} onChange={set("payDays")} placeholder="15th and 31st" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className={label}>Evaluation months</span>
                            <Input className={field} value={form.evalMonths} onChange={set("evalMonths")} placeholder="3rd and 5th" />
                        </div>
                        <div>
                            <span className={label}>Probationary period</span>
                            <Input className={field} value={form.probationText} onChange={set("probationText")} placeholder="six months (180 days)" />
                        </div>
                    </div>

                    <p className={section}>Signatory</p>
                    <div>
                        <span className={label}>Signatory name</span>
                        <Input className={field} value={form.signatoryName} onChange={set("signatoryName")} placeholder="DOROTHY G. PURILAN" />
                    </div>
                    <div>
                        <span className={label}>Signatory title</span>
                        <Input className={field} value={form.signatoryTitle} onChange={set("signatoryTitle")} placeholder="HR Officer" />
                    </div>

                    <p className={section}>Letterhead</p>
                    <div>
                        <span className={label}>Header address</span>
                        <Input className={field} value={form.headerAddress} onChange={set("headerAddress")} />
                    </div>
                    <div>
                        <span className={label}>Header contact #</span>
                        <Input className={field} value={form.headerContact} onChange={set("headerContact")} />
                    </div>
                    <div>
                        <span className={label}>Header email</span>
                        <Input className={field} value={form.headerEmail} onChange={set("headerEmail")} />
                    </div>
                </div>

                <div
                    id="job-offer-print"
                    className="bg-white text-black shadow-sm border rounded-xl p-8 sm:p-12 max-w-[800px] w-full mx-auto text-[15px] leading-relaxed font-serif"
                >
                    <div className="flex items-center justify-start gap-3">
                        <Image src={selectedLogo?.logo_data_url ?? "/men2-logo.jpg"} alt={`${selectedLogo?.company_name ?? "MEN2 Marketing"} logo`} width={220} height={80} className="h-20 w-auto shrink-0" priority />
                        <div className="text-sm leading-relaxed text-neutral-500">
                        <p className="text-xs font-normal">Address: {blank(form.headerAddress)}</p>
                        <p className="text-xs font-normal">Contact #: {blank(form.headerContact)}</p>
                        <p>Email Address: {blank(form.headerEmail)}</p>
                        </div>
                    </div>

                    <div className="border-t-[3px] border-double border-black mt-4" />

                    <p className="text-center font-bold text-[22px] mt-8">Job Offer Letter</p>

                    <p className="mt-6">{formatLongDate(form.offerDate)}</p>

                    <div className="mt-4 uppercase">
                        <p className="font-bold">{blank(form.candidateName)}</p>
                        <p className="text-sm font-normal normal-case">{blank(form.addressLine)}</p>
                        <p className="text-sm font-normal">{blank(form.contactNumber)}</p>
                    </div>

                    <p className="mt-6">
                        Dear <strong>{blank(form.salutationName)}</strong>,
                    </p>

                    <p className="mt-4 text-justify">
                        <strong>{blank(form.companyName)}</strong> is pleased to offer you the
                        position of <strong>{blank(form.position)}</strong> based in{" "}
                        <strong>{blank(form.baseLocation)}</strong>. Your skills and experience
                        will be an ideal fit for the <strong>{departmentDisplay(form.department)}</strong>
                        {form.division.trim() ? (
                            <>
                                {" "}under <strong>{form.division}</strong>
                            </>
                        ) : null}
                        .
                    </p>

                    <p className="mt-4 text-justify">
                        The <strong>starting salary</strong> for this position is{" "}
                        <strong>
                            Php {formatAmount(form.monthlySalary)}/month ({blank(form.dailyRate)}/day)
                        </strong>
                        , which shall be paid every <strong>{blank(form.payDays)} day of the month</strong>.
                    </p>

                    <p className="mt-4 text-justify">
                        You will undergo an evaluation on your <strong>{blank(form.evalMonths)} month</strong>{" "}
                        during your <strong>probationary period of {blank(form.probationText)}</strong>.
                    </p>

                    <p className="mt-4 text-justify">
                        If you choose to accept this job offer, please sign this letter, and return
                        it to this office, at your earliest convenience. Please let us know if you
                        have any clarifications so we can provide you with additional information.
                    </p>

                    <p className="mt-4 text-justify">
                        We look forward to welcoming you to the <strong>{blank(form.companyName)}!</strong>
                    </p>

                    <p className="mt-8">Sincerely yours,</p>

                    <p className="mt-14 font-bold uppercase">{blank(form.signatoryName)}</p>
                    <p>{blank(form.signatoryTitle)}</p>
                </div>
            </div>
        </div>
    );
}

export function JobOfferModule() {
    return <JobOfferContent />;
}

export default JobOfferModule;
