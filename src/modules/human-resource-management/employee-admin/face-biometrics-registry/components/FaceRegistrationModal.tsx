import React, { useRef, useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, ScanFace, XCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as faceapi from "face-api.js";
import type { User } from "../types";
import { createFaceBiometric, uploadImageToDirectus, invalidateUserBiometrics, checkDuplicateFace } from "../providers/fetchProvider";

interface FaceRegistrationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: (User & { hasFaceBiometric?: boolean; image_reference_path?: string | null }) | null;
}

export function FaceRegistrationModal({ isOpen, onOpenChange, user }: FaceRegistrationModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0); // For liveliness check
  const [scanComplete, setScanComplete] = useState(false);
  const [isRetaking, setIsRetaking] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  
  const hasExistingImage = !!(user?.hasFaceBiometric && user?.image_reference_path);
  const showPreview = hasExistingImage && !isRetaking && !scanComplete;
  
  const ASSETS_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") + "/assets";

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setScanComplete(false);
      setScanStep(0);
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("Could not access camera. Please check permissions.");
    }
  };

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Failed to load face-api models", err);
        toast.error("Failed to load facial recognition models.");
      }
    };
    
    if (isOpen && !modelsLoaded) {
      loadModels();
    }
  }, [isOpen, modelsLoaded]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScanComplete(false);
      setIsScanning(false);
      setScanStep(0);
      setIsRetaking(false);
    } else if (!hasExistingImage) {
      // Auto start camera if no existing image
      setIsRetaking(true);
    }
  }, [isOpen, stopCamera, hasExistingImage]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const captureScan = () => {
    if (!videoRef.current || !canvasRef.current || !user) return;
    
    setIsScanning(true);
    setScanStep(1); // Look straight
    
    // Short wait for UI to update and user to look straight
    setTimeout(async () => {
      setScanStep(2); // Extracting features
      try {
        if (!videoRef.current || !canvasRef.current || !modelsLoaded) return;
        
        // Use face-api.js to detect the face and extract the descriptor
        const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();
        
        if (!detection) {
            setIsScanning(false);
            toast.error("No face detected! Please ensure you are looking at the camera in good lighting.");
            stopCamera();
            return;
        }

        setIsScanning(false);
        const descriptorArray = Array.from(detection.descriptor);
        
        // Check for duplicates
        const { isDuplicate } = await checkDuplicateFace(descriptorArray);
        if (isDuplicate) {
            toast.error("This face is already registered to another user account!");
            stopCamera();
            return;
        }
        
        // Extract a frame from the video
        const canvas = canvasRef.current;
        const video = videoRef.current;
        let fileId = null;
        
        if (canvas && video) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                // Convert canvas to blob and upload
                const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
                if (blob) {
                    const filename = `face_${user.id}_${Date.now()}.jpg`;
                    const formData = new FormData();
                    formData.append("title", filename);
                    formData.append("file", blob, filename);
                    fileId = await uploadImageToDirectus(formData);
                }
            }
        }
        
        const faceEncoding = JSON.stringify(descriptorArray);
        
        // Invalidate old records strictly
        await invalidateUserBiometrics(user.id);
        
        // Save using our Directus API
        await createFaceBiometric({
            user_id: user.id,
            face_encoding: faceEncoding,
            image_reference_path: fileId,
            is_active: true
        });

        setScanComplete(true);
        toast.success(`Face biometric saved successfully for ${user.firstName} ${user.lastName}!`);
      } catch (err) {
        console.error("Failed to save face biometric", err);
        toast.error("Failed to save biometric registration.");
      } finally {
        stopCamera();
      }
    }, 500); // Only wait 500ms instead of 3.5s artificially
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-primary" />
            Face Biometric Registration
          </DialogTitle>
          <DialogDescription>
            Scan face biometrics for {user?.firstName} {user?.lastName}. Ensure good lighting for the facial capture.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="relative flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl bg-muted/10 min-h-[300px] overflow-hidden">
            {showPreview && (
              <div className="flex flex-col items-center w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={`${ASSETS_URL}/${user.image_reference_path}`} 
                  alt={`${user.firstName} Face`}
                  className="w-full max-h-[300px] object-cover rounded-lg shadow-md mb-4"
                />
                <p className="text-sm font-medium text-muted-foreground mb-4">Current Face Biometric</p>
                <Button 
                  onClick={() => {
                    setIsRetaking(true);
                    startCamera();
                  }}
                >
                  <Camera className="mr-2 h-4 w-4" /> Retake Face
                </Button>
              </div>
            )}

            {!showPreview && !stream && !scanComplete && (
              <div className="flex flex-col items-center">
                <Camera className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-sm font-medium text-muted-foreground mb-4 text-center">
                  Camera is inactive
                </p>
                <Button onClick={startCamera} disabled={!modelsLoaded}>
                  {!modelsLoaded ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading AI Models...</>
                  ) : (
                    <><Camera className="mr-2 h-4 w-4" /> Start Camera</>
                  )}
                </Button>
              </div>
            )}

            {!showPreview && (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className={`w-full max-h-[300px] object-cover rounded-lg ${!stream ? "hidden" : ""}`}
              />
            )}
            
            
            <canvas ref={canvasRef} className="hidden" />
            
            {isScanning && (
              <div className="absolute inset-0 border-4 border-primary/50 flex flex-col items-center justify-end z-10 rounded-lg p-6 pointer-events-none">
                <div className="bg-background/95 backdrop-blur-md px-6 py-4 rounded-2xl flex items-center gap-4 shadow-xl border border-primary/20">
                   <ScanFace className="h-8 w-8 text-primary animate-pulse" />
                   <div className="text-left">
                     <p className="text-sm font-bold text-primary">Facial Capture in Progress</p>
                     {scanStep === 1 && <p className="text-xs font-medium animate-pulse text-foreground">Please look straight at the camera...</p>}
                     {scanStep === 2 && <p className="text-xs font-medium animate-pulse text-foreground">Hold still, processing face encoding...</p>}
                   </div>
                </div>
              </div>
            )}

            {scanComplete && !stream && (
              <div className="flex flex-col items-center">
                <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                <p className="text-sm font-medium text-foreground mb-4 text-center">
                  Face Successfully Captured & Encoded!
                </p>
                <Button variant="outline" onClick={startCamera}>
                  Retake Capture
                </Button>
              </div>
            )}
          </div>

          {stream && (
            <div className="flex justify-center gap-4">
              <Button variant="destructive" onClick={stopCamera}>
                <XCircle className="mr-2 h-4 w-4" /> Stop
              </Button>
              <Button onClick={captureScan} disabled={isScanning}>
                <ScanFace className="mr-2 h-4 w-4" /> Capture Face
              </Button>
            </div>
          )}
        </div>
        
        {scanComplete && (
          <div className="flex justify-end pt-4 border-t mt-4">
             <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
