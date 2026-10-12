"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ServiceRecordEntry } from "../type";

interface ServiceRecordEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entryData: Omit<ServiceRecordEntry, "service_record_id">) => Promise<void>;
  editingEntry?: ServiceRecordEntry | null;
  userId: number;
}

export function ServiceRecordEntryModal({
  isOpen,
  onClose,
  onSave,
  editingEntry,
  userId,
}: ServiceRecordEntryModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [serviceFrom, setServiceFrom] = useState("");
  const [serviceTo, setServiceTo] = useState("");
  const [isPresent, setIsPresent] = useState(false);
  const [designation, setDesignation] = useState("");
  const [appointmentStatus, setAppointmentStatus] = useState("Reg.Perm.");
  const [salary, setSalary] = useState("");
  const [salaryBasis, setSalaryBasis] = useState("Per Annum");
  const [stationAssignment, setStationAssignment] = useState("");
  const [branch, setBranch] = useState("National");
  const [leaveWoPay, setLeaveWoPay] = useState("None");
  const [cause, setCause] = useState("Orig. Appt.");
  const [remarks, setRemarks] = useState("");
  const [sequenceOrder, setSequenceOrder] = useState("1");

  useEffect(() => {
    if (editingEntry) {
      setServiceFrom(editingEntry.service_from ? editingEntry.service_from.split("T")[0] : "");
      setServiceTo(editingEntry.service_to ? editingEntry.service_to.split("T")[0] : "");
      setIsPresent(!editingEntry.service_to);
      setDesignation(editingEntry.designation || "");
      setAppointmentStatus(editingEntry.appointment_status || "Reg.Perm.");
      setSalary(editingEntry.salary ? String(editingEntry.salary) : "0");
      setSalaryBasis(editingEntry.salary_basis || "Per Annum");
      setStationAssignment(editingEntry.station_assignment || "");
      setBranch(editingEntry.branch || "National");
      setLeaveWoPay(editingEntry.leave_wo_pay || "None");
      setCause(editingEntry.cause || "Orig. Appt.");
      setRemarks(editingEntry.remarks || "");
      setSequenceOrder(String(editingEntry.sequence_order || 1));
    } else {
      setServiceFrom("");
      setServiceTo("");
      setIsPresent(false);
      setDesignation("");
      setAppointmentStatus("Reg.Perm.");
      setSalary("");
      setSalaryBasis("Per Annum");
      setStationAssignment("");
      setBranch("National");
      setLeaveWoPay("None");
      setCause("Orig. Appt.");
      setRemarks("");
      setSequenceOrder("1");
    }
  }, [editingEntry, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceFrom || !designation) return;

    try {
      setIsSubmitting(true);
      await onSave({
        user_id: userId,
        service_from: serviceFrom,
        service_to: isPresent ? null : (serviceTo || null),
        designation: designation.trim(),
        appointment_status: appointmentStatus,
        salary: parseFloat(salary) || 0,
        salary_basis: salaryBasis,
        station_assignment: stationAssignment.trim(),
        branch,
        leave_wo_pay: leaveWoPay.trim() || "None",
        cause,
        remarks: remarks.trim() || null,
        sequence_order: parseInt(sequenceOrder, 10) || 1,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black tracking-tight">
            {editingEntry ? "Edit Appointment / Service Entry" : "Add Service Record Entry"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Fill in the details for this appointment, salary adjustment (NOSA), or step increment (NOSI).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Services Period (From / To) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Service From (Start Date) *</Label>
              <Input
                type="date"
                required
                value={serviceFrom}
                onChange={(e) => setServiceFrom(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">Service To (End Date)</Label>
                <label className="text-[10px] flex items-center gap-1 font-semibold text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPresent}
                    onChange={(e) => setIsPresent(e.target.checked)}
                    className="rounded border-border"
                  />
                  Present
                </label>
              </div>
              <Input
                type="date"
                disabled={isPresent}
                value={isPresent ? "" : serviceTo}
                onChange={(e) => setServiceTo(e.target.value)}
                placeholder={isPresent ? "Present (Active)" : ""}
                className="h-9 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Designation & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Designation (Position) *</Label>
              <Input
                placeholder="e.g. ADOF II, Teacher I"
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Appointment Status</Label>
              <Select value={appointmentStatus} onValueChange={setAppointmentStatus}>
                <SelectTrigger className="h-9 rounded-xl text-xs">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Reg.Perm.">Reg.Perm. (Regular / Permanent)</SelectItem>
                  <SelectItem value="Probationary">Probationary</SelectItem>
                  <SelectItem value="Casual">Casual</SelectItem>
                  <SelectItem value="Contractual">Contractual</SelectItem>
                  <SelectItem value="Job Order">Job Order</SelectItem>
                  <SelectItem value="Co-terminus">Co-terminus</SelectItem>
                  <SelectItem value="Elective">Elective</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Salary & Salary Basis */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Salary (Amount in PHP) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 235440.00"
                required
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                className="h-9 rounded-xl text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Salary Basis</Label>
              <Select value={salaryBasis} onValueChange={setSalaryBasis}>
                <SelectTrigger className="h-9 rounded-xl text-xs">
                  <SelectValue placeholder="Basis" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Per Annum">Per Annum (Annual)</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Daily">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Station & Branch */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Station / Place of Assignment</Label>
              <Input
                placeholder="e.g. San Julian NHS-SHS"
                value={stationAssignment}
                onChange={(e) => setStationAssignment(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Branch</Label>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger className="h-9 rounded-xl text-xs">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="National">National</SelectItem>
                  <SelectItem value="NM">NM (National/Municipal)</SelectItem>
                  <SelectItem value="Local">Local</SelectItem>
                  <SelectItem value="Provincial">Provincial</SelectItem>
                  <SelectItem value="City">City</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* L/Abs w/o pay & Cause */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Leave w/o Pay (L/Abs. w/o pay)</Label>
              <Input
                placeholder="e.g. None or dates"
                value={leaveWoPay}
                onChange={(e) => setLeaveWoPay(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Cause / Action</Label>
              <Select value={cause} onValueChange={setCause}>
                <SelectTrigger className="h-9 rounded-xl text-xs">
                  <SelectValue placeholder="Cause" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Orig. Appt.">Orig. Appt. (Original Appointment)</SelectItem>
                  <SelectItem value="NOSA">NOSA (Notice of Salary Adjustment)</SelectItem>
                  <SelectItem value="NOSI">NOSI (Notice of Step Increment)</SelectItem>
                  <SelectItem value="Promotion">Promotion</SelectItem>
                  <SelectItem value="Transfer">Transfer</SelectItem>
                  <SelectItem value="Reappointment">Reappointment</SelectItem>
                  <SelectItem value="Resignation">Resignation</SelectItem>
                  <SelectItem value="Retirement">Retirement</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Remarks (Optional)</Label>
            <Input
              placeholder="e.g. Item No. 1234, Resolution No. ..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="h-9 rounded-xl text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl h-9 text-xs font-bold bg-primary text-primary-foreground"
            >
              {isSubmitting ? "Saving..." : editingEntry ? "Update Entry" : "Add Entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
