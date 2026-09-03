"use client";

import React, { useState } from "react";
import { useTravelRequestApprovalContext } from "./providers/TravelRequestApprovalProvider";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Check, X, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export default function TravelRequestApprovalPage() {
  const { data, isLoading, error, approveRequest, rejectRequest } = useTravelRequestApprovalContext();
  const [selectedRequestId, setSelectedRequestId] = useState<number | string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedDetailsId, setSelectedDetailsId] = useState<number | string | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-destructive">
        Error loading requests: {error}
      </div>
    );
  }

  const handleAction = async () => {
    if (selectedRequestId === null || !actionType) return;
    
    setIsSubmitting(true);
    setActionError(null);
    try {
      if (actionType === "approve") {
        await approveRequest(selectedRequestId, remarks);
      } else {
        await rejectRequest(selectedRequestId, remarks);
      }
      setSelectedRequestId(null);
      setRemarks("");
      setActionType(null);
    } catch (error: unknown) {
      console.error("Action failed", error);
      setActionError(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openActionModal = (id: number | string, type: "approve" | "reject") => {
    setSelectedRequestId(id);
    setActionType(type);
    setRemarks("");
    setActionError(null);
  };

  const viewDetails = (id: number | string) => {
    setSelectedDetailsId(id);
    setDetailsModalOpen(true);
  };

  const detailsRequest = data.find(r => r.id === selectedDetailsId);
  const actionRequest = data.find(r => r.id === selectedRequestId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Travel Request Approvals</CardTitle>
          <CardDescription>Manage and review employee travel requests pending approval.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No pending travel requests.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Budget Req.</TableHead>
                  <TableHead>Total Budget</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((request, index) => (
                  <TableRow key={request.id ?? `req-${index}`}>
                    <TableCell className="font-medium">#{request.id}</TableCell>
                    <TableCell>{request.requester_name || "Unknown"}</TableCell>
                    <TableCell>{request.destination}</TableCell>
                    <TableCell>{new Date(request.travel_from).toLocaleDateString()} - {new Date(request.travel_to).toLocaleDateString()}</TableCell>
                    <TableCell>{request.requires_budget ? "Yes" : "No"}</TableCell>
                    <TableCell>{request.requires_budget && request.total_budget ? `₱${request.total_budget.toFixed(2)}` : "-"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => viewDetails(request.id)}>
                        <FileText className="h-4 w-4 mr-1" />
                        Details
                      </Button>
                      <Button variant="default" size="sm" onClick={() => openActionModal(request.id, "approve")} className="bg-green-600 hover:bg-green-700">
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => openActionModal(request.id, "reject")}>
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Action Modal */}
      <Dialog open={selectedRequestId !== null} onOpenChange={(open) => { if (!open && !isSubmitting) setSelectedRequestId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve Travel Request" : "Reject Travel Request"}
            </DialogTitle>
            <DialogDescription>
              Review the details below and provide optional remarks for this action.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {actionRequest && (
              <div className="space-y-3 bg-muted/50 p-4 rounded-md">
                <div>
                  <span className="font-semibold text-sm text-muted-foreground">Requester</span>
                  <p>{actionRequest.requester_name || "Unknown"}</p>
                </div>
                <div>
                  <span className="font-semibold text-sm text-muted-foreground">Destination</span>
                  <p>{actionRequest.destination}</p>
                </div>
                <div>
                  <span className="font-semibold text-sm text-muted-foreground">Dates</span>
                  <p>{new Date(actionRequest.travel_from).toLocaleDateString()} - {new Date(actionRequest.travel_to).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="font-semibold text-sm text-muted-foreground">Purpose</span>
                  <p>{actionRequest.purpose}</p>
                </div>
                {actionRequest.requires_budget && (
                  <div>
                    <span className="font-semibold text-sm text-muted-foreground">Budget</span>
                    <p>₱{actionRequest.total_budget?.toFixed(2) || "0.00"}</p>
                  </div>
                )}
              </div>
            )}
            <Input
              placeholder="Remarks (optional)"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={isSubmitting}
            />
            {actionError && (
              <div className="text-sm text-destructive font-medium p-2 bg-destructive/10 rounded-md">
                {actionError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequestId(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant={actionType === "approve" ? "default" : "destructive"}
              onClick={handleAction}
              disabled={isSubmitting}
              className={actionType === "approve" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Travel Request Details</DialogTitle>
            <DialogDescription className="sr-only">Details of the selected travel request</DialogDescription>
          </DialogHeader>
          {detailsRequest && (
            <div className="space-y-4">
              <div>
                <span className="font-semibold text-sm text-muted-foreground">Requester</span>
                <p>{detailsRequest.requester_name || "Unknown"}</p>
              </div>
              <div>
                <span className="font-semibold text-sm text-muted-foreground">Purpose</span>
                <p>{detailsRequest.purpose}</p>
              </div>
              {detailsRequest.remarks && (
                <div>
                  <span className="font-semibold text-sm text-muted-foreground">Remarks</span>
                  <p>{detailsRequest.remarks}</p>
                </div>
              )}
              {detailsRequest.requires_budget && (
                <div>
                  <span className="font-semibold text-sm text-muted-foreground">Budget Breakdown</span>
                  <ul className="list-disc list-inside mt-1">
                    {detailsRequest.budget_items?.map((item, idx) => (
                      <li key={idx}>COA ID {item.chart_of_account_id}: ₱{item.amount.toFixed(2)}</li>
                    ))}
                  </ul>
                  <div className="mt-2 font-semibold">
                    Total: ₱{detailsRequest.total_budget?.toFixed(2) || "0.00"}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
