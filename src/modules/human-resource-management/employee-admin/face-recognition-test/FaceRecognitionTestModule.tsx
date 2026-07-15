"use client";

import { ScanFace } from "lucide-react";
import { ScannerTerminal } from "./components/ScannerTerminal";

export function FaceRecognitionTestModule() {
  return (
    <div className="w-full h-full min-h-screen bg-slate-50/50 p-6 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-6">
        <div className="flex flex-col space-y-2 text-center md:text-left">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center justify-center md:justify-start gap-3">
            <ScanFace className="h-8 w-8 text-primary" />
            Face Recognition Simulator
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Test the Face Biometrics Registration system by simulating an attendance clock-in scan.
          </p>
        </div>

        <ScannerTerminal />
      </div>
    </div>
  );
}
