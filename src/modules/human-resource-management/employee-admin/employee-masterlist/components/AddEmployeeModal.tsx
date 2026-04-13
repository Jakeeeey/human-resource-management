"use client";

import React, { useRef, useState, useEffect } from "react";
import imageCompression from "browser-image-compression";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Briefcase,
  Phone,
  Mail,
  Lock,
  CalendarDays,
  MapPin,
  CreditCard,
  ImagePlus,
  PenLine,
  Loader2,
  UserPlus,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Department } from "../types";
import { AddressSelectors } from "./AddressSelectors";

const UPLOAD_API = "/api/hrm/employee-admin/employee-master-list/upload";
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Compress and upload a File to Directus /files. Returns the UUID string. */
async function uploadToDirectus(file: File, type: "profile" | "signature"): Promise<string> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
  });
  const fd = new FormData();
  fd.append("file", compressed, file.name);
  const res = await fetch(`${UPLOAD_API}?type=${type}`, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Image upload failed");
  const json = await res.json();
  const id = json?.data?.id;
  if (!id) throw new Error("Directus did not return a file ID");
  return id as string;
}

/** Convert canvas to a Blob and upload. Returns UUID or null if canvas is blank. */
async function uploadCanvasToDirectus(
  canvas: HTMLCanvasElement
): Promise<string | null> {
  // Check if canvas has any drawn content
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const hasContent = imageData.data.some(
    (v, i) => i % 4 === 3 && v > 0 // any non-transparent pixel
  );
  if (!hasContent) return null;

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error("Canvas export failed"));
      const file = new File([blob], "signature_pad.png", { type: "image/png" });
      try {
        resolve(await uploadToDirectus(file, "signature"));
      } catch (e) {
        reject(e);
      }
    }, "image/png");
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NewEmployeeFormData {
  // Personal
  user_fname: string;
  user_mname: string;
  user_lname: string;
  suffix_name: string;
  nickname: string;
  user_contact: string;
  user_bday: string;
  gender: string;
  gender_specify: string;
  civil_status: string;
  nationality: string;
  place_of_birth: string;
  blood_type: string;
  religion: string;
  spouse_name: string;
  // Address
  user_province: string;
  user_city: string;
  user_brgy: string;
  // Emergency
  emergency_contact_name: string;
  emergency_contact_number: string;
  // Work & Account
  user_department: string;
  user_position: string;
  user_email: string;
  user_password: string;
  user_dateOfHire: string;
  rf_id: string;
  biometric_id: string;
  user_tin: string;
  user_sss: string;
  user_philhealth: string;
  user_pagibig: string;
  isAdmin: boolean;
  role: string;
  // Media
  user_image: File | null;
  signature: File | null;
}

export interface AddEmployeeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Department[];
  onSubmit: (data: NewEmployeeFormData & { _userImageId?: string; _signatureId?: string }) => Promise<void>;
}

// ─── Sub-section header ───────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  color = "text-primary",
  bg = "bg-primary/5",
}: {
  icon: React.ElementType;
  title: string;
  color?: string;
  bg?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn("p-2 rounded-lg", bg)}>
        <Icon className={cn("h-4 w-4", color)} />
      </div>
      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">
        {title}
      </h3>
    </div>
  );
}

// ─── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-[12px] font-semibold text-foreground/70">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}

const inputCls =
  "h-10 bg-muted/40 border-transparent focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 rounded-xl text-sm";

// ─── Main Component ────────────────────────────────────────────────────────────

const EMPTY_FORM: NewEmployeeFormData = {
  user_fname: "",
  user_mname: "",
  user_lname: "",
  suffix_name: "",
  nickname: "",
  user_contact: "",
  user_bday: "",
  gender: "",
  gender_specify: "",
  civil_status: "",
  nationality: "",
  place_of_birth: "",
  blood_type: "",
  religion: "",
  spouse_name: "",
  user_province: "",
  user_city: "",
  user_brgy: "",
  emergency_contact_name: "",
  emergency_contact_number: "",
  user_department: "",
  user_position: "",
  user_email: "",
  user_password: "",
  user_dateOfHire: "",
  rf_id: "",
  biometric_id: "",
  user_tin: "",
  user_sss: "",
  user_philhealth: "",
  user_pagibig: "",
  isAdmin: false,
  role: "USER",
  user_image: null,
  signature: null,
};

export function AddEmployeeModal({
  isOpen,
  onOpenChange,
  departments,
  onSubmit,
}: AddEmployeeModalProps) {
  const [form, setForm] = useState<NewEmployeeFormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emergencyPhoneError, setEmergencyPhoneError] = useState<string | null>(null);

  // Signature pad
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  // File input refs — avoids Radix Dialog white-screen bug with <label> wrappers
  const imageInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef   = useRef<HTMLInputElement>(null);

  // Image previews
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sigPreview, setSigPreview] = useState<string | null>(null);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setForm(EMPTY_FORM);
      setImagePreview(null);
      setSigPreview(null);
      setPasswordError(null);
      setPhoneError(null);
      setEmergencyPhoneError(null);
      clearCanvas();
    }
  }, [isOpen]);

  // ── Password validation (mirrors Spring Boot rules) ──
  function validatePassword(pwd: string): string | null {
    if (!pwd) return "Password is required";
    if (pwd.length < 15) return "Password must be at least 15 characters long.";
    if (pwd.length > 64) return "Password must not exceed 64 characters.";
    if (!/[a-z]/.test(pwd)) return "Password must contain at least one lowercase letter.";
    if (!/[A-Z]/.test(pwd)) return "Password must contain at least one uppercase letter.";
    if (!/\d/.test(pwd))    return "Password must contain at least one digit.";
    if (!/[@$!%*?&]/.test(pwd)) return "Password must contain at least one special character (@$!%*?&).";
    return null;
  }

  function validatePhone(phone: string, required = true): string | null {
    if (!phone) return required ? "Phone number is required" : null;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length !== 11) return "Phone number must be exactly 11 digits.";
    return null;
  }

  // ── Helpers ──

  function set<K extends keyof NewEmployeeFormData>(
    key: K,
    value: NewEmployeeFormData[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleFileChange(
    key: "user_image" | "signature",
    file: File | null
  ) {
    if (file && file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    set(key, file as NewEmployeeFormData[typeof key]);
    if (file) {
      const url = URL.createObjectURL(file);
      if (key === "user_image") {
        setImagePreview(url);
      } else {
        setSigPreview(url);
      }
    } else {
      if (key === "user_image") {
        setImagePreview(null);
      } else {
        setSigPreview(null);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Client-side password guard
    const pwdErr = validatePassword(form.user_password);
    if (pwdErr) {
      setPasswordError(pwdErr);
      return;
    }

    const phoneErr = validatePhone(form.user_contact);
    if (phoneErr) {
      setPhoneError(phoneErr);
      return;
    }

    const emergencyErr = validatePhone(form.emergency_contact_number, false);
    if (emergencyErr) {
      setEmergencyPhoneError(emergencyErr);
      return;
    }

    setIsSubmitting(true);
    try {
      // ── Step 1: Upload images to Directus /files ──
      let userImageId: string | undefined;
      let signatureId: string | undefined;

      if (form.user_image) {
        userImageId = await uploadToDirectus(form.user_image, "profile");
      }

      // Prefer uploaded signature file; fall back to drawn pad
      if (form.signature) {
        signatureId = await uploadToDirectus(form.signature, "signature");
      } else if (canvasRef.current) {
        const padId = await uploadCanvasToDirectus(canvasRef.current);
        if (padId) signatureId = padId;
      }

      // ── Step 2: Pass enriched form data to parent ──
      await onSubmit({ 
        ...form, 
        user_image: null, 
        signature: null, 
        _userImageId: userImageId, 
        _signatureId: signatureId 
      });
      onOpenChange(false);
    } catch {
      // error handled in parent hook (toast)
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Signature pad ──

  function getPos(
    canvas: HTMLCanvasElement,
    e: React.MouseEvent | React.TouchEvent
  ) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX =
      "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY =
      "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    isDrawingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.preventDefault();
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(canvas, e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    e.preventDefault();
  }

  function stopDraw() {
    isDrawingRef.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ── Render ──

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 border-none shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[80vh]"
        style={{ maxWidth: "40vw", width: "90vw" }}
      >
        {/* ── Header ── */}
        <div className="p-6 pb-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent flex items-center gap-4 shrink-0">
          <div className="p-3 bg-white dark:bg-background rounded-2xl shadow-sm ring-1 ring-black/5">
            <UserPlus className="h-6 w-6 text-primary" />
          </div>
          <div>
            <DialogTitle className="text-xl font-extrabold tracking-tight">
              Add New Employee
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mt-0.5">
              Human Resource Management
            </DialogDescription>
          </div>
        </div>

        {/* ── Body ── */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 pb-4 pt-2 space-y-8">
            {/* ── Personal Information ── */}
            <section>
              <SectionHeader
                icon={User}
                title="Personal Information"
                color="text-blue-500"
                bg="bg-blue-50/60"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="First Name" required>
                  <Input
                    className={inputCls}
                    value={form.user_fname}
                    onChange={(e) => set("user_fname", e.target.value)}
                    placeholder="Juan"
                    required
                  />
                </Field>
                <Field label="Middle Name">
                  <Input
                    className={inputCls}
                    value={form.user_mname}
                    onChange={(e) => set("user_mname", e.target.value)}
                    placeholder="Dela"
                  />
                </Field>
                <Field label="Last Name" required>
                  <Input
                    className={inputCls}
                    value={form.user_lname}
                    onChange={(e) => set("user_lname", e.target.value)}
                    placeholder="Cruz"
                    required
                  />
                </Field>
                <Field label="Contact Number" required>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                    <Input
                      className={cn(
                        inputCls, 
                        "pl-9",
                        phoneError && "border-red-500 focus-visible:ring-red-500/30"
                      )}
                      value={form.user_contact}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        set("user_contact", val);
                        setPhoneError(validatePhone(val));
                      }}
                      placeholder="09XXXXXXXXX"
                      required
                    />
                  </div>
                  {phoneError && (
                    <p className="text-[11px] text-red-500 mt-1 ml-1 font-medium">{phoneError}</p>
                  )}
                </Field>
                <Field label="Birthday" required>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
                    <Input
                      type="date"
                      className={cn(inputCls, "pl-9")}
                      value={form.user_bday}
                      onChange={(e) => set("user_bday", e.target.value)}
                      max="9999-12-31"
                      required
                    />
                  </div>
                </Field>
                <Field label="Suffix Name">
                  <Input
                    className={inputCls}
                    value={form.suffix_name || ""}
                    onChange={(e) => set("suffix_name", e.target.value)}
                    placeholder="e.g. Jr., III"
                  />
                </Field>
                <Field label="Nickname">
                  <Input
                    className={inputCls}
                    value={form.nickname || ""}
                    onChange={(e) => set("nickname", e.target.value)}
                    placeholder="e.g. Juan"
                  />
                </Field>
                <Field label="Gender" required>
                   <Select value={form.gender} onValueChange={(v) => set("gender", v)} required>
                    <SelectTrigger className={inputCls}>
                      <SelectValue placeholder="Select Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {form.gender === "Other" && (
                  <Field label="Please specify gender" required>
                    <Input
                      className={inputCls}
                      value={form.gender_specify || ""}
                      onChange={(e) => set("gender_specify", e.target.value)}
                      placeholder="Enter gender"
                      required
                    />
                  </Field>
                )}

                <Field label="Civil Status" required>
                  <Select value={form.civil_status} onValueChange={(v) => set("civil_status", v)} required>
                    <SelectTrigger className={inputCls}>
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single">Single</SelectItem>
                      <SelectItem value="Married">Married</SelectItem>
                      <SelectItem value="Widowed">Widowed</SelectItem>
                      <SelectItem value="Separated">Separated</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Blood Type">
                  <Input
                    className={inputCls}
                    value={form.blood_type || ""}
                    onChange={(e) => set("blood_type", e.target.value)}
                    placeholder="e.g. O+, A-"
                  />
                </Field>
                <Field label="Nationality" required>
                  <Input
                    className={inputCls}
                    value={form.nationality || ""}
                    onChange={(e) => set("nationality", e.target.value)}
                    placeholder="e.g. Filipino"
                    required
                  />
                </Field>
                <Field label="Place of Birth" required>
                  <Input
                    className={inputCls}
                    value={form.place_of_birth || ""}
                    onChange={(e) => set("place_of_birth", e.target.value)}
                    placeholder="City / Province"
                    required
                  />
                </Field>
                <Field label="Religion" required>
                  <Input
                    className={inputCls}
                    value={form.religion || ""}
                    onChange={(e) => set("religion", e.target.value)}
                    placeholder="Religion"
                    required
                  />
                </Field>
                {(form.civil_status === "Married" || form.civil_status === "Widowed") && (
                  <Field label="Spouse Name">
                    <Input
                      className={inputCls}
                      value={form.spouse_name || ""}
                      onChange={(e) => set("spouse_name", e.target.value)}
                      placeholder="Full Name"
                    />
                  </Field>
                )}
              </div>

              {/* Address */}
              <div className="mt-4 p-4 rounded-2xl bg-muted/30 border border-muted-foreground/10 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" /> Address
                </p>
                <AddressSelectors 
                  province={form.user_province}
                  city={form.user_city}
                  brgy={form.user_brgy}
                  onProvinceChange={(v) => set("user_province", v)}
                  onCityChange={(v) => set("user_city", v)}
                  onBrgyChange={(v) => set("user_brgy", v)}
                />
              </div>

              {/* Emergency */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Emergency Contact Name">
                  <Input
                    className={inputCls}
                    value={form.emergency_contact_name}
                    onChange={(e) =>
                      set("emergency_contact_name", e.target.value)
                    }
                    placeholder="Contact person"
                  />
                </Field>
                <Field label="Emergency Contact Number">
                  <Input
                    className={cn(
                      inputCls,
                      emergencyPhoneError && "border-red-500 focus-visible:ring-red-500/30"
                    )}
                    value={form.emergency_contact_number}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      set("emergency_contact_number", val);
                      setEmergencyPhoneError(validatePhone(val, false));
                    }}
                    placeholder="09XXXXXXXXX"
                  />
                  {emergencyPhoneError && (
                    <p className="text-[11px] text-red-500 mt-1 ml-1 font-medium">{emergencyPhoneError}</p>
                  )}
                </Field>
              </div>
            </section>

            <Separator />

            {/* ── Work & Account ── */}
            <section>
              <SectionHeader
                icon={Briefcase}
                title="Work & Account"
                color="text-emerald-500"
                bg="bg-emerald-50/60"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Department" required>
                  <Select
                    value={form.user_department}
                    onValueChange={(v) => set("user_department", v)}
                    required
                  >
                    <SelectTrigger
                      className={cn(
                        inputCls,
                        "data-[placeholder]:text-muted-foreground/50"
                      )}
                    >
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {departments.map((d) => (
                        <SelectItem
                          key={d.department_id}
                          value={d.department_id.toString()}
                        >
                          {d.department_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Designation / Position" required>
                  <Input
                    className={inputCls}
                    value={form.user_position}
                    onChange={(e) => set("user_position", e.target.value)}
                    placeholder="e.g. System Developer"
                    required
                  />
                </Field>
                <Field label="Email" required>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                    <Input
                      type="email"
                      className={cn(inputCls, "pl-9")}
                      value={form.user_email}
                      onChange={(e) => set("user_email", e.target.value)}
                      placeholder="email@company.com"
                      required
                    />
                  </div>
                </Field>
                <Field label="Password" required>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                    <Input
                      type="password"
                      className={cn(
                        inputCls,
                        "pl-9",
                        passwordError && "border-red-500 focus-visible:ring-red-500/30"
                      )}
                      value={form.user_password}
                      onChange={(e) => {
                        set("user_password", e.target.value);
                        // Validate on change so error clears as user fixes it
                        setPasswordError(validatePassword(e.target.value));
                      }}
                      placeholder="Min 15 chars, upper, lower, digit, @$!%*?&"
                      required
                    />
                  </div>
                  {passwordError && (
                    <p className="text-[11px] text-red-500 mt-1 ml-1 font-medium">{passwordError}</p>
                  )}
                </Field>
                <Field label="Date of Hire" required>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
                    <Input
                      type="date"
                      className={cn(inputCls, "pl-9")}
                      value={form.user_dateOfHire}
                      onChange={(e) => set("user_dateOfHire", e.target.value)}
                      max="9999-12-31"
                      required
                    />
                  </div>
                </Field>
                <Field label="RF ID">
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                    <Input
                      className={cn(inputCls, "pl-9")}
                      value={form.rf_id}
                      onChange={(e) => set("rf_id", e.target.value)}
                      placeholder="RFID number"
                    />
                  </div>
                </Field>
                <Field label="Biometric ID">
                  <Input
                    className={inputCls}
                    value={form.biometric_id || ""}
                    onChange={(e) => set("biometric_id", e.target.value)}
                    placeholder="Biometric System ID"
                  />
                </Field>
              </div>

              {/* Government IDs */}
              <div className="mt-4 p-4 rounded-2xl bg-muted/30 border border-muted-foreground/10 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">
                  Government IDs
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Field label="TIN">
                    <Input
                      className={inputCls}
                      value={form.user_tin}
                      onChange={(e) => set("user_tin", e.target.value)}
                      placeholder="000-000-000"
                    />
                  </Field>
                  <Field label="SSS">
                    <Input
                      className={inputCls}
                      value={form.user_sss}
                      onChange={(e) => set("user_sss", e.target.value)}
                      placeholder="00-0000000-0"
                    />
                  </Field>
                  <Field label="PhilHealth">
                    <Input
                      className={inputCls}
                      value={form.user_philhealth}
                      onChange={(e) => set("user_philhealth", e.target.value)}
                      placeholder="000000000000"
                    />
                  </Field>
                  <Field label="Pag-IBIG">
                    <Input
                      className={inputCls}
                      value={form.user_pagibig}
                      onChange={(e) => set("user_pagibig", e.target.value)}
                      placeholder="000000000000"
                    />
                  </Field>
                </div>
              </div>

              {/* Admin Toggle */}
              <div className="mt-3 flex items-center justify-between p-4 rounded-2xl border border-primary/15 bg-primary/5">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary/60" />
                  <div>
                    <p className="text-sm font-semibold">Admin Access</p>
                    <p className="text-xs text-muted-foreground">
                      Grant this user administrative privileges
                    </p>
                  </div>
                </div>
                <Switch
                  checked={form.isAdmin}
                  onCheckedChange={(v) => {
                    set("isAdmin", v);
                    set("role", v ? "ADMIN" : "USER");
                  }}
                />
              </div>
            </section>

            <Separator />

            {/* ── Media ── */}
            <section>
              <SectionHeader
                icon={ImagePlus}
                title="Media"
                color="text-violet-500"
                bg="bg-violet-50/60"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* User Image */}
                <div className="space-y-2">
                  <Label className="text-[12px] font-semibold text-foreground/70">
                    User Image
                  </Label>
                  {/* Hidden native input — triggered via ref to avoid Radix focus conflict */}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => handleFileChange("user_image", e.target.files?.[0] ?? null)}
                  />
                  <div
                    onClick={() => imageInputRef.current?.click()}
                    className={cn(
                      "flex flex-col items-center justify-center h-36 rounded-2xl border-2 border-dashed cursor-pointer transition-all select-none",
                      "border-muted-foreground/20 bg-muted/30 hover:bg-muted/50 hover:border-primary/40 group overflow-hidden"
                    )}
                  >
                    {imagePreview ? (
                      <div className="relative w-full h-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imagePreview}
                          alt="preview"
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFileChange("user_image", null);
                            if (imageInputRef.current) imageInputRef.current.value = "";
                          }}
                          className="absolute top-2 right-2 p-1 bg-background/80 rounded-full shadow"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground/50 group-hover:text-primary/60 transition-colors">
                        <ImagePlus className="h-8 w-8" />
                        <span className="text-xs font-medium">Click to upload photo</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Signature Image */}
                <div className="space-y-2">
                  <Label className="text-[12px] font-semibold text-foreground/70">
                    Signature Image (Upload)
                  </Label>
                  {/* Hidden native input */}
                  <input
                    ref={sigInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => handleFileChange("signature", e.target.files?.[0] ?? null)}
                  />
                  <div
                    onClick={() => sigInputRef.current?.click()}
                    className={cn(
                      "flex flex-col items-center justify-center h-36 rounded-2xl border-2 border-dashed cursor-pointer transition-all select-none",
                      "border-muted-foreground/20 bg-muted/30 hover:bg-muted/50 hover:border-primary/40 group overflow-hidden"
                    )}
                  >
                    {sigPreview ? (
                      <div className="relative w-full h-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={sigPreview}
                          alt="signature"
                          className="h-full w-full object-contain p-2"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFileChange("signature", null);
                            if (sigInputRef.current) sigInputRef.current.value = "";
                          }}
                          className="absolute top-2 right-2 p-1 bg-background/80 rounded-full shadow"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground/50 group-hover:text-primary/60 transition-colors">
                        <PenLine className="h-8 w-8" />
                        <span className="text-xs font-medium">Click to upload signature</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Signature Pad */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[12px] font-semibold text-foreground/70">
                    Signature Pad{" "}
                    <span className="text-muted-foreground/40 font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground h-7 px-3 rounded-lg"
                    onClick={clearCanvas}
                  >
                    Clear Signature
                  </Button>
                </div>
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={160}
                  className="w-full h-40 border-2 border-dashed border-muted-foreground/20 rounded-2xl bg-muted/20 cursor-crosshair touch-none"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={stopDraw}
                />
                <p className="text-xs text-muted-foreground/50">
                  Draw your signature above using mouse or touch.
                </p>
              </div>
            </section>
          </div>

          {/* ── Footer ── */}
          <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-muted-foreground/5 shrink-0 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:bg-transparent font-bold text-xs uppercase tracking-widest"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full px-8 bg-foreground text-background hover:bg-foreground/90 shadow-xl transition-all active:scale-95 font-bold gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {isSubmitting ? "Saving..." : "Add Employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
