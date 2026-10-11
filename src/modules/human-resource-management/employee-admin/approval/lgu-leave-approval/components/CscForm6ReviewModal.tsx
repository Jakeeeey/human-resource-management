"use client";

import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  UserCheck,
  Layers,
} from "lucide-react";
import {
  LguLeaveRequest,
  CSC_LEAVE_TYPES,
  LguLeaveActionPayload,
} from "../types";

interface CscForm6ReviewModalProps {
  request: LguLeaveRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitAction: (action: LguLeaveActionPayload) => Promise<void>;
  currentUser?: {
    userId: number;
    userName: string;
    isAdmin: boolean;
  };
}

export function CscForm6ReviewModal({
  request,
  isOpen,
  onClose,
  onSubmitAction,
  currentUser,
}: CscForm6ReviewModalProps) {
  const [activeTab, setActiveTab] = useState<"form6" | "action">("form6");
  const [submitting, setSubmitting] = useState(false);

  // Stage 2 - HR Credit Verification State
  const [creditsAsOf, setCreditsAsOf] = useState("");
  const [vlTotalEarned, setVlTotalEarned] = useState<number>(0);
  const [vlLessApplied, setVlLessApplied] = useState<number>(0);
  const [vlBalance, setVlBalance] = useState<number>(0);
  const [slTotalEarned, setSlTotalEarned] = useState<number>(0);
  const [slLessApplied, setSlLessApplied] = useState<number>(0);
  const [slBalance, setSlBalance] = useState<number>(0);
  const [certifiedByName, setCertifiedByName] = useState("");

  // Stage 3 - Supervisor Recommendation State
  const [recommendation, setRecommendation] = useState<"for_approval" | "for_disapproval">("for_approval");
  const [recommendationReason, setRecommendationReason] = useState("");
  const [recommendedByName, setRecommendedByName] = useState("");

  // Stage 4 - Final Action State
  const [finalActionType, setFinalActionType] = useState<"approve" | "disapprove">("approve");
  const [approvedDaysWithPay, setApprovedDaysWithPay] = useState<number>(0);
  const [approvedDaysWithoutPay, setApprovedDaysWithoutPay] = useState<number>(0);
  const [disapprovedDueTo, setDisapprovedDueTo] = useState("");
  const [actionOfficerName, setActionOfficerName] = useState("");
  const [actionDate, setActionDate] = useState("");

  useEffect(() => {
    if (request) {
      // Initialize Section 7.A
      setCreditsAsOf(request.credits_as_of || new Date().toISOString().slice(0, 10));
      const vlTotal = request.vl_total_earned ?? 15.0;
      const vlLess = request.leave_type === "vacation" || request.leave_type === "mandatory_forced" ? request.working_days_applied : (request.vl_less_applied ?? 0);
      setVlTotalEarned(vlTotal);
      setVlLessApplied(vlLess);
      setVlBalance(request.vl_balance ?? Math.max(0, vlTotal - vlLess));

      const slTotal = request.sl_total_earned ?? 15.0;
      const slLess = request.leave_type === "sick" ? request.working_days_applied : (request.sl_less_applied ?? 0);
      setSlTotalEarned(slTotal);
      setSlLessApplied(slLess);
      setSlBalance(request.sl_balance ?? Math.max(0, slTotal - slLess));

      setCertifiedByName(request.certified_by_name || currentUser?.userName || "HRMO Officer");

      // Initialize Section 7.B
      setRecommendation(request.recommendation || "for_approval");
      setRecommendationReason(request.recommendation_reason || "");
      setRecommendedByName(request.recommended_by_name || currentUser?.userName || "Immediate Supervisor");

      // Initialize Section 7.C & 7.D
      setApprovedDaysWithPay(request.approved_days_with_pay ?? request.working_days_applied);
      setApprovedDaysWithoutPay(request.approved_days_without_pay ?? 0);
      setDisapprovedDueTo(request.disapproved_due_to || "");
      setActionOfficerName(request.action_officer_name || "Hon. Municipal Mayor");
      setActionDate(request.action_date || new Date().toISOString().slice(0, 10));
    }
  }, [request, currentUser]);

  // Recalculate balances automatically
  const handleVlTotalChange = (val: number) => {
    setVlTotalEarned(val);
    setVlBalance(Math.max(0, val - vlLessApplied));
  };
  const handleVlLessChange = (val: number) => {
    setVlLessApplied(val);
    setVlBalance(Math.max(0, vlTotalEarned - val));
  };
  const handleSlTotalChange = (val: number) => {
    setSlTotalEarned(val);
    setSlBalance(Math.max(0, val - slLessApplied));
  };
  const handleSlLessChange = (val: number) => {
    setSlLessApplied(val);
    setSlBalance(Math.max(0, slTotalEarned - val));
  };

  if (!request) return null;

  const leaveConfig = CSC_LEAVE_TYPES.find((t) => t.code === request.leave_type);

  // Submit Section 7.A (HR Certification)
  const handleCertify = async () => {
    try {
      setSubmitting(true);
      await onSubmitAction({
        type: "certify",
        payload: {
          request_id: request.id,
          credits_as_of: creditsAsOf,
          vl_total_earned: vlTotalEarned,
          vl_less_applied: vlLessApplied,
          vl_balance: vlBalance,
          sl_total_earned: slTotalEarned,
          sl_less_applied: slLessApplied,
          sl_balance: slBalance,
          certified_by_name: certifiedByName,
        },
      });
      toast.success("Leave credits verified and certified successfully.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to certify credits");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Section 7.B (Supervisor Recommendation)
  const handleRecommend = async () => {
    try {
      setSubmitting(true);
      await onSubmitAction({
        type: "recommend",
        payload: {
          request_id: request.id,
          recommendation: recommendation,
          recommendation_reason: recommendationReason,
          recommended_by_name: recommendedByName,
        },
      });
      toast.success(
        recommendation === "for_approval"
          ? "Endorsed for approval and escalated to next approval stage."
          : "Recommended for disapproval."
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit recommendation");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Section 7.C & 7.D (Final Action / Mayor)
  const handleFinalAction = async () => {
    try {
      setSubmitting(true);
      await onSubmitAction({
        type: "final_action",
        payload: {
          request_id: request.id,
          action: finalActionType,
          approved_days_with_pay: approvedDaysWithPay,
          approved_days_without_pay: approvedDaysWithoutPay,
          disapproved_due_to: disapprovedDueTo,
          action_officer_name: actionOfficerName,
          action_date: actionDate,
        },
      });
      toast.success(
        finalActionType === "approve"
          ? "CSC Form No. 6 leave application has been officially APPROVED."
          : "CSC Form No. 6 leave application has been DISAPPROVED."
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to execute final action");
    } finally {
      setSubmitting(false);
    }
  };

  const isFinalApprovalStage =
    request.current_approval_level >= (request.total_levels || 2) ||
    request.status === "recommended";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-4xl md:max-w-5xl lg:max-w-6xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-2 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <FileText className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  Civil Service Commission Form No. 6
                  <Badge variant="outline" className="text-xs bg-emerald-500/20 text-emerald-300 border-emerald-400/30">
                    Revised 2020
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-slate-300 text-xs">
                  Official Application for Leave & Approval Processing Review
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs px-2.5 py-1 uppercase tracking-wider font-semibold ${
                  request.status === "approved"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-400"
                    : request.status === "recommended"
                    ? "bg-blue-500/20 text-blue-300 border-blue-400"
                    : request.status === "disapproved"
                    ? "bg-rose-500/20 text-rose-300 border-rose-400"
                    : "bg-amber-500/20 text-amber-300 border-amber-400"
                }`}
              >
                {request.status}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Level {request.current_approval_level} of {request.total_levels || 2}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 pt-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "form6" | "action")}>
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="form6" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                CSC Form 6 Replica
              </TabsTrigger>
              <TabsTrigger value="action" className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Approval Hierarchy & Actions
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: FORM 6 PAPER REPLICA */}
            <TabsContent value="form6" className="space-y-4">
              <div className="border rounded-lg p-5 bg-card shadow-sm space-y-6">
                {/* Government Header */}
                <div className="text-center border-b pb-4">
                  <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Republic of the Philippines
                  </p>
                  <h3 className="text-lg font-bold tracking-tight text-foreground">
                    APPLICATION FOR LEAVE
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Civil Service Commission Form No. 6 (Revised 2020)
                  </p>
                </div>

                {/* Section 6 - DETAILS OF APPLICATION */}
                <div>
                  <div className="bg-muted/70 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>6. Details of Application</span>
                    <span className="text-muted-foreground font-normal">Date of Filing: {request.date_of_filing}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="p-3 bg-muted/30 rounded border">
                      <p className="text-xs text-muted-foreground font-medium">1. Office / Department</p>
                      <p className="font-semibold text-foreground mt-0.5">{request.office_department}</p>
                    </div>
                    <div className="p-3 bg-muted/30 rounded border">
                      <p className="text-xs text-muted-foreground font-medium">2. Name of Applicant</p>
                      <p className="font-semibold text-foreground mt-0.5">
                        {request.last_name}, {request.first_name} {request.middle_name || ""}
                      </p>
                    </div>
                    <div className="p-3 bg-muted/30 rounded border">
                      <p className="text-xs text-muted-foreground font-medium">3. Position & Salary</p>
                      <p className="font-semibold text-foreground mt-0.5">{request.position}</p>
                      <p className="text-xs text-muted-foreground">₱{request.monthly_salary.toLocaleString()} / month</p>
                    </div>
                  </div>
                </div>

                {/* Section 6.A & 6.B */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 6.A Leave Type */}
                  <div className="border rounded-md p-3.5 space-y-2">
                    <p className="text-xs font-bold uppercase text-muted-foreground">
                      6.A Type of Leave to be Availed Of
                    </p>
                    <div className="flex items-start gap-2 pt-1">
                      <div className="p-1.5 bg-primary/10 text-primary rounded">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{leaveConfig?.title || request.leave_type}</p>
                        <p className="text-xs text-muted-foreground italic mt-0.5">{leaveConfig?.legalBasis}</p>
                        {request.leave_type === "others" && request.leave_type_others && (
                          <p className="text-xs text-primary font-medium mt-1">Specific: {request.leave_type_others}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 6.B Details of Leave */}
                  <div className="border rounded-md p-3.5 space-y-2">
                    <p className="text-xs font-bold uppercase text-muted-foreground">
                      6.B Details of Leave Applied
                    </p>
                    <div className="text-xs space-y-1.5 pt-1">
                      {request.vacation_location && (
                        <div>
                          <span className="text-muted-foreground font-medium">Vacation Location: </span>
                          <span className="font-semibold capitalize text-foreground">
                            {request.vacation_location === "abroad"
                              ? `Abroad (${request.vacation_location_abroad || "Specified Destination"})`
                              : "Within the Philippines"}
                          </span>
                        </div>
                      )}
                      {request.sick_location && (
                        <div>
                          <span className="text-muted-foreground font-medium">Sick Location & Illness: </span>
                          <span className="font-semibold capitalize text-foreground">
                            {request.sick_location === "in_hospital" ? "In Hospital" : "Out-Patient"}
                            {request.sick_illness_specify ? ` — ${request.sick_illness_specify}` : ""}
                          </span>
                        </div>
                      )}
                      {request.women_illness_specify && (
                        <div>
                          <span className="text-muted-foreground font-medium">Gynecological Condition: </span>
                          <span className="font-semibold text-foreground">{request.women_illness_specify}</span>
                        </div>
                      )}
                      {request.study_purpose && (
                        <div>
                          <span className="text-muted-foreground font-medium">Study Purpose: </span>
                          <span className="font-semibold capitalize text-foreground">
                            {request.study_purpose === "masters_degree" ? "Master's Degree Completion" : "BAR / Board Exam Review"}
                          </span>
                        </div>
                      )}
                      {request.other_purpose && (
                        <div>
                          <span className="text-muted-foreground font-medium">Other Purpose: </span>
                          <span className="font-semibold text-foreground">{request.other_purpose}</span>
                        </div>
                      )}
                      {!request.vacation_location && !request.sick_location && !request.women_illness_specify && (
                        <p className="text-muted-foreground italic">Standard statutory filing requirements met.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 6.C & 6.D */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-md p-3.5 space-y-1.5">
                    <p className="text-xs font-bold uppercase text-muted-foreground">
                      6.C Number of Working Days Applied For
                    </p>
                    <p className="text-lg font-bold text-foreground">
                      {request.working_days_applied} {request.working_days_applied === 1 ? "Working Day" : "Working Days"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Inclusive Dates: <span className="font-semibold text-foreground">{request.start_date}</span> to{" "}
                      <span className="font-semibold text-foreground">{request.end_date}</span>
                    </p>
                  </div>

                  <div className="border rounded-md p-3.5 space-y-1.5">
                    <p className="text-xs font-bold uppercase text-muted-foreground">
                      6.D Commutation Requested
                    </p>
                    <p className="text-base font-semibold text-foreground">
                      {request.commutation_requested ? "Requested (For Monetization)" : "Not Requested"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Signature of Applicant: <span className="italic font-medium">{request.first_name} {request.last_name} (Digitally Filed)</span>
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Section 7 - DETAILS OF ACTION ON APPLICATION */}
                <div>
                  <div className="bg-muted/70 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider mb-3">
                    7. Details of Action on Application
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 7.A Certification */}
                    <div className="border rounded-md p-3.5 space-y-2">
                      <p className="text-xs font-bold uppercase text-muted-foreground">
                        7.A Certification of Leave Credits
                      </p>
                      <p className="text-xs text-muted-foreground">As of: <span className="font-medium">{request.credits_as_of || "Current"}</span></p>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="border-b bg-muted/40">
                              <th className="py-1 px-2 font-medium">Credit</th>
                              <th className="py-1 px-2 font-medium text-right">Earned</th>
                              <th className="py-1 px-2 font-medium text-right">Less</th>
                              <th className="py-1 px-2 font-medium text-right">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="py-1 px-2 font-medium">Vacation Leave</td>
                              <td className="py-1 px-2 text-right">{request.vl_total_earned ?? 0}</td>
                              <td className="py-1 px-2 text-right text-rose-500">-{request.vl_less_applied ?? 0}</td>
                              <td className="py-1 px-2 text-right font-bold text-emerald-600">{request.vl_balance ?? 0}</td>
                            </tr>
                            <tr>
                              <td className="py-1 px-2 font-medium">Sick Leave</td>
                              <td className="py-1 px-2 text-right">{request.sl_total_earned ?? 0}</td>
                              <td className="py-1 px-2 text-right text-rose-500">-{request.sl_less_applied ?? 0}</td>
                              <td className="py-1 px-2 text-right font-bold text-emerald-600">{request.sl_balance ?? 0}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-muted-foreground pt-1">
                        Certified by: <span className="font-semibold text-foreground">{request.certified_by_name || "HRMO Staff"}</span>
                      </p>
                    </div>

                    {/* 7.B Recommendation & 7.C Final Action */}
                    <div className="border rounded-md p-3.5 space-y-3">
                      <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground">
                          7.B Recommendation
                        </p>
                        <p className="text-xs font-semibold mt-0.5">
                          {request.recommendation === "for_approval" ? (
                            <span className="text-emerald-600">✓ For Approval</span>
                          ) : request.recommendation === "for_disapproval" ? (
                            <span className="text-rose-600">✗ For Disapproval</span>
                          ) : (
                            <span className="text-muted-foreground italic">Pending Recommendation</span>
                          )}
                        </p>
                        {request.recommendation_reason && (
                          <p className="text-xs text-muted-foreground italic mt-0.5">Reason: {request.recommendation_reason}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Recommending Officer: <span className="font-medium text-foreground">{request.recommended_by_name || "Immediate Supervisor"}</span>
                        </p>
                      </div>

                      <Separator />

                      <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground">
                          7.C & 7.D Final Action
                        </p>
                        <p className="text-xs font-semibold mt-0.5">
                          {request.status === "approved" ? (
                            <span className="text-emerald-600">
                              Approved: {request.approved_days_with_pay ?? request.working_days_applied} days with pay, {request.approved_days_without_pay ?? 0} days without pay
                            </span>
                          ) : request.status === "disapproved" ? (
                            <span className="text-rose-600">Disapproved: {request.disapproved_due_to || "By Head of Agency"}</span>
                          ) : (
                            <span className="text-amber-600 font-medium">Pending Final Executive Action</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Action Officer: <span className="font-medium text-foreground">{request.action_officer_name || "Hon. Municipal Mayor"}</span>
                          {request.action_date && <span> ({request.action_date})</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: APPROVAL ACTIONS */}
            <TabsContent value="action" className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-6">
                  {/* Approval Hierarchy Tracker */}
                  <div className="bg-muted/40 p-3.5 rounded-lg border">
                    <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-2 flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-primary" />
                      Approval Hierarchy Progress
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                      <div className={`p-2.5 rounded border ${request.current_approval_level >= 1 ? "bg-primary/10 border-primary/30" : "bg-card"}`}>
                        <div className="flex items-center justify-between font-semibold">
                          <span>Level 1: Supervisor</span>
                          {request.recommendation ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Clock className="h-3.5 w-3.5 text-amber-500" />}
                        </div>
                        <p className="text-muted-foreground mt-1 text-[11px]">Recommendation (7.B)</p>
                      </div>

                      <div className={`p-2.5 rounded border ${request.credits_as_of ? "bg-primary/10 border-primary/30" : "bg-card"}`}>
                        <div className="flex items-center justify-between font-semibold">
                          <span>Level 2: HRMO</span>
                          {request.credits_as_of ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Clock className="h-3.5 w-3.5 text-amber-500" />}
                        </div>
                        <p className="text-muted-foreground mt-1 text-[11px]">Credit Certification (7.A)</p>
                      </div>

                      <div className={`p-2.5 rounded border ${request.status === "approved" || request.status === "disapproved" ? "bg-primary/10 border-primary/30" : "bg-card"}`}>
                        <div className="flex items-center justify-between font-semibold">
                          <span>Level 3: Head of Agency</span>
                          {request.status === "approved" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Clock className="h-3.5 w-3.5 text-amber-500" />}
                        </div>
                        <p className="text-muted-foreground mt-1 text-[11px]">Final Action (Mayor)</p>
                      </div>
                    </div>
                  </div>

                  {/* STAGE 2: HR CREDIT CERTIFICATION PANEL */}
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        Stage 2: HR Credit Certification (Section 7.A)
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        HRMO Officer
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Credits As Of Date</Label>
                        <Input
                          type="date"
                          value={creditsAsOf}
                          onChange={(e) => setCreditsAsOf(e.target.value)}
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs">Certifying HRMO Officer</Label>
                        <Input
                          value={certifiedByName}
                          onChange={(e) => setCertifiedByName(e.target.value)}
                          className="h-8 text-xs mt-1"
                          placeholder="e.g. Maria Clara (HRMO IV)"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {/* VL */}
                      <div className="p-3 bg-card border rounded-md space-y-2">
                        <p className="text-xs font-semibold text-primary">Vacation Leave (VL) Credits</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <Label className="text-[11px]">Total Earned</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={vlTotalEarned}
                              onChange={(e) => handleVlTotalChange(parseFloat(e.target.value) || 0)}
                              className="h-7 text-xs mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px]">Less Applied</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={vlLessApplied}
                              onChange={(e) => handleVlLessChange(parseFloat(e.target.value) || 0)}
                              className="h-7 text-xs mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px]">Balance</Label>
                            <Input
                              type="number"
                              readOnly
                              value={vlBalance}
                              className="h-7 text-xs mt-1 bg-muted font-bold text-emerald-600"
                            />
                          </div>
                        </div>
                      </div>

                      {/* SL */}
                      <div className="p-3 bg-card border rounded-md space-y-2">
                        <p className="text-xs font-semibold text-primary">Sick Leave (SL) Credits</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <Label className="text-[11px]">Total Earned</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={slTotalEarned}
                              onChange={(e) => handleSlTotalChange(parseFloat(e.target.value) || 0)}
                              className="h-7 text-xs mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px]">Less Applied</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={slLessApplied}
                              onChange={(e) => handleSlLessChange(parseFloat(e.target.value) || 0)}
                              className="h-7 text-xs mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px]">Balance</Label>
                            <Input
                              type="number"
                              readOnly
                              value={slBalance}
                              className="h-7 text-xs mt-1 bg-muted font-bold text-emerald-600"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCertify}
                        disabled={submitting}
                        className="text-xs h-8"
                      >
                        Update & Certify Credits
                      </Button>
                    </div>
                  </div>

                  {/* STAGE 3: SUPERVISOR RECOMMENDATION PANEL */}
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-emerald-500" />
                        Stage 3: Immediate Supervisor Recommendation (Section 7.B)
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        Level 1 / Supervisor
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Recommendation Decision</Label>
                        <div className="flex items-center gap-4 mt-2">
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="radio"
                              name="rec"
                              checked={recommendation === "for_approval"}
                              onChange={() => setRecommendation("for_approval")}
                              className="text-primary"
                            />
                            <span className="font-semibold text-emerald-600">For Approval</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="radio"
                              name="rec"
                              checked={recommendation === "for_disapproval"}
                              onChange={() => setRecommendation("for_disapproval")}
                              className="text-rose-500"
                            />
                            <span className="font-semibold text-rose-600">For Disapproval</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Recommending Officer Name</Label>
                        <Input
                          value={recommendedByName}
                          onChange={(e) => setRecommendedByName(e.target.value)}
                          className="h-8 text-xs mt-1"
                          placeholder="e.g. Engr. Juan Perez"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">Recommendation Remarks / Justification</Label>
                      <Textarea
                        value={recommendationReason}
                        onChange={(e) => setRecommendationReason(e.target.value)}
                        placeholder="State endorsement or reason for disapproval..."
                        className="text-xs h-16 mt-1"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button
                        size="sm"
                        onClick={handleRecommend}
                        disabled={submitting}
                        className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Submit Recommendation & Advance
                      </Button>
                    </div>
                  </div>

                  {/* STAGE 4: FINAL EXECUTIVE ACTION PANEL (MAYOR / HEAD OF AGENCY) */}
                  <div className={`border rounded-lg p-4 space-y-3 ${isFinalApprovalStage ? "bg-purple-500/5 border-purple-500/30 ring-1 ring-purple-500/20" : "bg-muted/20"}`}>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-purple-500" />
                        Stage 4: Final Executive Action (Section 7.C & 7.D)
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        Mayor / Head of Agency
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Action Officer</Label>
                        <Input
                          value={actionOfficerName}
                          onChange={(e) => setActionOfficerName(e.target.value)}
                          className="h-8 text-xs mt-1"
                          placeholder="e.g. Hon. Municipal Mayor"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Action Date</Label>
                        <Input
                          type="date"
                          value={actionDate}
                          onChange={(e) => setActionDate(e.target.value)}
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Decision</Label>
                        <div className="flex items-center gap-3 mt-2">
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input
                              type="radio"
                              name="finalAction"
                              checked={finalActionType === "approve"}
                              onChange={() => setFinalActionType("approve")}
                            />
                            <span className="font-bold text-emerald-600">Approve</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input
                              type="radio"
                              name="finalAction"
                              checked={finalActionType === "disapprove"}
                              onChange={() => setFinalActionType("disapprove")}
                            />
                            <span className="font-bold text-rose-600">Disapprove</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {finalActionType === "approve" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                        <div>
                          <Label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                            Approved Days WITH Pay
                          </Label>
                          <Input
                            type="number"
                            step="0.5"
                            value={approvedDaysWithPay}
                            onChange={(e) => setApprovedDaysWithPay(parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs mt-1 bg-background"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                            Approved Days WITHOUT Pay
                          </Label>
                          <Input
                            type="number"
                            step="0.5"
                            value={approvedDaysWithoutPay}
                            onChange={(e) => setApprovedDaysWithoutPay(parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs mt-1 bg-background"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-md">
                        <Label className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                          Disapproved Due To (State Specific Reason)
                        </Label>
                        <Textarea
                          value={disapprovedDueTo}
                          onChange={(e) => setDisapprovedDueTo(e.target.value)}
                          placeholder="e.g. Exigency of public service, lack of available leave credits, etc."
                          className="h-16 text-xs mt-1 bg-background"
                        />
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <Button
                        size="sm"
                        onClick={handleFinalAction}
                        disabled={submitting}
                        className={`text-xs h-8 ${
                          finalActionType === "approve"
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-rose-600 hover:bg-rose-700 text-white"
                        }`}
                      >
                        {finalActionType === "approve" ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Execute Final Approval
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Execute Final Disapproval
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-4 bg-muted/30 border-t flex items-center justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>Filing ID #{request.id} • Filed on {request.date_of_filing}</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
