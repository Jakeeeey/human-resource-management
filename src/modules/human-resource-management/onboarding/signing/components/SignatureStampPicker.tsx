"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignaturePad } from "../SignaturePad";
import type { OnboardingSignaturePadHandle } from "../SignaturePad";
import type { SigningStroke } from "../signingStrokes";

// SignatureStampPicker.tsx — captured pad → PNG stamp: the hiree draws (or
// types, but typed-mode yields NO stamp — empty pad is rejected, Todo 3
// contract) in the pad, captures it into a stamp, then taps a page to place
// it. Placed stamps stay draggable until Confirm.

export interface CapturedStamp {
  pngUrl: string;
  strokes: SigningStroke[];
}

interface SignatureStampPickerProps {
  open: boolean;
  capturing: boolean;
  onClose: () => void;
  onCapture: (stamp: CapturedStamp) => void;
}

export function SignatureStampPicker({
  open,
  capturing,
  onClose,
  onCapture,
}: SignatureStampPickerProps) {
  const padRef = useRef<OnboardingSignaturePadHandle | null>(null);
  const [typedMode, setTypedMode] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [padStrokes, setPadStrokes] = useState<SigningStroke[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = async () => {
    setError(null);
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      setError("Draw your signature first — an empty pad cannot become a stamp.");
      return;
    }
    const blob = await pad.exportBlob();
    if (!blob) {
      setError("Typed names cannot become stamps — draw your signature instead.");
      return;
    }
    const url = URL.createObjectURL(blob);
    onCapture({ pngUrl: url, strokes: pad.exportStrokes() });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] rounded-2xl max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Capture signature stamp</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <SignaturePad
            ref={padRef}
            typedMode={typedMode}
            onTypedModeChange={setTypedMode}
            typedName={typedName}
            onTypedNameChange={setTypedName}
            onStrokesChange={setPadStrokes}
          />
          {padStrokes.length > 0 && !typedMode && (
            <p className="truncate text-xs text-muted-foreground" title="Captured — tap a page to place the stamp">
              Captured — tap a page to place the stamp, drag to move.
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={onClose}
            className="min-h-8 w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleCapture()}
            disabled={capturing || typedMode}
            className="min-h-8 w-full sm:w-auto"
            title={typedMode ? "Typed names cannot become stamps" : "Capture stamp"}
          >
            {capturing ? "Capturing…" : "Capture stamp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
