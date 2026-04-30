"use client";

import React from "react";
import { toast } from "sonner";
import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { CompetitorInformationFetchProvider } from "./providers/fetchProvider";
import { useCompetitors } from "./hooks/useCompetitors";
import { CompetitorTable } from "./components/CompetitorTable";
import type { CompetitorFormData } from "./types";

function CompetitorInformationContent() {
	const {
		competitors,
		isLoading,
		isError,
		error,
		refetch,
		createCompetitor,
		updateCompetitor,
	} = useCompetitors();

	const handleCreate = async (data: CompetitorFormData) => {
		try {
			await createCompetitor(data);
			toast.success("Competitor created successfully");
		} catch (err) {
			toast.error("Failed to create competitor");
			throw err;
		}
	};

	const handleUpdate = async (id: number, data: CompetitorFormData) => {
		try {
			await updateCompetitor(id, data);
			toast.success("Competitor updated successfully");
		} catch (err) {
			toast.error("Failed to update competitor");
			throw err;
		}
	};

	if (isError) {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertTitle>Error</AlertTitle>
				<AlertDescription className="flex items-center justify-between">
					<span>
						Failed to load competitors: {error?.message || "Unknown error"}
					</span>
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
						className="ml-4"
					>
						<RefreshCw className="mr-2 h-4 w-4" />
						Retry
					</Button>
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Competitor Management
					</h1>
					<p className="text-muted-foreground">
						Manage competitor profiles and locations.
					</p>
				</div>

				<Button
					variant="outline"
					size="sm"
					onClick={() => refetch()}
				>
					<RefreshCw className="mr-2 h-4 w-4" />
					Refresh
				</Button>
			</div>

			<CompetitorTable
				data={competitors}
				isLoading={isLoading}
				onCreateCompetitor={handleCreate}
				onUpdateCompetitor={handleUpdate}
			/>
		</div>
	);
}

export default function CompetitorInformationModule() {
	return (
		<CompetitorInformationFetchProvider>
			<CompetitorInformationContent />
		</CompetitorInformationFetchProvider>
	);
}
