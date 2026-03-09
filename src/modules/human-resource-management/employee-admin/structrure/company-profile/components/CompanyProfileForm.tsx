"use client";

import { useForm, UseFormReturn, Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CompanyProfile, CompanyProfileSchema } from "../types/company-profile.schema";
import { getDirectusAssetUrl } from "@/modules/human-resource-management/employee-admin/administrator/utils/utils";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
    ArrowLeft,
    Save,
    X,
    Building2,
    FileText,
    MapPin,
    Phone,
    Globe,
    Upload,
    Loader2
} from "lucide-react";
import { useCompanyProfile } from "../hooks/useCompanyProfile";
import { toast } from "sonner";
import { useState, useRef } from "react";

interface CompanyProfileFormProps {
    onCancel: () => void;
}

export function CompanyProfileForm({ onCancel }: CompanyProfileFormProps) {
    const { data, updateProfile, uploadLogo } = useCompanyProfile();
    const [activeTab, setActiveTab] = useState("basic");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<CompanyProfile>({
        resolver: zodResolver(CompanyProfileSchema),
        defaultValues: data || {
            company_name: "",
            company_code: "",
            company_type: "",
            company_address: "",
            company_brgy: "",
            company_city: "",
            company_province: "",
            company_zipCode: "",
            company_contact: "",
            company_email: "",
            company_outlook: "",
            company_gmail: "",
            company_facebook: "",
            company_website: "",
            company_tin: "",
            company_registrationNumber: "",
            company_dateAdmitted: "",
            company_logo: "",
            company_tags: "",
            company_department: "",
        },
    });

    async function onSubmit(values: CompanyProfile) {
        setIsSubmitting(true);
        try {
            const success = await updateProfile(values);
            if (success) {
                onCancel(); // Return to view mode
            }
        } catch (error) {
            console.error("Form submission error:", error);
            toast.error("Failed to save changes. Please check the form for errors.");
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (!file.type.startsWith("image/")) {
            toast.error("Please upload an image file");
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            toast.error("Image size should be less than 5MB");
            return;
        }

        setIsUploading(true);
        try {
            const logoUrl = await uploadLogo(file);
            if (logoUrl) {
                form.setValue("company_logo", logoUrl, { shouldDirty: true });
                toast.success("Logo uploaded successfully");
            }
        } catch (error) {
            console.error("Upload error:", error);
            toast.error("Failed to upload logo");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={onCancel}
                            className="text-slate-500 hover:text-slate-900"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit Company Profile</h1>
                    </div>
                </div>

                {/* Tabbed Interface */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-5 bg-slate-100/50 p-1 rounded-xl h-auto mb-6">
                        <TabTrigger value="basic" icon={<Building2 className="w-4 h-4" />} label="Basic" />
                        <TabTrigger value="registration" icon={<FileText className="w-4 h-4" />} label="Registration" />
                        <TabTrigger value="address" icon={<MapPin className="w-4 h-4" />} label="Address" />
                        <TabTrigger value="contact" icon={<Phone className="w-4 h-4" />} label="Contact" />
                        <TabTrigger value="online" icon={<Globe className="w-4 h-4" />} label="Online" />
                    </TabsList>

                    <div className="min-h-[400px]">
                        {/* Basic Info Tab */}
                        <TabsContent value="basic" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                            <Card className="border-none shadow-sm bg-white overflow-hidden">
                                <CardContent className="p-8 space-y-6">
                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                                        <Building2 className="w-5 h-5 text-indigo-500" />
                                        <h3 className="text-lg font-semibold text-slate-800">Basic Information</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormFieldControl form={form} name="company_name" label="Company Name *" placeholder="e.g. TechVision Solutions Inc." />
                                        <FormFieldControl form={form} name="company_code" label="Company Code *" placeholder="e.g. TVI-2024-001" />
                                        <FormFieldControl form={form} name="company_type" label="Company Type" placeholder="e.g. Corporation" />
                                        <FormFieldControl form={form} name="company_department" label="Department" placeholder="e.g. Information Technology" />

                                        <div className="md:col-span-2 space-y-4">
                                            <FormLabel className="text-sm font-semibold text-slate-700">Company Logo</FormLabel>
                                            <div className="flex items-center gap-6 p-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 hover:bg-slate-50/50 transition-all">
                                                <div className="relative group shrink-0">
                                                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-white flex items-center justify-center border border-slate-100 shadow-sm relative">
                                                        {form.watch("company_logo") ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={getDirectusAssetUrl(form.watch("company_logo"))}
                                                                alt="Logo Preview"
                                                                className="w-full h-full object-contain p-1"
                                                            />
                                                        ) : (
                                                            <Building2 className="w-10 h-10 text-slate-200" />
                                                        )}
                                                        {isUploading && (
                                                            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
                                                                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    <p className="text-sm text-slate-500">
                                                        Recommended size: 512x512px. Max size: 5MB.
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={isUploading}
                                                            onClick={() => fileInputRef.current?.click()}
                                                            className="h-9 font-medium"
                                                        >
                                                            <Upload className="w-4 h-4 mr-2" />
                                                            {form.watch("company_logo") ? "Change Logo" : "Upload Logo"}
                                                        </Button>
                                                        {form.watch("company_logo") && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                disabled={isUploading}
                                                                onClick={() => form.setValue("company_logo", null)}
                                                                className="h-9 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                            >
                                                                <X className="w-4 h-4 mr-2" />
                                                                Remove
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        ref={fileInputRef}
                                                        accept="image/*"
                                                        onChange={handleLogoUpload}
                                                    />
                                                </div>
                                            </div>
                                            <FormField
                                                control={form.control}
                                                name="company_logo"
                                                render={() => <FormMessage />}
                                            />
                                        </div>

                                        <FormFieldControl form={form} name="company_tags" label="Tags (comma separated)" placeholder="Technology, Software, Innovation" className="md:col-span-2" />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Registration Tab */}
                        <TabsContent value="registration" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                            <Card className="border-none shadow-sm bg-white overflow-hidden">
                                <CardContent className="p-8 space-y-6">
                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                                        <FileText className="w-5 h-5 text-orange-500" />
                                        <h3 className="text-lg font-semibold text-slate-800">Registration Details</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormFieldControl form={form} name="company_registrationNumber" label="Registration Number" placeholder="e.g. CS201234567" />
                                        <FormFieldControl form={form} name="company_tin" label="Tax Identification Number (TIN)" placeholder="123-456-789-000" />
                                        <FormFieldControl form={form} name="company_dateAdmitted" label="Date Admitted" type="date" />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Address Tab */}
                        <TabsContent value="address" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                            <Card className="border-none shadow-sm bg-white overflow-hidden">
                                <CardContent className="p-8 space-y-6">
                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                                        <MapPin className="w-5 h-5 text-red-500" />
                                        <h3 className="text-lg font-semibold text-slate-800">Address Information</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <FormFieldControl form={form} name="company_address" label="Street Address" placeholder="123 Main Street" className="md:col-span-3" />
                                        <FormFieldControl form={form} name="company_brgy" label="Barangay" placeholder="Barangay Name" className="md:col-span-3" />
                                        <FormFieldControl form={form} name="company_city" label="City" placeholder="City Name" />
                                        <FormFieldControl form={form} name="company_province" label="Province" placeholder="Province Name" />
                                        <FormFieldControl form={form} name="company_zipCode" label="Zip Code" placeholder="1000" />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Contact Tab */}
                        <TabsContent value="contact" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                            <Card className="border-none shadow-sm bg-white overflow-hidden">
                                <CardContent className="p-8 space-y-6">
                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                                        <Phone className="w-5 h-5 text-green-500" />
                                        <h3 className="text-lg font-semibold text-slate-800">Contact Information</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormFieldControl form={form} name="company_contact" label="Contact Number" placeholder="+63 (02) 1234-5678" />
                                        <FormFieldControl form={form} name="company_email" label="Primary Email" placeholder="info@company.com" />
                                        <FormFieldControl form={form} name="company_outlook" label="Outlook Email" placeholder="contact@company.com" />
                                        <FormFieldControl form={form} name="company_gmail" label="Gmail" placeholder="company@gmail.com" />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Online Tab */}
                        <TabsContent value="online" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                            <Card className="border-none shadow-sm bg-white overflow-hidden">
                                <CardContent className="p-8 space-y-6">
                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                                        <Globe className="w-5 h-5 text-blue-500" />
                                        <h3 className="text-lg font-semibold text-slate-800">Online Presence</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormFieldControl form={form} name="company_website" label="Website" placeholder="https://www.company.com" />
                                        <FormFieldControl form={form} name="company_facebook" label="Facebook" placeholder="https://facebook.com/company" />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </div>
                </Tabs>

                {/* Footer actions */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="px-8"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg active:scale-95 transition-all px-8"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                    </Button>
                </div>
            </form>
        </Form >
    );
}

function TabTrigger({ value, icon, label }: { value: string; icon: React.ReactNode; label: string }) {
    return (
        <TabsTrigger
            value={value}
            className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm rounded-lg py-2.5 transition-all flex items-center gap-2"
        >
            {icon}
            <span className="hidden sm:inline font-medium">{label}</span>
        </TabsTrigger>
    );
}

function FormFieldControl({
    form,
    name,
    label,
    placeholder,
    type = "text",
    className = ""
}: {
    form: UseFormReturn<CompanyProfile>;
    name: Path<CompanyProfile>;
    label: string;
    placeholder?: string;
    type?: string;
    className?: string;
}) {
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem className={className}>
                    <FormLabel className="text-sm font-semibold text-slate-700">{label}</FormLabel>
                    <FormControl>
                        <Input
                            {...field}
                            type={type}
                            placeholder={placeholder}
                            className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all h-11"
                            value={field.value || ""}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}
