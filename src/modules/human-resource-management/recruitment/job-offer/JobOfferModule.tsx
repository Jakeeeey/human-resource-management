"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { FileText, Printer } from "lucide-react";
import { EMPTY_JOB_OFFER, type JobOfferFormData } from "./types";

interface ApplicantOption {
    id: number;
    full_name: string;
    position_applied_for: string | null;
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
    const [applicantsLoading, setApplicantsLoading] = React.useState(true);

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/hrm/applicants");
                if (!res.ok) return;
                const json = await res.json();
                if (!cancelled && Array.isArray(json.data)) {
                    setApplicants(
                        json.data.map((r: { id: number; full_name: string; position_applied_for: string | null }) => ({
                            id: r.id,
                            full_name: r.full_name,
                            position_applied_for: r.position_applied_for,
                        }))
                    );
                }
            } catch {
                // Picker is a convenience — the form stays fully manual on failure.
            } finally {
                if (!cancelled) setApplicantsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const set = (key: keyof JobOfferFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value }));

    const handleApplicantPick = (id: string) => {
        const found = applicants.find((a) => String(a.id) === id);
        if (!found) return;
        setForm((f) => ({
            ...f,
            candidateName: found.full_name,
            position: found.position_applied_for ?? f.position,
        }));
        // Salutation auto-fill: gender + civil status from the application
        // record (Mrs. only when Female + Married; no civil status falls
        // back to gender). Field stays editable; untouched when unknown.
        void (async () => {
            try {
                const res = await fetch(`/api/hrm/applications/by-applicant?applicant_id=${found.id}`);
                if (!res.ok) return;
                const json = await res.json();
                const app = json?.data?.application;
                const prefix = salutationPrefix(app?.sex, app?.civil_status);
                if (!prefix) return;
                const surname = surnameOf(found.full_name);
                setForm((f) => ({ ...f, salutationName: surname ? `${prefix} ${surname}` : prefix }));
            } catch {
                // Salutation is a convenience — the field stays manual on failure.
            }
        })();
    };

    const handlePrint = () => window.print();

    const field = "w-full";
    const label = "text-sm font-medium mb-1 block";
    const section = "text-xs font-bold uppercase tracking-wider text-muted-foreground pt-2";

    return (
        <div className="p-2 sm:p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen space-y-8">
            <style>{`@media print {
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
                            Fill in the offer details — the printable updates live. Print only, nothing is saved.
                        </p>
                    </div>
                </div>
                <Button onClick={handlePrint} className="w-full sm:w-auto">
                    <Printer className="mr-2 h-4 w-4" />
                    Print Offer
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[400px_1fr] items-start">
                <div className="bg-card shadow-sm border rounded-xl p-6 space-y-4">
                    <div>
                        <span className={label}>Pre-fill from applicant (optional)</span>
                        <Select onValueChange={handleApplicantPick} disabled={applicantsLoading}>
                            <SelectTrigger className="w-full">
                                <SelectValue
                                    placeholder={applicantsLoading ? "Loading applicants..." : "Pick an applicant"}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {applicants.map((a) => (
                                    <SelectItem key={a.id} value={String(a.id)}>
                                        {a.full_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                        <span className={label}>Company name</span>
                        <Input className={field} value={form.companyName} onChange={set("companyName")} />
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
                            <Input className={field} value={form.department} onChange={set("department")} placeholder="Sales Department" />
                        </div>
                    </div>
                    <div>
                        <span className={label}>Division</span>
                        <Input className={field} value={form.division} onChange={set("division")} placeholder="Dry Division" />
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
                    <div className="flex items-start justify-between gap-6">
                        <Image src="/men2-logo.jpg" alt="MEN2 Marketing logo" width={220} height={80} className="h-20 w-auto shrink-0" priority />
                        <div className="text-[11px] leading-snug text-neutral-500">
                            <p>Address: {blank(form.headerAddress)}</p>
                            <p>Contact #: {blank(form.headerContact)}</p>
                            <p>Email Address: {blank(form.headerEmail)}</p>
                        </div>
                    </div>

                    <div className="border-t-[3px] border-double border-black mt-4" />

                    <p className="text-center font-bold text-[22px] mt-8">Job Offer Letter</p>

                    <p className="mt-6">{formatLongDate(form.offerDate)}</p>

                    <div className="mt-4 font-bold uppercase">
                        <p>{blank(form.candidateName)}</p>
                        <p>{blank(form.addressLine)}</p>
                        <p>{blank(form.contactNumber)}</p>
                    </div>

                    <p className="mt-6">
                        Dear <strong>{blank(form.salutationName)}</strong>,
                    </p>

                    <p className="mt-4 text-justify">
                        <strong>{blank(form.companyName)}</strong> is pleased to offer you the
                        position of <strong>{blank(form.position)}</strong> based in{" "}
                        <strong>{blank(form.baseLocation)}</strong>. Your skills and experience
                        will be an ideal fit for the <strong>{blank(form.department)}</strong>{" "}
                        under <strong>{blank(form.division)}</strong>.
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
