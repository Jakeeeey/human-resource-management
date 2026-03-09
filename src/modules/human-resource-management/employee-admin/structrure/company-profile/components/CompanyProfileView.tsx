"use client";

import { useCompanyProfile } from "../hooks/useCompanyProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Building2,
    MapPin,
    Phone,
    Mail,
    Globe,
    Facebook,
    FileText,
    Calendar,
    Tag,
    Pencil,
    Building
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getDirectusAssetUrl } from "@/modules/human-resource-management/employee-admin/administrator/utils/utils";

interface CompanyProfileViewProps {
    onEdit: () => void;
}

export function CompanyProfileView({ onEdit }: CompanyProfileViewProps) {
    const { data, isLoading, error } = useCompanyProfile();

    if (isLoading) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <Skeleton className="h-48 w-full rounded-xl" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="h-64 rounded-xl" />
                    <Skeleton className="h-64 rounded-xl" />
                    <Skeleton className="h-64 rounded-xl" />
                    <Skeleton className="h-64 rounded-xl" />
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                <div className="bg-red-50 p-4 rounded-full">
                    <Building className="h-12 w-12 text-red-500" />
                </div>
                <div>
                    <h3 className="text-xl font-semibold">Failed to load company profile</h3>
                    <p className="text-muted-foreground">{error || "No data available"}</p>
                </div>
                <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
        );
    }

    const tags = data.company_tags ? data.company_tags.split(",").map(t => t.trim()) : [];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <Card className="overflow-hidden border-none shadow-md bg-white">
                <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-2xl overflow-hidden bg-slate-50 flex items-center justify-center border-2 border-slate-100 shadow-inner">
                                {data.company_logo ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={getDirectusAssetUrl(data.company_logo)}
                                        alt={data.company_name}
                                        className="w-full h-full object-contain p-2"
                                    />
                                ) : (
                                    <Building2 className="w-16 h-16 text-slate-300" />
                                )}
                            </div>
                        </div>

                        <div className="flex-1 text-center md:text-left space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">{data.company_name}</h1>
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2 text-slate-500 font-medium">
                                        <span className="flex items-center gap-1">
                                            <span className="text-slate-400 font-normal">#</span> {data.company_code}
                                        </span>
                                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                                        <span className="flex items-center gap-1">
                                            <Building className="w-4 h-4" />
                                            {data.company_type || "N/A"}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    onClick={onEdit}
                                    className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg transition-all active:scale-95 group"
                                >
                                    <Pencil className="w-4 h-4 mr-2 transition-transform group-hover:rotate-12" />
                                    Edit Profile
                                </Button>
                            </div>

                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-2">
                                {tags.map((tag, idx) => (
                                    <Badge key={idx} variant="secondary" className="px-3 py-1 bg-slate-100 text-slate-600 border-none hover:bg-slate-200">
                                        <Tag className="w-3 h-3 mr-1.5 opacity-70" />
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-indigo-500" />
                            Basic Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <InfoItem label="Company Name" value={data.company_name} />
                        <InfoItem label="Company Type" value={data.company_type} />
                        <InfoItem label="Company Code" value={data.company_code} />
                        <InfoItem label="Department" value={data.company_department} />
                    </CardContent>
                </Card>

                {/* Registration Details */}
                <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <FileText className="w-5 h-5 text-orange-500" />
                            Registration Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <InfoItem label="Registration Number" value={data.company_registrationNumber} />
                        <InfoItem label="Tax Identification Number (TIN)" value={data.company_tin} />
                        <InfoItem label="Date Admitted" value={data.company_dateAdmitted} icon={<Calendar className="w-4 h-4 mt-0.5 text-slate-400" />} />
                    </CardContent>
                </Card>

                {/* Address Information */}
                <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-red-500" />
                            Address Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <InfoItem label="Street Address" value={data.company_address} />
                        <InfoItem label="Barangay" value={data.company_brgy} />
                        <div className="grid grid-cols-2 gap-4">
                            <InfoItem label="City" value={data.company_city} />
                            <InfoItem label="Province" value={data.company_province} />
                        </div>
                        <InfoItem label="Zip Code" value={data.company_zipCode} />
                    </CardContent>
                </Card>

                {/* Contact Information */}
                <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <Phone className="w-5 h-5 text-green-500" />
                            Contact Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <InfoItem label="Contact Number" value={data.company_contact} icon={<Phone className="w-4 h-4 mt-0.5 text-slate-400" />} />
                        <InfoItem label="Primary Email" value={data.company_email} icon={<Mail className="w-4 h-4 mt-0.5 text-slate-400" />} />
                        <InfoItem label="Outlook Email" value={data.company_outlook} icon={<Mail className="w-4 h-4 mt-0.5 text-slate-400" />} />
                        <InfoItem label="Gmail" value={data.company_gmail} />
                    </CardContent>
                </Card>

                {/* Online Presence */}
                <Card className="col-span-full border-none shadow-sm hover:shadow-md transition-shadow bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <Globe className="w-5 h-5 text-blue-500" />
                            Online Presence
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <InfoItem
                            label="Website"
                            value={data.company_website}
                            isLink
                            icon={<Globe className="w-4 h-4 mt-0.5 text-slate-400" />}
                        />
                        <InfoItem
                            label="Facebook"
                            value={data.company_facebook}
                            isLink
                            icon={<Facebook className="w-4 h-4 mt-0.5 text-slate-400" />}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function InfoItem({
    label,
    value,
    icon,
    isLink
}: {
    label: string;
    value: string | null | undefined;
    icon?: React.ReactNode;
    isLink?: boolean;
}) {
    return (
        <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
            <div className="flex items-start gap-2.5">
                {icon}
                {isLink && value ? (
                    <a
                        href={value.startsWith("http") ? value : `https://${value}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors break-all"
                    >
                        {value}
                    </a>
                ) : (
                    <p className="text-sm font-medium text-slate-700">{value || "None"}</p>
                )}
            </div>
            <div className="h-px w-full bg-slate-50" />
        </div>
    );
}
