"use client";

import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDateOnly, formatPHT } from "@/modules/human-resource-management/shared/utils/time";
import { RESIGNATION_STATUS_LABELS } from "../types";
import type { ResignationRequestWithUser } from "../types";
import { ResignationApprovalDialog } from "./ResignationApprovalDialog";
import { ResignationDetailDialog } from "./ResignationDetailDialog";

interface ResignationApprovalTableProps {
    data: ResignationRequestWithUser[];
    onApprove: (id: number, remarks: string) => Promise<void>;
    onReject: (id: number, remarks: string) => Promise<void>;
    onRetry: () => Promise<void>;
    isLoading?: boolean;
    error?: string | null;
}

export function ResignationApprovalTable({
    data,
    onApprove,
    onReject,
    onRetry,
    isLoading = false,
    error = null,
}: ResignationApprovalTableProps) {
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        action: "approve" | "reject" | null;
        requestId: number | null;
        employeeName: string;
    }>({
        isOpen: false,
        action: null,
        requestId: null,
        employeeName: "",
    });
    const [viewModalState, setViewModalState] = useState<{
        isOpen: boolean;
        data: ResignationRequestWithUser | null;
    }>({
        isOpen: false,
        data: null,
    });
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const displayedData = data.slice(startIndex, endIndex);

    const handleOpenModal = (
        action: "approve" | "reject",
        requestId: number,
        employeeName: string
    ) => {
        setModalState({
            isOpen: true,
            action,
            requestId,
            employeeName,
        });
    };

    const handleCloseModal = () => {
        setModalState({
            isOpen: false,
            action: null,
            requestId: null,
            employeeName: "",
        });
    };

    const handleOpenViewModal = (request: ResignationRequestWithUser) => {
        setViewModalState({
            isOpen: true,
            data: request,
        });
    };

    const handleCloseViewModal = () => {
        setViewModalState({
            isOpen: false,
            data: null,
        });
    };

    const handleConfirm = async (remarks: string) => {
        if (!modalState.requestId || !modalState.action) return;

        try {
            setProcessingId(modalState.requestId);

            if (modalState.action === "approve") {
                await onApprove(modalState.requestId, remarks);
            } else {
                await onReject(modalState.requestId, remarks);
            }

            handleCloseModal();
        } catch {
            return;
        } finally {
            setProcessingId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4">
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button onClick={onRetry} variant="outline">
                    Retry
                </Button>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">No pending resignation requests found.</p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-4">
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>Resignation Date</TableHead>
                                <TableHead>Filed Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayedData.map((request) => {
                                const fullName = [
                                    request.user_fname,
                                    request.user_mname,
                                    request.user_lname,
                                ]
                                    .filter(Boolean)
                                    .join(" ");

                                const isProcessing = processingId === request.id;

                                return (
                                    <TableRow key={request.id}>
                                        <TableCell className="font-medium max-w-50 truncate" title={fullName}>
                                            {fullName}
                                        </TableCell>
                                        <TableCell>{formatDateOnly(request.resignation_date)}</TableCell>
                                        <TableCell>{formatPHT(request.filed_at)}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">
                                                {RESIGNATION_STATUS_LABELS[request.status]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => handleOpenViewModal(request)}
                                                    disabled={isProcessing}
                                                    className="border dark:border-gray-600"
                                                >
                                                    View
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    onClick={() =>
                                                        handleOpenModal("approve", request.id, fullName)
                                                    }
                                                    disabled={isProcessing}
                                                >
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() =>
                                                        handleOpenModal("reject", request.id, fullName)
                                                    }
                                                    disabled={isProcessing}
                                                >
                                                    Reject
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                {totalPages > 0 && (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {Math.min(currentPage * pageSize, totalItems)} of {totalItems} rows
                        </p>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        if (currentPage > 1) {
                                            setCurrentPage(currentPage - 1);
                                        }
                                    }}
                                    disabled={currentPage === 1}
                                    className="px-3 py-2 text-sm border rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => {
                                        if (currentPage < totalPages) {
                                            setCurrentPage(currentPage + 1);
                                        }
                                    }}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-2 text-sm border rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <ResignationDetailDialog
                isOpen={viewModalState.isOpen}
                onClose={handleCloseViewModal}
                data={viewModalState.data}
            />

            <ResignationApprovalDialog
                isOpen={modalState.isOpen}
                onClose={handleCloseModal}
                onConfirm={handleConfirm}
                action={modalState.action}
                employeeName={modalState.employeeName}
                isLoading={processingId !== null}
            />
        </>
    );
}
