/* eslint-disable */
"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Camera, ScanFace, CheckCircle2, XCircle, RefreshCw, UserCheck, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import * as faceapi from "face-api.js";
import { verifyFaceMatch } from "../../face-biometrics-registry/providers/fetchProvider";
import { useFaceRegistry } from "../../face-biometrics-registry/hooks/useFaceRegistry";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export function ScannerTerminal() {
  const { employees, isLoading, isError } = useFaceRegistry();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "waiting_blink" | "success" | "error" | "scanning">("idle");
  const [matchedUser, setMatchedUser] = useState<any>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);
  const livenessStateRef = useRef({ ratios: [] as number[], verified: false });
  
  // Results
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    user?: any;
    message: string;
  } | null>(null);
  
  useEffect(() => {

    
    // Load face-api models
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Failed to load models", err);
        toast.error("Failed to load facial recognition models.");
      }
    };
    
    loadModels();
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    isProcessingRef.current = false;
  }, [stream]);

  const startCamera = useCallback(async () => {
    try {
      setScanStatus("idle");
      setMatchedUser(null);
      setScanResult(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("Could not access camera. Please check permissions.");
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleVideoPlay = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    
    // Helper to calculate EAR
    const calculateEAR = (eye: faceapi.Point[]) => {
      const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
      const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
      const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
      return (v1 + v2) / (2.0 * h);
    };
    
    scanIntervalRef.current = setInterval(async () => {
      // Don't scan if already processing or showing a result
      if (isProcessingRef.current || scanStatus === "success" || scanStatus === "error") return;
      
      if (videoRef.current && modelsLoaded) {
        try {
          isProcessingRef.current = true;
          
          if (!livenessStateRef.current.verified) {
            setScanStatus("waiting_blink"); // Using same state name for compatibility, but UI says "Analyzing Liveness"
            const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.85 })).withFaceLandmarks();
            
            if (detection) {
              const leftEye = detection.landmarks.getLeftEye()[0];
              const rightEye = detection.landmarks.getRightEye()[0];
              const nose = detection.landmarks.getNose()[0];
              
              // Calculate ratio of left-eye-to-nose vs inter-ocular distance
              const leftDist = Math.hypot(leftEye.x - nose.x, leftEye.y - nose.y);
              const iod = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
              const ratio = leftDist / iod;
              
              livenessStateRef.current.ratios.push(ratio);
              
              if (livenessStateRef.current.ratios.length >= 4) {
                const ratios = livenessStateRef.current.ratios.slice(-4); // look at last 4 frames
                const min = Math.min(...ratios);
                const max = Math.max(...ratios);
                const variance = max - min;
                
                if (variance > 0.0015) { // Lower threshold for fewer frames
                  livenessStateRef.current.verified = true;
                  toast.success("Liveness verified! Extracting face...");
                } else {
                  // Keep sliding window if it's a static image
                  livenessStateRef.current.ratios.shift();
                }
              }
            }
            isProcessingRef.current = false;
            return;
          }

          // Proceed to actual recognition if liveness verified
          const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.85 }))
                                         .withFaceLandmarks()
                                         .withFaceDescriptor();
          
          if (detection) {
            // Face found! Stop interval and process
            isProcessingRef.current = true;
            setIsScanning(true);
            setScanStatus("scanning");
            setScanResult(null);

            const descriptorArray = Array.from(detection.descriptor);
            const { success, matchedUserId } = await verifyFaceMatch(descriptorArray);
            
            setIsScanning(false);
            
            if (success && matchedUserId) {
              const user = employees.find(e => e.id === matchedUserId);
              setScanStatus("success");
              setMatchedUser(user || { firstName: "Unknown", lastName: "User" });
              setScanResult({
                success: true,
                user: user,
                message: "Face verified successfully! Access Granted."
              });
              toast.success("Face recognized successfully.");
              
              // Reset after 5 seconds
              setTimeout(() => {
                setScanStatus("idle");
                setScanResult(null);
                livenessStateRef.current = { ratios: [], verified: false };
                isProcessingRef.current = false;
              }, 5000);
            } else {
              setScanStatus("error");
              setScanResult({
                success: false,
                message: "Face not recognized in the system."
              });
              toast.error("Face not recognized in the system.");
              
              // Reset after 3 seconds
              setTimeout(() => {
                setScanStatus("idle");
                setScanResult(null);
                livenessStateRef.current = { ratios: [], verified: false };
                isProcessingRef.current = false;
              }, 3000);
            }
          } else {
             isProcessingRef.current = false;
          }
        } catch (err) {
          console.error("Auto scan error", err);
          isProcessingRef.current = false;
        }
      }
    }, 80); // Faster interval for quicker processing
  };

  return (
    <Card className="w-full shadow-lg border-none overflow-hidden">
      <CardContent className="p-0 flex flex-col md:flex-row">
        {/* Left Side: Camera Feed */}
        <div className="relative flex-1 bg-black min-h-[400px] flex items-center justify-center overflow-hidden">
          {!stream && scanStatus === "idle" && (
            <div className="flex flex-col items-center">
              <ScanFace className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <p className="text-sm font-medium text-muted-foreground mb-4 text-center">
                Terminal is inactive
              </p>
              <button 
                onClick={startCamera} 
                disabled={!modelsLoaded}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-sm text-sm font-medium disabled:opacity-50 flex items-center"
              >
                {!modelsLoaded ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading AI Models...</>
                ) : (
                    "Activate Terminal"
                )}
              </button>
            </div>
          )}

          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            onPlay={handleVideoPlay}
            className={`absolute inset-0 w-full h-full object-cover ${!stream ? "hidden" : ""}`}
          />

          {scanStatus === "waiting_blink" && (
            <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm flex flex-col items-center justify-center z-20">
              <div className="relative">
                <ScanFace className="h-24 w-24 text-white animate-pulse" />
              </div>
              <p className="mt-6 text-xl font-bold text-white tracking-widest uppercase animate-pulse">
                Analyzing Liveness...
              </p>
            </div>
          )}

          {isScanning && scanStatus === "scanning" && (
            <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm flex flex-col items-center justify-center z-20">
              <div className="relative">
                <ScanFace className="h-24 w-24 text-white animate-pulse" />
                <div className="absolute top-0 left-0 w-full h-1 bg-green-400 animate-[scan_2s_ease-in-out_infinite] opacity-70" />
              </div>
              <p className="mt-6 text-xl font-bold text-white tracking-widest uppercase animate-pulse">
                Analyzing Face...
              </p>
            </div>
          )}

          {/* Scanner Overlay Frame */}
          {stream && !isScanning && !scanResult && (
            <div className="absolute inset-0 pointer-events-none border-[6px] border-white/10 z-10 m-8 rounded-3xl" />
          )}
        </div>

        {/* Right Side: Results & Controls */}
        <div className="w-full md:w-[350px] bg-white p-8 flex flex-col border-l">
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-6">Attendance Terminal</h2>
            
            {scanResult ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className={`p-4 rounded-xl flex items-start gap-3 ${scanResult.success ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}>
                  {scanResult.success ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <p className="font-medium text-sm">{scanResult.message}</p>
                </div>

                {scanResult.success && scanResult.user && (
                  <div className="flex flex-col items-center text-center space-y-4 pt-4 border-t">
                    <Avatar className="h-24 w-24 ring-4 ring-primary/10">
                      <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${scanResult.user.firstName?.[0]}${scanResult.user.lastName?.[0]}`} />
                      <AvatarFallback className="text-2xl bg-primary/5 text-primary">
                        {scanResult.user.firstName?.[0]}{scanResult.user.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-2xl font-bold tracking-tight text-foreground">
                        {scanResult.user.firstName} {scanResult.user.lastName}
                      </h3>
                      <p className="text-muted-foreground font-medium mt-1">
                        {scanResult.user.email || "No Email"}
                      </p>
                      <div className="inline-block mt-3 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold tracking-widest uppercase">
                        Access Granted
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground space-y-4 opacity-60">
                <ScanFace className="h-16 w-16" />
                <p className="text-sm font-medium">Ready for next employee scan.</p>
              </div>
            )}
          </div>

          <div className="pt-8 mt-auto space-y-3">
             <div className="p-4 rounded-xl bg-muted/30 border text-center text-sm text-muted-foreground">
                <p>The terminal will automatically scan for a face when the camera is active.</p>
             </div>
             {scanResult && (
               <Button variant="outline" className="w-full" onClick={() => {
                   setScanStatus("idle");
                   setScanResult(null);
                   livenessStateRef.current = { ratios: [], verified: false };
                   isProcessingRef.current = false;
               }}>
                 <RefreshCw className="mr-2 h-4 w-4" /> Reset Terminal Now
               </Button>
             )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
