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
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { AddressSelectors } from "@/modules/human-resource-management/employee-admin/employee-masterlist/components/AddressSelectors";
import { CIVIL_STATUS_OPTIONS, type ApplicationFormValues } from "../../types";
import { checkBirthdate, checkFormat, checkHeightCm, checkUnlikelyAge, checkWeightKg } from "../../lib/softValidation";
import { govIdError, maskGovId, maskPhone, phoneError } from "../../lib/hardValidation";
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

export function PersonalInfoSection({
    form,
    readOnly = false,
}: {
    form: UseFormReturn<ApplicationFormValues>;
    readOnly?: boolean;
}) {
    const soft = (message: string | null) => (readOnly ? null : message);
    const birthdate = useWatch({ control: form.control, name: "birthdate" });
    const province = useWatch({ control: form.control, name: "province" });
    const city = useWatch({ control: form.control, name: "city" });
    const brgy = useWatch({ control: form.control, name: "brgy" });
    const email = useWatch({ control: form.control, name: "email" });
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
                    rules={{ required: "Enter your first name." }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                First Name <span className="text-destructive">*</span>
                            </FormLabel>
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
                    rules={{ required: "Enter your last name." }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                Last Name <span className="text-destructive">*</span>
                            </FormLabel>
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
            <div className="flex flex-col gap-2">
                <Label>Address</Label>
                <AddressSelectors
                    province={province}
                    city={city}
                    brgy={brgy}
                    onProvinceChange={(v) => form.setValue("province", v, { shouldDirty: true, shouldValidate: true })}
                    onCityChange={(v) => form.setValue("city", v, { shouldDirty: true, shouldValidate: true })}
                    onBrgyChange={(v) => form.setValue("brgy", v, { shouldDirty: true, shouldValidate: true })}
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                    control={form.control}
                    name="phone"
                    rules={{ required: "Enter your contact number.", validate: (v) => phoneError(v) ?? true }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                Contact Number <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="09XXXXXXXXX"
                                    inputMode="tel"
                                    {...field}
                                    onChange={(e) => field.onChange(maskPhone(e.target.value))}
                                />
                            </FormControl>
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
                            <SoftWarning message={soft(checkFormat("email", email))} />
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
                            required: "Enter your birthdate.",
                            validate: (v) => checkBirthdate(v ?? "") ?? true,
                        }}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>
                                    Birthdate <span className="text-destructive">*</span>
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        type="date"
                                        max={new Date().toISOString().slice(0, 10)}
                                        {...field}
                                    />
                                </FormControl>
                                <SoftWarning message={soft(checkUnlikelyAge(birthdate))} />
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
                    rules={{ required: "Select your sex." }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                Sex <span className="text-destructive">*</span>
                            </FormLabel>
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
                            <SoftWarning message={soft(checkHeightCm(heightCm))} />
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
                            <SoftWarning message={soft(checkWeightKg(weightKg))} />
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
                    rules={{ validate: (v) => govIdError("sss", v) ?? true }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>SSS No.</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="##-#######-#"
                                    inputMode="numeric"
                                    {...field}
                                    onChange={(e) => field.onChange(maskGovId("sss", e.target.value))}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="tin"
                    rules={{ validate: (v) => govIdError("tin", v) ?? true }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>TIN</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="###-###-###-###"
                                    inputMode="numeric"
                                    {...field}
                                    onChange={(e) => field.onChange(maskGovId("tin", e.target.value))}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="philhealth_no"
                    rules={{ validate: (v) => govIdError("philhealth", v) ?? true }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>PhilHealth No.</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="##-#########-#"
                                    inputMode="numeric"
                                    {...field}
                                    onChange={(e) => field.onChange(maskGovId("philhealth", e.target.value))}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="pagibig_no"
                    rules={{ validate: (v) => govIdError("pagibig", v) ?? true }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Pag-IBIG No.</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="####-####-####"
                                    inputMode="numeric"
                                    {...field}
                                    onChange={(e) => field.onChange(maskGovId("pagibig", e.target.value))}
                                />
                            </FormControl>
                            <FormMessage />
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

            {!readOnly && (
                <PhotoCapture
                    value={photoSelected}
                    onChange={(file) => form.setValue("photo_selected", file)}
                />
            )}
        </div>
    );
}
