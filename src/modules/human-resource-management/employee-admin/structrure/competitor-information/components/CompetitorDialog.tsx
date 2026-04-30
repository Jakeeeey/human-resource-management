"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Building2, Globe, Loader2, MapPin, Save, X } from "lucide-react";

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
import { Separator } from "@/components/ui/separator";

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
            <DialogContent className="sm:max-w-155 overflow-hidden p-0 rounded-2xl border-2 shadow-2xl animate-in fade-in zoom-in-95">
                <div className="bg-linear-to-r from-primary/10 via-background to-primary/5 p-6 pb-4">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                <Building2 className="h-6 w-6 text-primary stroke-[2.5px]" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-bold tracking-tight">
                                    {isEdit ? "Edit Competitor Details" : "Add Competitor"}
                                </DialogTitle>
                                <DialogDescription className="text-sm font-medium opacity-70">
                                    {isEdit
                                        ? "Modify the competitor profile information."
                                        : "Provide the details for a new competitor."}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <Separator className="bg-primary/10" />

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="name"
                                rules={{ required: "Name is required" }}
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Building2 className="h-4 w-4 text-primary" />
                                            <FormLabel className="font-bold text-sm">
                                                Competitor Name <span className="text-destructive">*</span>
                                            </FormLabel>
                                        </div>
                                        <FormControl>
                                            <Input
                                                placeholder="Competitor name"
                                                className="h-11 rounded-xl border-2 bg-background/50 focus:bg-background transition-all"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage className="text-xs font-bold" />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="website"
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Globe className="h-4 w-4 text-primary" />
                                            <FormLabel className="font-bold text-sm">Website</FormLabel>
                                        </div>
                                        <FormControl>
                                            <Input
                                                placeholder="https://example.com"
                                                className="h-11 rounded-xl border-2 bg-background/50 focus:bg-background transition-all"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage className="text-xs font-bold" />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="provinceCode"
                                rules={{ required: "Province is required" }}
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <MapPin className="h-4 w-4 text-primary" />
                                            <FormLabel className="font-bold text-sm">
                                                Province <span className="text-destructive">*</span>
                                            </FormLabel>
                                        </div>
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
                                                className="h-11 rounded-xl border-2 bg-background/50 focus:bg-background transition-all"
                                            />
                                        </FormControl>
                                        <FormMessage className="text-xs font-bold" />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="cityCode"
                                rules={{ required: "City is required" }}
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <MapPin className="h-4 w-4 text-primary" />
                                            <FormLabel className="font-bold text-sm">
                                                City <span className="text-destructive">*</span>
                                            </FormLabel>
                                        </div>
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
                                                className="h-11 rounded-xl border-2 bg-background/50 focus:bg-background transition-all"
                                            />
                                        </FormControl>
                                        <FormMessage className="text-xs font-bold" />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="barangayCode"
                            rules={{ required: "Barangay is required" }}
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <MapPin className="h-4 w-4 text-primary" />
                                        <FormLabel className="font-bold text-sm">
                                            Barangay <span className="text-destructive">*</span>
                                        </FormLabel>
                                    </div>
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
                                            className="h-11 rounded-xl border-2 bg-background/50 focus:bg-background transition-all"
                                        />
                                    </FormControl>
                                    <FormMessage className="text-xs font-bold" />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="pt-2 gap-3 pb-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting}
                                className="font-bold text-muted-foreground hover:bg-muted rounded-xl px-6 h-11"
                            >
                                <X className="mr-2 h-4 w-4" />
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 px-8 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        {isEdit ? "Update Competitor" : "Create Competitor"}
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
