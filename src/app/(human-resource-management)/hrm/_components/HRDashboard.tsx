"use client";

import React from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Users, Briefcase, CalendarCheck, FileText } from "lucide-react";

export default function HRDashboard() {
    return (
        <div className="flex flex-col space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">HR Dashboard</h1>
                <p className="text-muted-foreground">
                    Overview of the Human Resource Management System
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">1,248</div>
                        <p className="text-xs text-muted-foreground">
                            +12% from last month
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Roles</CardTitle>
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">142</div>
                        <p className="text-xs text-muted-foreground">
                            +4 new roles this week
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                        <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">34</div>
                        <p className="text-xs text-muted-foreground">
                            Requires immediate action
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Recent Reports</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">8</div>
                        <p className="text-xs text-muted-foreground">
                            Generated today
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>System Information</CardTitle>
                        <CardDescription>Overall information for this HR System.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Version</span>
                                <span className="text-sm text-muted-foreground">v2.4.1</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Last Sync</span>
                                <span className="text-sm text-muted-foreground">10 minutes ago</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Database Status</span>
                                <span className="text-sm text-green-500">Healthy</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Active Modules</span>
                                <span className="text-sm text-muted-foreground">Employee Admin, Payroll, Workforce</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
