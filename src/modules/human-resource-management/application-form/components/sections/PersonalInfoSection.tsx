"use client";

import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CIVIL_STATUS_OPTIONS, type ApplicationFormValues } from "../../types";
import { checkBirthdate, checkFormat, checkHeightCm, checkUnlikelyAge, checkWeightKg } from "../../lib/softValidation";
import { SoftWarning } from "../SoftWarning";
import { PhotoCapture } from "../PhotoCapture";

function computeAge(iso: string): number | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
    return age >= 0 && age < 130 ? age : null;
}

export function PersonalInfoSection({ form }: { form: UseFormReturn<ApplicationFormValues> }) {
    const birthdate = useWatch({ control: form.control, name: "birthdate" });
    const phone = useWatch({ control: form.control, name: "phone" });
    const email = useWatch({ control: form.control, name: "email" });
    const sss = useWatch({ control: form.control, name: "sss_no" });
    const tin = useWatch({ control: form.control, name: "tin" });
    const philhealth = useWatch({ control: form.control, name: "philhealth_no" });
    const pagibig = useWatch({ control: form.control, name: "pagibig_no" });
    const heightCm = useWatch({ control: form.control, name: "height_cm" });
    const weightKg = useWatch({ control: form.control, name: "weight_kg" });
    const photoSelected = useWatch({ control: form.control, name: "photo_selected" });

    const age = useMemo(() => computeAge(birthdate), [birthdate]);

    return (
        <div className="space-y-4">
            <h2 className="text-base font-semibold">2. Personal Information</h2>

            <div className="grid gap-4 sm:grid-cols-4">
                <FormField
                    control={form.control}
                    name="first_name"
                    rules={{ required: "Required" }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                                <Input placeholder="Juan" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="middle_name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Middle Name</FormLabel>
                            <FormControl>
                                <Input placeholder="Santos" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="last_name"
                    rules={{ required: "Required" }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                                <Input placeholder="Dela Cruz" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="nickname"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nickname</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                            <Textarea rows={2} placeholder="House/Street, Barangay, City, Province" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                    control={form.control}
                    name="phone"
                    rules={{ required: "Required" }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Contact Number</FormLabel>
                            <FormControl>
                                <Input placeholder="09XXXXXXXXX" inputMode="tel" {...field} />
                            </FormControl>
                            <SoftWarning message={checkFormat("phone", phone)} />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input type="email" placeholder="you@example.com" {...field} />
                            </FormControl>
                            <SoftWarning message={checkFormat("email", email)} />
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid grid-cols-[minmax(0,1fr)_64px] items-end content-start gap-2">
                    <FormField
                        control={form.control}
                        name="birthdate"
                        rules={{
                            required: "Required",
                            validate: (v) => checkBirthdate(v ?? "") ?? true,
                        }}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Birthdate</FormLabel>
                                <FormControl>
                                    <Input
                                        type="date"
                                        max={new Date().toISOString().slice(0, 10)}
                                        {...field}
                                    />
                                </FormControl>
                                <SoftWarning message={checkUnlikelyAge(birthdate)} />
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormItem>
                        <FormLabel>Age</FormLabel>
                        <FormControl>
                            <Input value={age != null ? String(age) : ""} disabled placeholder="—" className="px-2 text-center" />
                        </FormControl>
                    </FormItem>
                </div>
                <FormField
                    control={form.control}
                    name="birthplace"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Birthplace</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="sex"
                    rules={{ required: "Required" }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Sex</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
                <FormField
                    control={form.control}
                    name="height_cm"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Height (cm)</FormLabel>
                            <FormControl>
                                <Input type="number" min={0} step="0.1" {...field} />
                            </FormControl>
                            <SoftWarning message={checkHeightCm(heightCm)} />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="weight_kg"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Weight (kg)</FormLabel>
                            <FormControl>
                                <Input type="number" min={0} step="0.1" {...field} />
                            </FormControl>
                            <SoftWarning message={checkWeightKg(weightKg)} />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="civil_status"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Civil Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select (optional)" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {CIVIL_STATUS_OPTIONS.map((o) => (
                                        <SelectItem key={o} value={o}>
                                            {o}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="religion"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Religion</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                    control={form.control}
                    name="sss_no"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>SSS No.</FormLabel>
                            <FormControl>
                                <Input placeholder="##-#######-#" {...field} />
                            </FormControl>
                            <SoftWarning message={checkFormat("sss", sss)} />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="tin"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>TIN</FormLabel>
                            <FormControl>
                                <Input placeholder="###-###-###-###" {...field} />
                            </FormControl>
                            <SoftWarning message={checkFormat("tin", tin)} />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="philhealth_no"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>PhilHealth No.</FormLabel>
                            <FormControl>
                                <Input placeholder="##-#########-#" {...field} />
                            </FormControl>
                            <SoftWarning message={checkFormat("philhealth", philhealth)} />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="pagibig_no"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Pag-IBIG No.</FormLabel>
                            <FormControl>
                                <Input placeholder="####-####-####" {...field} />
                            </FormControl>
                            <SoftWarning message={checkFormat("pagibig", pagibig)} />
                        </FormItem>
                    )}
                />
            </div>

            <FormField
                control={form.control}
                name="drivers_license_no"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Driver&apos;s License No.</FormLabel>
                        <FormControl>
                            <Input className="max-w-xs" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <PhotoCapture
                value={photoSelected}
                onChange={(file) => form.setValue("photo_selected", file)}
            />
        </div>
    );
}
