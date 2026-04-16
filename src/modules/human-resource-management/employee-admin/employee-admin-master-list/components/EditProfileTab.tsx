"use client";

import React, { useRef, useState, useEffect } from "react";
import imageCompression from "browser-image-compression";
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
  User as UserIcon,
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
  ShieldCheck,
  X,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { toast } from "sonner";
import type { Department, User } from "../types";
import { UpdateEmployeePayload } from "../providers/springProvider";
import { AddressSelectors } from "./AddressSelectors";

const UPLOAD_API = "/api/hrm/employee-admin/employee-master-list/upload";
const PROXY_BASE = "/api/hrm/employee-admin/employee-master-list";
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function resolveImageUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  if (isUUID(path)) {
    return `${PROXY_BASE}/assets/${path}`;
  }
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "";
  return `${base}${path}`;
}

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

async function uploadCanvasToDirectus(canvas: HTMLCanvasElement): Promise<string | null> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const hasContent = imageData.data.some((v, i) => i % 4 === 3 && v > 0);
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

export interface EditEmployeeFormData {
  // Personal
  firstName: string;
  middleName: string;
  lastName: string;
  suffixName: string;
  nickname: string;
  contact: string;
  birthday: string;
  gender: string;
  gender_specify: string;
  civilStatus: string;
  nationality: string;
  placeOfBirth: string;
  bloodType: string;
  religion: string;
  spouseName: string;
  // Address
  province: string;
  city: string;
  brgy: string;
  // Emergency
  emergencyContactName: string;
  emergencyContactNumber: string;
  // Work & Account
  department: string;
  position: string;
  email: string;
  password?: string; // Optional for update
  dateOfHire: string;
  rfId: string;
  biometricId: string;
  tinNumber: string;
  sssNumber: string;
  philHealthNumber: string;
  pagibigNumber: string;
  isAdmin: boolean;
  role: string;
  // Media
  image: File | null;
  signature: File | null;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

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

function Field({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string; }) {
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

const inputCls = "h-10 bg-muted/40 border-transparent focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 rounded-xl text-sm";

// ─── Main Component ────────────────────────────────────────────────────────────

export function EditProfileTab({ 
  user, 
  departments,
  onUpdateEmployee 
}: { 
  user: User; 
  departments: Department[];
  onUpdateEmployee: (id: number, data: UpdateEmployeePayload) => Promise<void>;
}) {
  const [form, setForm] = useState<EditEmployeeFormData>({
    firstName: user.firstName || "",
    middleName: user.middleName || "",
    lastName: user.lastName || "",
    suffixName: user.suffixName || "",
    nickname: user.nickname || "",
    contact: user.contact || "",
    birthday: user.birthday || "",
    gender: (user.gender === "Male" || user.gender === "Female") ? user.gender : (user.gender ? "Other" : ""),
    gender_specify: (user.gender === "Male" || user.gender === "Female") ? "" : (user.gender || ""),
    civilStatus: user.civilStatus || "",
    nationality: user.nationality || "",
    placeOfBirth: user.placeOfBirth || "",
    bloodType: user.bloodType || "",
    religion: user.religion || "",
    spouseName: user.spouseName || "",
    province: user.province || "",
    city: user.city || "",
    brgy: user.brgy || "",
    emergencyContactName: user.emergencyContactName || "",
    emergencyContactNumber: user.emergencyContactNumber || "",
    department: user.department ? user.department.toString() : "",
    position: user.position || "",
    email: user.email || "",
    password: "", // blank password means no change
    dateOfHire: user.dateOfHire || "",
    rfId: user.rfId || "",
    biometricId: user.biometricId || "",
    tinNumber: user.tinNumber || "",
    sssNumber: user.sssNumber || "",
    philHealthNumber: user.philHealthNumber || "",
    pagibigNumber: user.pagibigNumber || "",
    isAdmin: !!(user.admin ?? user.isAdmin),
    role: user.role || ((user.admin ?? user.isAdmin) ? "ADMIN" : "USER"),
    image: null,
    signature: null,
  });

  // Sync state if user prop changes (e.g. switching employees while modal is open)
  useEffect(() => {
    setForm({
      firstName: user.firstName || "",
      middleName: user.middleName || "",
      lastName: user.lastName || "",
      suffixName: user.suffixName || "",
      nickname: user.nickname || "",
      contact: user.contact || "",
      birthday: user.birthday || "",
      gender: (user.gender === "Male" || user.gender === "Female") ? user.gender : (user.gender ? "Other" : ""),
      gender_specify: (user.gender === "Male" || user.gender === "Female") ? "" : (user.gender || ""),
      civilStatus: user.civilStatus || "",
      nationality: user.nationality || "",
      placeOfBirth: user.placeOfBirth || "",
      bloodType: user.bloodType || "",
      religion: user.religion || "",
      spouseName: user.spouseName || "",
      province: user.province || "",
      city: user.city || "",
      brgy: user.brgy || "",
      emergencyContactName: user.emergencyContactName || "",
      emergencyContactNumber: user.emergencyContactNumber || "",
      department: user.department ? user.department.toString() : "",
      position: user.position || "",
      email: user.email || "",
      password: "",
      dateOfHire: user.dateOfHire || "",
      rfId: user.rfId || "",
      biometricId: user.biometricId || "",
      tinNumber: user.tinNumber || "",
      sssNumber: user.sssNumber || "",
      philHealthNumber: user.philHealthNumber || "",
      pagibigNumber: user.pagibigNumber || "",
      isAdmin: !!(user.admin ?? user.isAdmin),
      role: user.role || ((user.admin ?? user.isAdmin) ? "ADMIN" : "USER"),
      image: null,
      signature: null,
    });
    setExistingImage(resolveImageUrl(user.image));
    setExistingSignature(resolveImageUrl(user.signature));
    setImagePreview(null);
    setSigPreview(null);
    setIsSignatureCleared(false);
    setPasswordError(null);
    setPhoneError(null);
    setEmergencyPhoneError(null);
  }, [user]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emergencyPhoneError, setEmergencyPhoneError] = useState<string | null>(null);

  // Original Media Previews from server
  const [existingImage, setExistingImage] = useState<string | null>(resolveImageUrl(user.image));
  const [existingSignature, setExistingSignature] = useState<string | null>(resolveImageUrl(user.signature));

  // New Media Previews
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sigPreview, setSigPreview] = useState<string | null>(null);
  const [isSignatureCleared, setIsSignatureCleared] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  // ── Password Validation ──
  function validatePassword(pwd: string): string | null {
    if (!pwd) return null; // allow empty on update
    if (pwd.length < 15) return "Password must be at least 15 characters long.";
    if (pwd.length > 64) return "Password must not exceed 64 characters.";
    if (!/[a-z]/.test(pwd)) return "Password must contain at least one lowercase letter.";
    if (!/[A-Z]/.test(pwd)) return "Password must contain at least one uppercase letter.";
    if (!/\d/.test(pwd)) return "Password must contain at least one digit.";
    if (!/[@$!%*?&]/.test(pwd)) return "Password must contain at least one special character (@$!%*?&).";
    return null;
  }

  function validatePhone(phone: string, required = true): string | null {
    if (!phone) return required ? "Phone number is required" : null;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length !== 11) return "Phone number must be exactly 11 digits.";
    return null;
  }

  function set<K extends keyof EditEmployeeFormData>(key: K, value: EditEmployeeFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleFileChange(key: "image" | "signature", file: File | null) {
    if (file && file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    set(key, file as EditEmployeeFormData[typeof key]);
    if (file) {
      const url = URL.createObjectURL(file);
      if (key === "image") {
        setImagePreview(url);
      } else {
        setSigPreview(url);
      }
    } else {
      if (key === "image") {
        setImagePreview(null);
      } else {
        setSigPreview(null);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pwdErr = validatePassword(form.password || "");
    if (pwdErr) {
      setPasswordError(pwdErr);
      return;
    }

    const phoneErr = validatePhone(form.contact);
    if (phoneErr) {
      setPhoneError(phoneErr);
      return;
    }

    const emergencyErr = validatePhone(form.emergencyContactNumber, false);
    if (emergencyErr) {
      setEmergencyPhoneError(emergencyErr);
      return;
    }

    setIsSubmitting(true);
    setUploadStatus(null);
    try {
      let finalImageId: string | undefined;
      let finalSigId: string | undefined;

      if (form.image) {
        setUploadStatus("Uploading profile photo...");
        finalImageId = await uploadToDirectus(form.image, "profile");
      }

      // Ensure that if a signature file is explicitly selected, we prioritise that.
      // Otherwise, we check if the canvas was drawn on and capture that.
      if (form.signature) {
        setUploadStatus("Uploading signature image...");
        finalSigId = await uploadToDirectus(form.signature, "signature");
      } else if (canvasRef.current) {
        setUploadStatus("Capturing signature pad...");
        const padId = await uploadCanvasToDirectus(canvasRef.current);
        if (padId) finalSigId = padId;
      }

      setUploadStatus("Saving changes...");
      await onUpdateEmployee(user.id, {
        id:           user.id,
        email:        form.email,
        hashPassword: form.password || undefined,
        firstName:    form.firstName,
        middleName:   form.middleName || undefined,
        lastName:     form.lastName,
        suffixName:   form.suffixName || undefined,
        nickname:     form.nickname || undefined,
        contact:      form.contact,
        birthday:     form.birthday || undefined,
        gender:       form.gender === "Other" ? form.gender_specify : (form.gender || undefined),
        civilStatus:  form.civilStatus || undefined,
        nationality:  form.nationality || undefined,
        placeOfBirth: form.placeOfBirth || undefined,
        bloodType:    form.bloodType    || undefined,
        religion:     form.religion     || undefined,
        spouseName:   form.spouseName   || undefined,
        province:     form.province,
        city:         form.city,
        brgy:         form.brgy,
        emergencyContactName:   form.emergencyContactName || undefined,
        emergencyContactNumber: form.emergencyContactNumber || undefined,
        department:   form.department ? String(form.department) : undefined,
        position:     form.position,
        dateOfHire:   form.dateOfHire,
        tags:         "Employee", // or handle tags
        rfid:         form.rfId || undefined,
        biometricId:  form.biometricId || undefined,
        tinNumber:    form.tinNumber || undefined,
        sssNumber:    form.sssNumber || undefined,
        philHealthNumber: form.philHealthNumber || undefined,
        pagibigNumber:    form.pagibigNumber || undefined,
        admin:        form.isAdmin,
        role:         form.role,
        image:        finalImageId ? finalImageId : (existingImage ? (user.image || null) : null),
        signature:    finalSigId ? finalSigId : (isSignatureCleared ? null : (existingSignature ? (user.signature || null) : null)),
      });

    } catch (err) {
      console.error("Update failed", err);
    } finally {
      setIsSubmitting(false);
      setUploadStatus(null);
    }
  }

  // Signature Drawing
  function getPos(canvas: HTMLCanvasElement, e: React.MouseEvent | React.TouchEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }
  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    isDrawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !canvasRef.current) return;
    const { x, y } = getPos(canvasRef.current, e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !canvasRef.current) return;
    const { x, y } = getPos(canvasRef.current, e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }
  function stopDraw() { isDrawingRef.current = false; }
  function clearCanvas() {
    setIsSignatureCleared(true);
    setExistingSignature(null);
    handleFileChange("signature", null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full pl-2 pr-6 pb-6 mt-4 space-y-8">
      {/* ── Personal Information ── */}
      <section>
        <SectionHeader icon={UserIcon} title="Personal Information" color="text-blue-500" bg="bg-blue-50/60" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="First Name" required>
            <Input className={inputCls} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
          </Field>
          <Field label="Middle Name">
            <Input className={inputCls} value={form.middleName} onChange={(e) => set("middleName", e.target.value)} />
          </Field>
          <Field label="Last Name" required>
            <Input className={inputCls} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
          </Field>
          <Field label="Contact Number" required>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <Input 
                className={cn(inputCls, "pl-9", phoneError && "border-red-500 focus-visible:ring-red-500/30")} 
                value={form.contact} 
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  set("contact", val);
                  setPhoneError(validatePhone(val));
                }} 
                placeholder="09XXXXXXXXX"
                required 
              />
            </div>
            {phoneError && <p className="text-[11px] text-red-500 mt-1 ml-1 font-medium">{phoneError}</p>}
          </Field>
          <Field label="Birthday" required>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
              <Input 
                type="date" 
                className={cn(inputCls, "pl-9")} 
                value={form.birthday} 
                onChange={(e) => set("birthday", e.target.value)} 
                max="9999-12-31"
                required
              />
            </div>
          </Field>
          <Field label="Suffix Name">
            <Input className={inputCls} value={form.suffixName || ""} onChange={(e) => set("suffixName", e.target.value)} placeholder="e.g. Jr., III" />
          </Field>
          <Field label="Nickname">
            <Input className={inputCls} value={form.nickname || ""} onChange={(e) => set("nickname", e.target.value)} placeholder="e.g. Juan" />
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
            <Select value={form.civilStatus} onValueChange={(v) => set("civilStatus", v)} required>
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
            <Input className={inputCls} value={form.bloodType || ""} onChange={(e) => set("bloodType", e.target.value)} placeholder="e.g. O+, A-" />
          </Field>
          <Field label="Nationality" required>
            <Input className={inputCls} value={form.nationality || ""} onChange={(e) => set("nationality", e.target.value)} placeholder="e.g. Filipino" required />
          </Field>
          <Field label="Place of Birth" required>
            <Input className={inputCls} value={form.placeOfBirth || ""} onChange={(e) => set("placeOfBirth", e.target.value)} placeholder="City / Province" required />
          </Field>
          <Field label="Religion" required>
            <Input className={inputCls} value={form.religion || ""} onChange={(e) => set("religion", e.target.value)} placeholder="Religion" required />
          </Field>
          {(form.civilStatus === "Married" || form.civilStatus === "Widowed") && (
            <Field label="Spouse Name">
              <Input className={inputCls} value={form.spouseName || ""} onChange={(e) => set("spouseName", e.target.value)} placeholder="Full Name" />
            </Field>
          )}
        </div>

        {/* Address */}
        <div className="mt-4 p-4 rounded-2xl bg-muted/30 border border-muted-foreground/10 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
            <MapPin className="h-3 w-3" /> Address
          </p>
          <AddressSelectors 
            province={form.province}
            city={form.city}
            brgy={form.brgy}
            onProvinceChange={(v) => set("province", v)}
            onCityChange={(v) => set("city", v)}
            onBrgyChange={(v) => set("brgy", v)}
          />
        </div>

        {/* Emergency */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Emergency Contact Name">
            <Input className={inputCls} value={form.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} />
          </Field>
          <Field label="Emergency Contact Number">
            <Input 
              className={cn(inputCls, emergencyPhoneError && "border-red-500 focus-visible:ring-red-500/30")} 
              value={form.emergencyContactNumber} 
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                set("emergencyContactNumber", val);
                setEmergencyPhoneError(validatePhone(val, false));
              }} 
              placeholder="09XXXXXXXXX"
            />
            {emergencyPhoneError && <p className="text-[11px] text-red-500 mt-1 ml-1 font-medium">{emergencyPhoneError}</p>}
          </Field>
        </div>
      </section>

      <Separator />

      {/* ── Work & Account ── */}
      <section>
        <SectionHeader icon={Briefcase} title="Work & Account" color="text-emerald-500" bg="bg-emerald-50/60" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Department" required>
            <Select value={form.department} onValueChange={(v) => set("department", v)} required>
              <SelectTrigger className={cn(inputCls, "data-[placeholder]:text-muted-foreground/50")}>
                <SelectValue placeholder="Select a department" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {departments.map((d) => (
                  <SelectItem key={d.department_id} value={d.department_id.toString()}>
                    {d.department_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Designation / Position" required>
            <Input className={inputCls} value={form.position} onChange={(e) => set("position", e.target.value)} required />
          </Field>
          <Field label="Email" required>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <Input type="email" className={cn(inputCls, "pl-9")} value={form.email} onChange={(e) => set("email", e.target.value)} required />
            </div>
          </Field>
          <Field label="Change Password">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <Input
                type="password"
                className={cn(inputCls, "pl-9", passwordError && "border-red-500")}
                value={form.password}
                onChange={(e) => {
                  set("password", e.target.value);
                  setPasswordError(validatePassword(e.target.value));
                }}
                placeholder="Leave blank to keep unchanged"
              />
            </div>
            {passwordError && <p className="text-[11px] text-red-500 mt-1 ml-1 font-medium">{passwordError}</p>}
          </Field>
          <Field label="Date of Hire" required>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
              <Input type="date" className={cn(inputCls, "pl-9")} value={form.dateOfHire} onChange={(e) => set("dateOfHire", e.target.value)} required />
            </div>
          </Field>
          <Field label="RF ID">
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <Input className={cn(inputCls, "pl-9")} value={form.rfId} onChange={(e) => set("rfId", e.target.value)} />
            </div>
          </Field>
          <Field label="Biometric ID">
            <Input className={inputCls} value={form.biometricId || ""} onChange={(e) => set("biometricId", e.target.value)} placeholder="Biometric System ID" />
          </Field>
        </div>

        {/* Government IDs */}
        <div className="mt-4 p-4 rounded-2xl bg-muted/30 border border-muted-foreground/10 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">Government IDs</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="TIN"><Input className={inputCls} value={form.tinNumber} onChange={(e) => set("tinNumber", e.target.value)} /></Field>
            <Field label="SSS"><Input className={inputCls} value={form.sssNumber} onChange={(e) => set("sssNumber", e.target.value)} /></Field>
            <Field label="PhilHealth"><Input className={inputCls} value={form.philHealthNumber} onChange={(e) => set("philHealthNumber", e.target.value)} /></Field>
            <Field label="Pag-IBIG"><Input className={inputCls} value={form.pagibigNumber} onChange={(e) => set("pagibigNumber", e.target.value)} /></Field>
          </div>
        </div>

        {/* Admin Toggle */}
        <div className="mt-3 flex items-center justify-between p-4 rounded-2xl border border-primary/15 bg-primary/5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary/60" />
            <div>
              <p className="text-sm font-semibold">Admin Access</p>
              <p className="text-xs text-muted-foreground">Grant this user administrative privileges</p>
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
        <SectionHeader icon={ImagePlus} title="Media" color="text-violet-500" bg="bg-violet-50/60" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* User Image */}
          <div className="space-y-2">
            <Label className="text-[12px] font-semibold text-foreground/70">User Image</Label>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => handleFileChange("image", e.target.files?.[0] ?? null)}
            />
            <div
              onClick={() => imageInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center h-48 rounded-2xl border-2 border-dashed cursor-pointer transition-all select-none overflow-hidden group",
                "border-muted-foreground/20 bg-muted/30 hover:bg-muted/50 hover:border-primary/40"
              )}
            >
              {(imagePreview || existingImage) ? (
                <div className="relative w-full h-full group">
                  <Image fill src={imagePreview || existingImage!} alt="preview" className="object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-xs font-bold font-mono">CHANGE PHOTO</span>
                  </div>
                  {(imagePreview || existingImage) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExistingImage(null);
                        handleFileChange("image", null);
                      }}
                      className="absolute top-2 right-2 p-1 bg-background/80 rounded-full shadow"
                    >
                      <X className="h-3 w-3 text-red-500" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground/50 group-hover:text-primary/60">
                  <ImagePlus className="h-8 w-8" />
                  <span className="text-xs font-medium">Click to upload photo</span>
                </div>
              )}
            </div>
          </div>

          {/* Signature Image */}
          <div className="space-y-2">
            <Label className="text-[12px] font-semibold text-foreground/70">Signature Image (Upload)</Label>
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
                "flex flex-col items-center justify-center h-48 rounded-2xl border-2 border-dashed cursor-pointer transition-all select-none overflow-hidden group",
                "border-muted-foreground/20 bg-muted/30 hover:bg-muted/50 hover:border-primary/40"
              )}
            >
              {(sigPreview || existingSignature) ? (
                <div className="relative w-full h-full group">
                  <Image fill src={sigPreview || existingSignature!} alt="signature" className="object-contain p-4" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-xs font-bold font-mono">CHANGE SIGNATURE</span>
                  </div>
                  {(sigPreview || existingSignature) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsSignatureCleared(true);
                        setExistingSignature(null);
                        handleFileChange("signature", null);
                      }}
                      className="absolute top-2 right-2 p-1 bg-background/80 rounded-full shadow"
                    >
                      <X className="h-3 w-3 text-red-500" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground/50 group-hover:text-primary/60">
                  <PenLine className="h-8 w-8" />
                  <span className="text-xs font-medium">Click to upload signature</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Signature Pad */}
        <div className="mt-4 flex flex-col items-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={clearCanvas} className="text-xs">
            Clear Signature Pad
          </Button>
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
        </div>
      </section>

      {/* ── Submit Action ── */}
      <div className="pt-6 mt-4 border-t flex items-center justify-end">
        <div className="text-xs text-muted-foreground mr-auto">
          {uploadStatus && <span className="animate-pulse">{uploadStatus}</span>}
        </div>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full px-8 bg-foreground text-background hover:bg-foreground/90 shadow-xl gap-2 font-bold"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
