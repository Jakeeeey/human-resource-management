"use client";

import type { Path, UseFormReturn } from "react-hook-form";
import { useFieldArray, useWatch } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { phToday } from "@/lib/time";
import {
    DEPENDENT_RELATION_OPTIONS,
    EMPTY_FAMILY_DEPENDENT,
    type ApplicationFormValues,
} from "../../types";
import { RepeatingFieldArray } from "../RepeatingFieldArray";
import { contactNumberError, maskPhone } from "../../lib/hardValidation";
import { checkPastDate, computeAgeYears } from "../../lib/softValidation";

type FamilyBase = "father" | "mother" | "spouse";

function AgeHint({
    form,
    dobName,
    legacyAgeName,
}: {
    form: UseFormReturn<ApplicationFormValues>;
    dobName: Path<ApplicationFormValues>;
    legacyAgeName: Path<ApplicationFormValues>;
}) {
    const dob = useWatch({ control: form.control, name: dobName }) as string;
    const legacyAge = useWatch({ control: form.control, name: legacyAgeName }) as string;
    const age = computeAgeYears(dob ?? "");
    if (age !== null) return <p className="text-xs text-muted-foreground">Age: {age}</p>;
    if (!dob && legacyAge) return <p className="text-xs text-muted-foreground">Age: {legacyAge} (as recorded earlier)</p>;
    return null;
}

function DateOfBirthField({
    form,
    name,
    legacyAgeName,
}: {
    form: UseFormReturn<ApplicationFormValues>;
    name: Path<ApplicationFormValues>;
    legacyAgeName: Path<ApplicationFormValues>;
}) {
    return (
        <FormField
            control={form.control}
            name={name}
            rules={{ validate: (v) => checkPastDate(String(v ?? ""), "Date of birth") ?? true }}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                        <Input type="date" max={phToday()} {...field} value={String(field.value ?? "")} />
                    </FormControl>
                    <AgeHint form={form} dobName={name} legacyAgeName={legacyAgeName} />
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}

function ContactNumberField({
    form,
    name,
}: {
    form: UseFormReturn<ApplicationFormValues>;
    name: Path<ApplicationFormValues>;
}) {
    return (
        <FormField
            control={form.control}
            name={name}
            rules={{ validate: (v) => contactNumberError(String(v ?? "")) ?? true }}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Contact Number</FormLabel>
                    <FormControl>
                        <Input
                            inputMode="tel"
                            placeholder="09XXXXXXXXX"
                            {...field}
                            value={String(field.value ?? "")}
                            onChange={(e) => field.onChange(maskPhone(e.target.value))}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}

function AddressField({
    form,
    name,
}: {
    form: UseFormReturn<ApplicationFormValues>;
    name: Path<ApplicationFormValues>;
}) {
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem className="sm:col-span-2">
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                        <Input maxLength={500} {...field} value={String(field.value ?? "")} />
                    </FormControl>
                </FormItem>
            )}
        />
    );
}

function FamilyMemberBlock({
    form,
    base,
    label,
    nameLabel = "Name",
    canBeDeceased = false,
}: {
    form: UseFormReturn<ApplicationFormValues>;
    base: FamilyBase;
    label: string;
    nameLabel?: string;
    canBeDeceased?: boolean;
}) {
    const deceased = useWatch({ control: form.control, name: `${base}.is_deceased` });

    return (
        <div className="rounded-lg border p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{label}</h3>
                {canBeDeceased && (
                    <FormField
                        control={form.control}
                        name={`${base}.is_deceased`}
                        render={({ field }) => (
                            <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={(checked) => {
                                            const next = checked === true;
                                            field.onChange(next);
                                            if (next) {
                                                form.setValue(`${base}.occupation`, "", { shouldDirty: true });
                                                form.setValue(`${base}.company`, "", { shouldDirty: true });
                                            }
                                        }}
                                    />
                                </FormControl>
                                <FormLabel className="!mt-0 font-normal">Deceased</FormLabel>
                            </FormItem>
                        )}
                    />
                )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <FormField
                    control={form.control}
                    name={`${base}.name`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{nameLabel}</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <DateOfBirthField form={form} name={`${base}.date_of_birth`} legacyAgeName={`${base}.age`} />
                <FormField
                    control={form.control}
                    name={`${base}.occupation`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Occupation</FormLabel>
                            <FormControl>
                                <Input {...field} disabled={deceased === true} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name={`${base}.company`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Company</FormLabel>
                            <FormControl>
                                <Input {...field} disabled={deceased === true} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <ContactNumberField form={form} name={`${base}.contact_number`} />
                <AddressField form={form} name={`${base}.address`} />
            </div>
        </div>
    );
}

export function FamilyBackgroundSection({ form }: { form: UseFormReturn<ApplicationFormValues> }) {
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "family_dependents",
    });

    return (
        <div className="space-y-4">
            <h2 className="text-base font-semibold">3. Family Background</h2>

            <div className="space-y-3">
                <FamilyMemberBlock form={form} base="father" label="Father" canBeDeceased />
                <FamilyMemberBlock
                    form={form}
                    base="mother"
                    label="Mother"
                    nameLabel="Mother's Maiden Name"
                    canBeDeceased
                />
                <FamilyMemberBlock form={form} base="spouse" label="Spouse (if applicable)" />
            </div>

            <RepeatingFieldArray
                title="Children / Other Dependents"
                addLabel="Add Dependent"
                fields={fields}
                onAdd={() => append({ ...EMPTY_FAMILY_DEPENDENT })}
                onRemove={remove}
                emptyHint="No children or other dependents added."
                renderRow={(index) => (
                    <>
                        <FormField
                            control={form.control}
                            name={`family_dependents.${index}.relation`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Relation</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {DEPENDENT_RELATION_OPTIONS.map((o) => (
                                                <SelectItem key={o} value={o}>
                                                    {o}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`family_dependents.${index}.name`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <DateOfBirthField
                            form={form}
                            name={`family_dependents.${index}.date_of_birth`}
                            legacyAgeName={`family_dependents.${index}.age`}
                        />
                        <FormField
                            control={form.control}
                            name={`family_dependents.${index}.occupation`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Occupation / School</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <ContactNumberField form={form} name={`family_dependents.${index}.contact_number`} />
                        <AddressField form={form} name={`family_dependents.${index}.address`} />
                    </>
                )}
            />
        </div>
    );
}
