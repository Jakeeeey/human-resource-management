"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollableSearchableSelect } from "./ScrollableSearchableSelect";

import type { Competitor, CompetitorFormData, PsgcItem } from "../types";
import { usePsgc } from "../hooks/usePsgc";

interface CompetitorFormValues {
    name: string;
    website: string;
    provinceCode: string;
    cityCode: string;
    barangayCode: string;
}

interface CompetitorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    competitor?: Competitor | null;
    onSubmit: (data: CompetitorFormData) => Promise<void>;
}

function toOptions(items: PsgcItem[]) {
    return items.map((item) => ({ value: item.code, label: item.name }));
}

function getNameByCode(items: PsgcItem[], code: string) {
    return items.find((item) => item.code === code)?.name || "";
}

export function CompetitorDialog({
    open,
    onOpenChange,
    competitor,
    onSubmit,
}: CompetitorDialogProps) {
    const isEdit = !!competitor;
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<CompetitorFormValues>({
        defaultValues: {
            name: "",
            website: "",
            provinceCode: "",
            cityCode: "",
            barangayCode: "",
        },
    });

    const provinceCode = form.watch("provinceCode");
    const cityCode = form.watch("cityCode");

    const {
        provinces,
        cities,
        barangays,
        isLoadingProvinces,
        isLoadingCities,
        isLoadingBarangays,
    } = usePsgc(provinceCode, cityCode);

    const provinceOptions = useMemo(() => toOptions(provinces), [provinces]);
    const cityOptions = useMemo(() => toOptions(cities), [cities]);
    const barangayOptions = useMemo(() => toOptions(barangays), [barangays]);

    useEffect(() => {
        if (!open) {
            form.reset({
                name: "",
                website: "",
                provinceCode: "",
                cityCode: "",
                barangayCode: "",
            });
            return;
        }

        if (!competitor) {
            form.reset({
                name: "",
                website: "",
                provinceCode: "",
                cityCode: "",
                barangayCode: "",
            });
            return;
        }

        form.reset({
            name: competitor.name || "",
            website: competitor.website || "",
            provinceCode: "",
            cityCode: "",
            barangayCode: "",
        });
    }, [open, competitor, form]);

    useEffect(() => {
        if (!open || !competitor) return;

        if (!form.getValues("provinceCode") && competitor.province) {
            const match = provinces.find((p) => p.name === competitor.province);
            if (match) {
                form.setValue("provinceCode", match.code);
            }
        }

        if (form.getValues("provinceCode") && !form.getValues("cityCode") && competitor.city) {
            const match = cities.find((c) => c.name === competitor.city);
            if (match) {
                form.setValue("cityCode", match.code);
            }
        }

        if (form.getValues("cityCode") && !form.getValues("barangayCode") && competitor.barangay) {
            const match = barangays.find((b) => b.name === competitor.barangay);
            if (match) {
                form.setValue("barangayCode", match.code);
            }
        }
    }, [open, competitor, provinces, cities, barangays, form]);

    const handleSubmit = async (data: CompetitorFormValues) => {
        setIsSubmitting(true);
        try {
            const payload: CompetitorFormData = {
                name: data.name.trim(),
                website: data.website.trim() || null,
                province: getNameByCode(provinces, data.provinceCode) || null,
                city: getNameByCode(cities, data.cityCode) || null,
                barangay: getNameByCode(barangays, data.barangayCode) || null,
            };

            await onSubmit(payload);
            onOpenChange(false);
            form.reset();
        } catch (error) {
            console.error("Competitor form submit error:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? "Edit Competitor" : "Add Competitor"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Update the competitor details below."
                            : "Fill in the information to add a new competitor."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            rules={{ required: "Name is required" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Competitor name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="website"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Website</FormLabel>
                                    <FormControl>
                                        <Input placeholder="https://example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="provinceCode"
                            rules={{ required: "Province is required" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Province</FormLabel>
                                    <FormControl>
                                        <ScrollableSearchableSelect
                                            options={provinceOptions}
                                            value={field.value}
                                            onValueChange={(value) => {
                                                field.onChange(value);
                                                form.setValue("cityCode", "");
                                                form.setValue("barangayCode", "");
                                            }}
                                            placeholder={
                                                isLoadingProvinces
                                                    ? "Loading provinces..."
                                                    : "Select province"
                                            }
                                            disabled={isLoadingProvinces}
                                        />
                                    </FormControl>
                                    <FormDescription>Source: PSGC (GitLab)</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="cityCode"
                            rules={{ required: "City is required" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>City</FormLabel>
                                    <FormControl>
                                        <ScrollableSearchableSelect
                                            options={cityOptions}
                                            value={field.value}
                                            onValueChange={(value) => {
                                                field.onChange(value);
                                                form.setValue("barangayCode", "");
                                            }}
                                            placeholder={
                                                isLoadingCities
                                                    ? "Loading cities..."
                                                    : provinceCode
                                                        ? "Select city"
                                                        : "Select province first"
                                            }
                                            disabled={!provinceCode || isLoadingCities}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="barangayCode"
                            rules={{ required: "Barangay is required" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Barangay</FormLabel>
                                    <FormControl>
                                        <ScrollableSearchableSelect
                                            options={barangayOptions}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            placeholder={
                                                isLoadingBarangays
                                                    ? "Loading barangays..."
                                                    : cityCode
                                                        ? "Select barangay"
                                                        : "Select city first"
                                            }
                                            disabled={!cityCode || isLoadingBarangays}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                {isEdit ? "Update" : "Create"} Competitor
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
