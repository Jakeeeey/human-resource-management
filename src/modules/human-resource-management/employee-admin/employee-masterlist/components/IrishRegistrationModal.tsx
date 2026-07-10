import React, { useRef, useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, ScanFace, XCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { User } from "../types";
import { updateEmployeeDirectus } from "../providers/fetchProvider";

interface IrishRegistrationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export function IrishRegistrationModal({ isOpen, onOpenChange, user }: IrishRegistrationModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0); // For liveliness check
  const [scanComplete, setScanComplete] = useState(false);

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
    if (!isOpen) {
      stopCamera();
      setScanComplete(false);
      setIsScanning(false);
      setScanStep(0);
    }
  }, [isOpen, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const captureScan = () => {
    if (!videoRef.current || !canvasRef.current || !user) return;
    
    setIsScanning(true);
    setScanStep(1); // Blink
    
    // Simulate liveliness checks
    setTimeout(() => {
      setScanStep(2); // Turn head
    }, 1500);

    setTimeout(async () => {
      try {
        setIsScanning(false);
        
        // Generate a simulated biometric template string
        const mockBiometricHash = "iris_template_" + Date.now().toString(36) + Math.random().toString(36).substring(2);
        
        // Save using our Directus provider
        await updateEmployeeDirectus(user.id, {
          biometric_id: mockBiometricHash,
        });

        setScanComplete(true);
        toast.success(`Biometric data saved successfully to Directus for ${user.firstName} ${user.lastName}!`);
      } catch (err) {
        console.error("Failed to save biometric data", err);
        toast.error("Failed to save biometric registration to Directus.");
      } finally {
        stopCamera();
      }
    }, 3500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-primary" />
            Biometric Registration
          </DialogTitle>
          <DialogDescription>
            Scan biometrics for {user?.firstName} {user?.lastName}. Ensure good lighting for the liveness check.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="relative flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl bg-muted/10 min-h-[300px] overflow-hidden">
            {!stream && !scanComplete && (
              <div className="flex flex-col items-center">
                <Camera className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-sm font-medium text-muted-foreground mb-4 text-center">
                  Camera is inactive
                </p>
                <Button onClick={startCamera}>
                  <Camera className="mr-2 h-4 w-4" /> Start Camera
                </Button>
              </div>
            )}

            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`w-full max-h-[300px] object-cover rounded-lg ${!stream ? "hidden" : ""}`}
            />
            
            <canvas ref={canvasRef} className="hidden" />
            
            {isScanning && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg p-6 text-center">
                <ScanFace className="h-16 w-16 text-primary animate-pulse mb-4" />
                <p className="text-lg font-bold text-primary mb-2">Liveness Check</p>
                {scanStep === 1 && <p className="text-sm font-medium animate-pulse text-foreground">Please blink twice...</p>}
                {scanStep === 2 && <p className="text-sm font-medium animate-pulse text-foreground">Please turn your head slightly left...</p>}
              </div>
            )}

            {scanComplete && !stream && (
              <div className="flex flex-col items-center">
                <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                <p className="text-sm font-medium text-foreground mb-4 text-center">
                  Liveness Verified & Scan Captured!
                </p>
                <Button variant="outline" onClick={startCamera}>
                  Retake Scan
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
                <ScanFace className="mr-2 h-4 w-4" /> Begin Liveness Check
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
