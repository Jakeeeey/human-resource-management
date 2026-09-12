"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Camera, 
  ScanFace, 
  XCircle, 
  CheckCircle2, 
  Loader2, 
  RefreshCw, 
  ShieldCheck, 
  AlertTriangle, 
  Sparkles, 
  Video, 
  Eye
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import * as faceapi from "face-api.js";
import type { User } from "../types";
import { 
  createFaceBiometric, 
  uploadImageToDirectus, 
  invalidateUserBiometrics, 
  checkDuplicateFace 
} from "../providers/fetchProvider";

interface FaceRegistrationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: (User & { hasFaceBiometric?: boolean; image_reference_path?: string | null }) | null;
}

type RegistrationStep = "preview" | "camera" | "review" | "success";

interface VideoDevice {
  deviceId: string;
  label: string;
}

export function FaceRegistrationModal({ isOpen, onOpenChange, user }: FaceRegistrationModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Camera & Device state
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<VideoDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isModelsLoading, setIsModelsLoading] = useState(false);

  // Workflow state: 'preview' (if existing), 'camera', 'review', 'success'
  const [step, setStep] = useState<RegistrationStep>("camera");
  
  // Real-time tracking & Auto-Capture state
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [detectionConfidence, setDetectionConfidence] = useState<number | null>(null);
  const [autoCapture, setAutoCapture] = useState(true);
  const [autoCaptureProgress, setAutoCaptureProgress] = useState(0); // 0 to 100
  const steadyFaceCountRef = useRef(0);
  const isCapturingRef = useRef(false);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Capture & Processing state

  const [capturedImageBlob, setCapturedImageBlob] = useState<Blob | null>(null);
  const [capturedImageDataUrl, setCapturedImageDataUrl] = useState<string | null>(null);
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(null);
  const [isProcessingSave, setIsProcessingSave] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const hasExistingBiometric = !!(user?.hasFaceBiometric && user?.image_reference_path);
  const ASSETS_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") + "/assets";
  
  // Robust name resolution
  const firstName = user?.firstName || (user as Record<string, unknown>)?.first_name as string || "";
  const lastName = user?.lastName || (user as Record<string, unknown>)?.last_name as string || "";
  const displayName = (firstName || lastName) 
    ? `${firstName} ${lastName}`.trim() 
    : user?.email 
      ? user.email.split("@")[0] 
      : `Employee #${user?.id || ""}`;

  const userInitials = 
    `${firstName?.[0] || ""}${lastName?.[0] || ""}` || 
    displayName.substring(0, 2).toUpperCase();

  // 1. Load Face-API models once
  useEffect(() => {
    const loadModels = async () => {
      if (modelsLoaded || isModelsLoading) return;
      setIsModelsLoading(true);
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models")
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Failed to load face-api models", err);
        toast.error("Failed to load facial recognition models.");
      } finally {
        setIsModelsLoading(false);
      }
    };

    if (isOpen && !modelsLoaded) {
      loadModels();
    }
  }, [isOpen, modelsLoaded, isModelsLoading]);

  // 3. Stop camera stream & live detection loop without state cycle
  const stopCamera = useCallback(() => {
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsFaceDetected(false);
    setDetectionConfidence(null);
    setAutoCaptureProgress(0);
    steadyFaceCountRef.current = 0;
  }, []);

  // 4. Start camera stream
  const startCamera = useCallback(async (deviceIdToUse?: string) => {
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch {}
      });
      streamRef.current = null;
    }

    try {
      const videoConstraints: MediaTrackConstraints = 
        deviceIdToUse && deviceIdToUse.trim() !== ""
          ? { deviceId: { exact: deviceIdToUse } }
          : { facingMode: "user" };

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setStep("camera");
      setDuplicateWarning(null);
      steadyFaceCountRef.current = 0;
      setAutoCaptureProgress(0);

      // Enumerate cameras once permission is granted so device labels appear
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices
            .filter(d => d.kind === "videoinput")
            .map((d, index) => ({
              deviceId: d.deviceId,
              label: d.label || `Camera ${index + 1}`
            }));
          setVideoDevices(videoInputs);
        }
      } catch {}
    } catch (err) {
      console.error("Camera access error:", err);
      toast.error("Could not access camera. Please allow camera permissions in your browser.");
    }
  }, []);

  // 5. Connect stream to video element safely whenever stream or videoRef mounts
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.warn("Video play interrupted:", err);
      });
    }
  }, [stream, step]);

  // 6. Capture face snapshot & compute descriptor
  const executeCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !user || !modelsLoaded || isCapturingRef.current) return;
    
    isCapturingRef.current = true;
    setIsCapturing(true);
    setDuplicateWarning(null);

    // Visual camera flash effect
    setCaptureFlash(true);
    setTimeout(() => setCaptureFlash(false), 200);

    try {
      // Step 1: Detect face with landmarks and full 128-d descriptor
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.error("No face clearly detected. Please center your face and try again.");
        setIsCapturing(false);
        isCapturingRef.current = false;
        steadyFaceCountRef.current = -2; // Brief pause before auto-trying again
        setAutoCaptureProgress(0);
        return;
      }

      const descriptorArray = Array.from(detection.descriptor) as number[];

      // Step 2: Check for biometric duplicate across existing registered employees
      const { isDuplicate, matchedUserId } = await checkDuplicateFace(descriptorArray);
      if (isDuplicate && matchedUserId !== user.id) {
        setDuplicateWarning(`This face is already registered to another employee record (ID: #${matchedUserId}).`);
        toast.warning("Duplicate biometric match detected.");
        setIsCapturing(false);
        isCapturingRef.current = false;
        steadyFaceCountRef.current = -3;
        setAutoCaptureProgress(0);
        return;
      }

      // Step 3: Draw frame from video to canvas
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        setCapturedImageDataUrl(dataUrl);

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.92)
        );
        setCapturedImageBlob(blob);
        setCapturedDescriptor(descriptorArray);

        // Switch to Review step
        stopCamera();
        setStep("review");
      }
    } catch (err) {
      console.error("Error during facial scan:", err);
      toast.error("Failed to analyze facial features. Please ensure proper lighting.");
    } finally {
      setIsCapturing(false);
      isCapturingRef.current = false;
    }
  }, [user, modelsLoaded, stopCamera]);

  // 7. Real-time face detection & Auto-Capture loop
  useEffect(() => {
    if (step !== "camera" || !stream || !modelsLoaded) {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
      return;
    }

    // Run throttled detection check every 250ms
    trackingIntervalRef.current = setInterval(async () => {
      if (
        !videoRef.current || 
        videoRef.current.paused || 
        videoRef.current.ended || 
        videoRef.current.readyState < 2 ||
        isCapturingRef.current
      ) return;

      try {
        const detection = await faceapi.detectSingleFace(
          videoRef.current,
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
        );

        if (detection) {
          setIsFaceDetected(true);
          setDetectionConfidence(Math.round(detection.score * 100));

          // Auto-capture logic: trigger after 3 consecutive stable detections (~750ms)
          if (autoCapture && !isCapturingRef.current) {
            steadyFaceCountRef.current = Math.max(0, steadyFaceCountRef.current) + 1;
            const progress = Math.min(100, Math.round((steadyFaceCountRef.current / 3) * 100));
            setAutoCaptureProgress(progress);

            if (steadyFaceCountRef.current >= 3) {
              // Trigger auto snapshot!
              executeCapture();
            }
          }
        } else {
          setIsFaceDetected(false);
          setDetectionConfidence(null);
          steadyFaceCountRef.current = 0;
          setAutoCaptureProgress(0);
        }
      } catch {
        // Ignore detection errors during stream transition
      }
    }, 250);

    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
    };
  }, [step, stream, modelsLoaded, autoCapture, executeCapture]);

  // Reset modal state on open/close — depends ONLY on isOpen to prevent loop
  useEffect(() => {
    if (isOpen) {
      if (hasExistingBiometric) {
        setStep("preview");
      } else {
        setStep("camera");
        startCamera();
      }
    } else {
      stopCamera();
      setCapturedImageBlob(null);
      setCapturedImageDataUrl(null);
      setCapturedDescriptor(null);
      setDuplicateWarning(null);
      setIsProcessingSave(false);
      setIsCapturing(false);
    }
  }, [isOpen, hasExistingBiometric, startCamera, stopCamera]); // Intentionally isolated to modal visibility

  // 8. Save and enroll biometric into Directus
  const handleConfirmSave = async () => {
    if (!user || !capturedImageBlob || !capturedDescriptor) return;

    setIsProcessingSave(true);
    try {
      // 1. Upload snapshot image to Directus files
      const filename = `face_${user.id}_${Date.now()}.jpg`;
      const formData = new FormData();
      formData.append("title", `Biometric - ${displayName}`);
      formData.append("file", capturedImageBlob, filename);
      const fileId = await uploadImageToDirectus(formData);

      // 2. Invalidate any previous biometric records for this user
      await invalidateUserBiometrics(user.id);

      // 3. Save new biometric record
      await createFaceBiometric({
        user_id: user.id,
        face_encoding: JSON.stringify(capturedDescriptor),
        image_reference_path: fileId,
        is_active: true
      });

      setStep("success");
      toast.success(`Face biometric enrolled successfully for ${displayName}!`);
    } catch (err) {
      console.error("Failed to enroll biometric:", err);
      toast.error("Failed to save biometric enrollment. Please check system permissions.");
    } finally {
      setIsProcessingSave(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl bg-background">
        {/* Header with Employee Context */}
        <div className="px-6 pt-6 pb-4 border-b bg-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 ring-2 ring-primary/20 shadow-sm">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${userInitials}`} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">{userInitials}</AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span>{displayName}</span>
                  {user?.hasFaceBiometric ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold py-0.5">
                      <ShieldCheck className="h-3 w-3 mr-1 text-emerald-600" /> Enrolled
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] font-semibold py-0.5">
                      Pending Enrollment
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {user?.position || "Employee"} • {user?.email || "No email on record"}
                </DialogDescription>
              </div>
            </div>

            {/* Stepper Indicator */}
            <div className="flex items-center gap-1.5 pt-1">
              <div className={`h-2 rounded-full transition-all duration-300 ${step === "camera" || step === "preview" ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"}`} />
              <div className={`h-2 rounded-full transition-all duration-300 ${step === "review" ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"}`} />
              <div className={`h-2 rounded-full transition-all duration-300 ${step === "success" ? "w-6 bg-emerald-500" : "w-2 bg-muted-foreground/30"}`} />
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-5">
          {/* STEP 1: PREVIEW EXISTING BIOMETRIC */}
          {step === "preview" && hasExistingBiometric && (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border bg-black/5 flex items-center justify-center min-h-[300px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${ASSETS_URL}/${user.image_reference_path}`}
                  alt={`${displayName} Face`}
                  className="w-full max-h-[340px] object-cover rounded-xl"
                />
                <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-medium flex items-center gap-1.5 shadow-lg">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Active Biometric Reference
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Registered biometric profile is currently used for attendance verification.
                </p>
                <Button 
                  onClick={() => startCamera(selectedDeviceId)}
                  className="rounded-xl shadow-md gap-2"
                >
                  <RefreshCw className="h-4 w-4" /> Retake Face Biometric
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: LIVE CAMERA & GUIDED CAPTURE */}
          {step === "camera" && (
            <div className="space-y-4">
              {/* Camera device switcher & Auto-capture option */}
              <div className="flex items-center justify-between gap-3 text-xs">
                {videoDevices.length > 1 ? (
                  <div className="flex items-center gap-2 flex-1 max-w-[240px]">
                    <Video className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Select
                      value={selectedDeviceId}
                      onValueChange={(devId) => {
                        setSelectedDeviceId(devId);
                        startCamera(devId);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs rounded-lg bg-muted/30 border-muted">
                        <SelectValue placeholder="Select Camera" />
                      </SelectTrigger>
                      <SelectContent>
                        {videoDevices.map((dev) => (
                          <SelectItem key={dev.deviceId} value={dev.deviceId} className="text-xs">
                            {dev.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Video className="h-3.5 w-3.5" />
                    <span>Live Biometric Sensor</span>
                  </div>
                )}

                {/* Auto-Capture Toggle Button */}
                <Button
                  type="button"
                  variant={autoCapture ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => {
                    setAutoCapture(!autoCapture);
                    steadyFaceCountRef.current = 0;
                    setAutoCaptureProgress(0);
                  }}
                  className={`h-8 px-2.5 rounded-lg text-xs gap-1.5 transition-all ${
                    autoCapture 
                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 font-semibold" 
                      : "text-muted-foreground"
                  }`}
                >
                  <Sparkles className={`h-3.5 w-3.5 ${autoCapture ? "text-emerald-600 animate-pulse" : "text-muted-foreground"}`} />
                  <span>Auto-Capture: {autoCapture ? "ON" : "OFF"}</span>
                </Button>
              </div>

              {/* Viewport with Biometric Overlay HUD */}
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center shadow-inner group">
                {/* Camera Inactive / Loading Models Screen */}
                {!stream && (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <ScanFace className="h-16 w-16 text-slate-600 animate-pulse" />
                    <p className="text-sm font-medium text-slate-300">
                      {!modelsLoaded ? "Initializing Facial AI Engine..." : "Camera feed inactive"}
                    </p>
                    <Button 
                      onClick={() => startCamera(selectedDeviceId)}
                      disabled={!modelsLoaded}
                      size="sm"
                      className="rounded-xl shadow-lg gap-2"
                    >
                      {!modelsLoaded ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Loading AI Weights...</>
                      ) : (
                        <><Camera className="h-4 w-4" /> Start Camera</>
                      )}
                    </Button>
                  </div>
                )}

                {/* Live Video Element */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform -scale-x-100 ${!stream ? "hidden" : "block"}`}
                />

                {/* Shutter Flash Effect */}
                {captureFlash && (
                  <div className="absolute inset-0 bg-white z-40 transition-opacity duration-200" />
                )}

                {/* Biometric Oval Alignment Reticle Overlay */}
                {stream && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
                    {/* SVG Biometric Oval Guide */}
                    <div className="relative w-[210px] h-[270px] flex items-center justify-center">
                      <div 
                        className={`w-full h-full rounded-[48%] border-2 transition-all duration-300 ${
                          isFaceDetected 
                            ? "border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.5)] bg-emerald-500/10" 
                            : "border-white/40 border-dashed animate-pulse bg-white/5"
                        }`}
                      />

                      {/* Corner Targeting Brackets */}
                      <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-primary/80 rounded-tl-md" />
                      <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-primary/80 rounded-tr-md" />
                      <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-primary/80 rounded-bl-md" />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-primary/80 rounded-br-md" />

                      {/* Animated Laser Scanning Line */}
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-[scan_2.5s_ease-in-out_infinite] opacity-75" />
                    </div>

                    {/* Real-Time Detection & Auto-Capture Pill Badge */}
                    <div className="absolute bottom-4 flex items-center gap-2">
                      {isFaceDetected ? (
                        <div className="bg-emerald-950/90 backdrop-blur-md border border-emerald-500/40 text-emerald-300 text-xs font-semibold px-3.5 py-1.5 rounded-full flex items-center gap-2.5 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                          {autoCapture ? (
                            <>
                              <Sparkles className="h-3.5 w-3.5 text-emerald-400 animate-spin" />
                              <span>Hold still... Auto-capturing</span>
                              {/* Progress bar inside pill */}
                              <div className="w-10 h-1.5 bg-emerald-900/80 rounded-full overflow-hidden border border-emerald-500/30">
                                <div 
                                  className="h-full bg-emerald-400 transition-all duration-200" 
                                  style={{ width: `${autoCaptureProgress}%` }}
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              <span>Face Aligned ({detectionConfidence}%)</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 text-slate-300 text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
                          <Eye className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                          <span>Center face inside oval to auto-capture</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Processing Overlay */}
                {isCapturing && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-30 flex flex-col items-center justify-center space-y-2">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    <p className="text-sm font-semibold text-white">Extracting 128-D Biometric Matrix...</p>
                  </div>
                )}
              </div>

              {/* Inline Duplicate / Error Alert */}
              {duplicateWarning && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 animate-in fade-in">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">{duplicateWarning}</p>
                    <p className="text-amber-700/80 mt-0.5">Please ensure the employee is facing directly forward with no accessories obstructing the face.</p>
                  </div>
                </div>
              )}

              {/* Action Controls */}
              {stream && (
                <div className="flex items-center justify-between pt-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={stopCamera}
                    className="text-muted-foreground hover:text-foreground rounded-xl"
                  >
                    <XCircle className="h-4 w-4 mr-1.5" /> Pause Camera
                  </Button>

                  <Button
                    onClick={executeCapture}
                    disabled={isCapturing || !modelsLoaded}
                    className={`rounded-xl px-6 shadow-lg transition-all ${
                      isFaceDetected 
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground scale-105" 
                        : "bg-muted-foreground/80 hover:bg-muted-foreground text-white"
                    }`}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Manual Snap
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: REVIEW & CONFIRM BEFORE SAVING */}
          {step === "review" && capturedImageDataUrl && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden border bg-black shadow-md flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capturedImageDataUrl}
                  alt="Captured Face Preview"
                  className="w-full h-full object-cover transform -scale-x-100"
                />

                {/* Quality Validation Badge */}
                <div className="absolute top-3 left-3 bg-emerald-950/80 backdrop-blur-md border border-emerald-500/30 text-emerald-300 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-xl">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  <span>128-D Biometric Matrix Extracted</span>
                </div>
              </div>

              {/* Verification Summary Card */}
              <div className="bg-muted/30 border rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Face Captured Successfully</p>
                    <p className="text-xs text-muted-foreground">Review the biometric capture before saving to the employee profile.</p>
                  </div>
                </div>
              </div>

              {/* Two-Button Decision: Retake or Confirm */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  onClick={() => startCamera(selectedDeviceId)}
                  disabled={isProcessingSave}
                  className="rounded-xl gap-2"
                >
                  <RefreshCw className="h-4 w-4" /> Retake Photo
                </Button>

                <Button
                  onClick={handleConfirmSave}
                  disabled={isProcessingSave}
                  className="rounded-xl px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg gap-2"
                >
                  {isProcessingSave ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Enrolling Biometric...</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4" /> Confirm & Enroll Biometric</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS STATE */}
          {step === "success" && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in-95 duration-300">
              <div className="h-20 w-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-600 flex items-center justify-center shadow-xl">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-foreground">Biometric Enrolled Successfully!</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {displayName} can now authenticate using touchless biometric facial recognition on attendance kiosks.
                </p>
              </div>
              <Button 
                onClick={() => onOpenChange(false)}
                className="mt-4 rounded-xl px-8 shadow-lg"
              >
                Done
              </Button>
            </div>
          )}

          {/* Hidden Canvas for Frame Processing */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
