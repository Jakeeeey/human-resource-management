"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/ui/skeleton";
import type { OvertimeRequestWithUser } from "../type";
import { ApprovalModal } from "./ApprovalModal";
import { ViewDetailsModal } from "./ViewDetailsModal";

import { UserOvertimeRequestsModal } from "./UserOvertimeRequestsModal";

interface OvertimeTableProps {
  data: OvertimeRequestWithUser[];
  onApprove: (overtimeIds: number[], remarks: string) => Promise<void>;
  onReject: (overtimeIds: number[], remarks: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  isLoading?: boolean;
}

export function OvertimeTable({ data, onApprove, onReject, isLoading = false }: OvertimeTableProps) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    action: "approve" | "reject" | null;
    overtimeIds: number[];
    employeeName: string;
  }>({
    isOpen: false,
    action: null,
    overtimeIds: [],
    employeeName: "",
  });
  const [viewModalState, setViewModalState] = useState<{
    isOpen: boolean;
    data: OvertimeRequestWithUser | null;
  }>({
    isOpen: false,
    data: null,
  });
  
  // State for the new User Modal
  const [userModalState, setUserModalState] = useState<{
    isOpen: boolean;
    userId: number | null;
    employeeName: string;
  }>({
    isOpen: false,
    userId: null,
    employeeName: "",
  });

  const [processingId, setProcessingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Group by user
  const groupedUsers = useMemo(() => {
    const map = new Map<number, OvertimeRequestWithUser[]>();
    for (const req of data) {
      if (!map.has(req.user_id)) {
        map.set(req.user_id, []);
      }
      map.get(req.user_id)!.push(req);
    }
    return Array.from(map.values());
  }, [data]);

  // Calculate pagination
  const totalItems = groupedUsers.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const displayedData = groupedUsers.slice(startIndex, endIndex);

  const handleOpenApprovalModal = (
    action: "approve" | "reject",
    overtimeIds: number[],
    employeeName: string
  ) => {
    setModalState({
      isOpen: true,
      action,
      overtimeIds,
      employeeName,
    });
  };

  const handleCloseApprovalModal = () => {
    setModalState({
      isOpen: false,
      action: null,
      overtimeIds: [],
      employeeName: "",
    });
  };

  const handleOpenViewModal = (request: OvertimeRequestWithUser) => {
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

  const handleOpenUserModal = (userId: number, employeeName: string) => {
    setUserModalState({
      isOpen: true,
      userId,
      employeeName,
    });
  };

  const handleCloseUserModal = () => {
    setUserModalState({
      isOpen: false,
      userId: null,
      employeeName: "",
    });
  };

  const handleConfirmAction = async (remarks: string) => {
    if (modalState.overtimeIds.length === 0 || !modalState.action) return;

    try {
      // Just set processing for the first one, or disable all buttons since we have global isLoading 
      setProcessingId(modalState.overtimeIds[0]);
      
      if (modalState.action === "approve") {
        await onApprove(modalState.overtimeIds, remarks);
      } else {
        await onReject(modalState.overtimeIds, remarks);
      }
      
      handleCloseApprovalModal();
    } catch (error) {
      console.error("Error processing request:", error);
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

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No pending overtime requests found.</p>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Total Requests</TableHead>
                  <TableHead>Total Duration</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedData.map((userRequests) => {
                  const firstReq = userRequests[0];
                  const fullName = [
                    firstReq.user_fname,
                    firstReq.user_mname,
                    firstReq.user_lname,
                  ]
                    .filter(Boolean)
                    .join(" ");
                  
                  const totalDurationMins = userRequests.reduce((acc, req) => acc + req.duration_minutes, 0);
                  const durationHours = Math.floor(totalDurationMins / 60);
                  const durationMins = totalDurationMins % 60;
                  const durationDisplay = durationHours > 0 
                    ? `${durationHours}h ${durationMins}m` 
                    : `${durationMins}m`;

                  return (
                    <TableRow key={firstReq.user_id}>
                      <TableCell className="font-medium">{fullName}</TableCell>
                      <TableCell>{firstReq.department_name || "N/A"}</TableCell>
                      <TableCell>{userRequests.length}</TableCell>
                      <TableCell>{durationDisplay}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleOpenUserModal(firstReq.user_id, fullName)}
                          disabled={isLoading}
                        >
                          View Requests
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {Math.min(currentPage * pageSize, totalItems)} of {totalItems} users
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

      <UserOvertimeRequestsModal
        isOpen={userModalState.isOpen}
        onClose={handleCloseUserModal}
        requests={groupedUsers.find(g => g[0]?.user_id === userModalState.userId) || []}
        employeeName={userModalState.employeeName}
        onApprove={(overtimeId) => {
          handleOpenApprovalModal("approve", overtimeId, userModalState.employeeName);
          return Promise.resolve();
        }}
        onReject={(overtimeId) => {
          handleOpenApprovalModal("reject", overtimeId, userModalState.employeeName);
          return Promise.resolve();
        }}
        onViewDetails={handleOpenViewModal}
        isLoading={processingId !== null}
      />

      <ViewDetailsModal
        isOpen={viewModalState.isOpen}
        onClose={handleCloseViewModal}
        data={viewModalState.data}
      />

      <ApprovalModal
        isOpen={modalState.isOpen}
        onClose={handleCloseApprovalModal}
        onConfirm={handleConfirmAction}
        action={modalState.action}
        employeeName={modalState.employeeName}
        isLoading={processingId !== null}
      />
    </>
  );
}
