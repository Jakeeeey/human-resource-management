"use client";

import React from "react";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Fingerprint, ScanFace, Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useAttendanceSetting } from "@/modules/human-resource-management/system-management/attendance-setting/hooks/useAttendanceSetting";

export default function AttendanceSettingPage() {
    const { settings, isLoading, isUpdating, updateSetting } = useAttendanceSetting();

    const isRfidEnabled = settings.rfid_attendance?.setting_value === "1";
    const isFaceEnabled = settings.face_attendance?.setting_value === "1";

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
            {/* Top Navigation */}
            <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b shadow-sm bg-background sm:h-16 overflow-hidden">
                <div className="flex h-full min-w-0 items-center gap-2 px-3 sm:px-4 overflow-hidden">
                    <SidebarTrigger className="-ml-1 shrink-0" />
                    <Separator
                        orientation="vertical"
                        className="hidden sm:block mr-2 data-[orientation=vertical]:h-4 shrink-0"
                    />
                    <div className="min-w-0 overflow-hidden">
                        <Breadcrumb>
                            <BreadcrumbList className="min-w-0 overflow-hidden">
                                <BreadcrumbItem className="hidden md:block shrink-0">
                                    <BreadcrumbLink href="/hrm">HRM</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="hidden md:block shrink-0">
                                    <span className="text-muted-foreground">System Management</span>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="min-w-0 overflow-hidden">
                                    <BreadcrumbPage className="truncate max-w-[56vw] sm:max-w-[60vw] md:max-w-none">
                                        Attendance Setting
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
                <div className="mx-auto w-full max-w-4xl space-y-8">
                    {/* Page Header */}
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Attendance Settings</h1>
                        <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                            Configure how employees record their daily attendance across the organization.
                        </p>
                    </div>

                    {isLoading ? (
                        <div className="space-y-4">
                            <div className="grid gap-6 md:grid-cols-2">
                                <Skeleton className="h-[200px] w-full rounded-xl" />
                                <Skeleton className="h-[200px] w-full rounded-xl" />
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2">
                            {/* RFID Tap Card */}
                            <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-md border-sidebar-border/60">
                                <CardHeader className="pb-4">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <div className="p-2 rounded-md bg-primary/10 text-primary">
                                                    <Fingerprint className="size-5" />
                                                </div>
                                                RFID Tap
                                            </CardTitle>
                                            <CardDescription className="pt-2 text-sm">
                                                Allow employees to time in and out using their assigned RFID cards on physical terminals.
                                            </CardDescription>
                                        </div>
                                        {isRfidEnabled ? (
                                            <Badge variant="default" className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-emerald-500/20">Active</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between rounded-lg border bg-card p-4">
                                        <div className="space-y-0.5">
                                            <Label className="text-base font-medium">Enable RFID Authentication</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Terminal synchronization is required after toggling.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isUpdating && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                                            <Switch 
                                                checked={isRfidEnabled} 
                                                onCheckedChange={(checked) => updateSetting("rfid_attendance", checked)}
                                                disabled={isUpdating || !settings.rfid_attendance}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Face Recognition Card */}
                            <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-md border-sidebar-border/60">
                                <CardHeader className="pb-4">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <div className="p-2 rounded-md bg-indigo-500/10 text-indigo-500">
                                                    <ScanFace className="size-5" />
                                                </div>
                                                Face Recognition
                                            </CardTitle>
                                            <CardDescription className="pt-2 text-sm">
                                                Enable AI-powered biometric face recognition for touchless attendance tracking.
                                            </CardDescription>
                                        </div>
                                        {isFaceEnabled ? (
                                            <Badge variant="default" className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-emerald-500/20">Active</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between rounded-lg border bg-card p-4">
                                        <div className="space-y-0.5">
                                            <Label className="text-base font-medium">Enable Biometric Face Scan</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Requires users to have registered biometric profiles.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isUpdating && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                                            <Switch 
                                                checked={isFaceEnabled} 
                                                onCheckedChange={(checked) => updateSetting("face_attendance", checked)}
                                                disabled={isUpdating || !settings.face_attendance}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
