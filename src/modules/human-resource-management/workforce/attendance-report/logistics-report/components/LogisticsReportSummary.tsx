"use client";

import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { LogisticsReportMeta } from "../type";

interface LogisticsReportSummaryProps {
	meta: LogisticsReportMeta;
}

export function LogisticsReportSummary({ meta }: LogisticsReportSummaryProps) {
	return (
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<Card>
				<CardHeader className="gap-1 pb-0">
					<CardDescription>Total Dispatch Plans</CardDescription>
					<CardTitle className="text-3xl">{meta.totalDispatches}</CardTitle>
				</CardHeader>
			</Card>

			<Card>
				<CardHeader className="gap-1 pb-0">
					<CardDescription>Total Staff Records</CardDescription>
					<CardTitle className="text-3xl">{meta.totalStaff}</CardTitle>
				</CardHeader>
			</Card>

			<Card>
				<CardHeader className="gap-1 pb-0">
					<CardDescription>Present</CardDescription>
					<CardTitle className="text-3xl text-emerald-600">
						{meta.presentCount}
					</CardTitle>
				</CardHeader>
			</Card>

			<Card>
				<CardHeader className="gap-1 pb-0">
					<CardDescription>Absent</CardDescription>
					<CardTitle className="text-3xl text-red-600">
						{meta.absentCount}
					</CardTitle>
				</CardHeader>
			</Card>
		</div>
	);
}
