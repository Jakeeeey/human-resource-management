"use client";

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { HOW_HEARD_OPTIONS, type ApplicationFormValues } from "../../types";

export function ApplicationDetailsSection({ form }: { form: UseFormReturn<ApplicationFormValues> }) {
    const howHeard = useWatch({ control: form.control, name: "how_heard" });

    return (
        <div className="space-y-4">
            <h2 className="text-base font-semibold">1. Application Details</h2>

            <FormField
                control={form.control}
                name="position_applied_for"
                rules={{ required: "Required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Position Applied For</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g. Warehouse Associate" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                    control={form.control}
                    name="how_heard"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>How did you hear about us?</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select (optional)" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {HOW_HEARD_OPTIONS.map((o) => (
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
                {howHeard === "Other" && (
                    <FormField
                        control={form.control}
                        name="how_heard_other"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Please specify</FormLabel>
                                <FormControl>
                                    <Input {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
            </div>
        </div>
    );
}
